import {randomUUID} from 'node:crypto';

// Official prices checked 2026-09-08. This is a local spending guard, not an invoice.
// https://developers.openai.com/api/docs/models/gpt-5-mini
// https://developers.openai.com/api/docs/models/gpt-4o-mini-tts
// https://developers.openai.com/api/docs/pricing
const TEXT_MODELS=new Set(['gpt-5-mini','gpt-5-mini-2025-08-07']);
const SPEECH_MODELS=new Set(['gpt-4o-mini-tts','gpt-4o-mini-tts-2025-12-15','gpt-4o-mini-tts-2025-03-20']);
export const MAX_OUTPUT_TOKENS=7000,MAX_SEARCH_CALLS=2;
const round=x=>Math.max(0,Math.ceil((x-1e-12)*1e6)/1e6);
export const monthOf=at=>new Date(at).toISOString().slice(0,7);
export const nextBudgetMonth=at=>{const d=new Date(at);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1,0,0,10)).toISOString();};
function error(code,message,at){return Object.assign(Error(message),{code,...(at?{retryAt:nextBudgetMonth(at)}:{})});}
function positive(value,fallback){const n=value===undefined||value===''?fallback:Number(value);if(!Number.isFinite(n)||n<=0)throw error('BUDGET_CONFIG','費用上限の設定が不正です。');return n;}
export function budgetPolicy(env=process.env){
 const totalJpy=Math.min(10000,positive(env.SHORTSLOOP_MONTHLY_TOTAL_JPY,10000));
 const aiJpy=Math.min(totalJpy,positive(env.SHORTSLOOP_MONTHLY_AI_JPY,6000));
 // A conservative conversion allowance, deliberately not a current FX quotation.
 const yenPerUsd=Math.max(200,positive(env.SHORTSLOOP_BUDGET_JPY_PER_USD,200));
 return {totalJpy,aiJpy,nonAiReserveJpy:totalJpy-aiJpy,yenPerUsd,aiUsd:aiJpy/yenPerUsd,scope:'ShortLOOP API requests only; hosting and other applications require provider limits'};
}
export function requestAllowance({kind,model,search=false,text=''}){
 if(kind==='response'&&TEXT_MODELS.has(model)){
  // Reserve full model context and maximum output for each bounded search round.
  const toolCalls=search?MAX_SEARCH_CALLS:0;
  return {kind,model,search,reservedUsd:round((400000*.25/1e6+MAX_OUTPUT_TOKENS*2/1e6)*(1+toolCalls)+toolCalls*.01)};
 }
 if(kind==='speech'){
  if(typeof text!=='string'||!text.length||text.length>150)throw error('BUDGET_INPUT','音声は1文150文字以内に分割してください。');
  if(SPEECH_MODELS.has(model))return {kind,model,reservedUsd:.03,speechChars:text.length,accounting:'conservative sentence allowance; not measured audio-token billing'};
  if(['tts-1','tts-1-hd'].includes(model))return {kind,model,reservedUsd:round(text.length*(model==='tts-1'?15:30)/1e6),speechChars:text.length,accounting:'character-priced estimate'};
 }
 throw error('BUDGET_PRICING_UNKNOWN','設定モデルの料金を確認できないため、追加課金を伴う処理を停止しました。');
}
function stateFor(s,at){
 const month=monthOf(at);s.spendGuard??={version:1,months:{}};
 const guard=s.spendGuard;if(guard.version!==1||!guard.months)throw error('BUDGET_STATE','費用台帳を確認できません。');
 if(!guard.months[month]){
  const historical=(s.costLedger||[]).filter(x=>String(x.at).startsWith(month)&&!x.budgetReservationId);
  const unknown=historical.some(x=>!Number.isFinite(x.estimatedUsd)||x.estimatedUsd<0);
  guard.months[month]={legacyUsd:historical.reduce((n,x)=>n+(Number.isFinite(x.estimatedUsd)&&x.estimatedUsd>=0?x.estimatedUsd:0),0),legacyUnknown:unknown,requests:[]};
 }
 const entry=guard.months[month];if(!Array.isArray(entry.requests)||!Number.isFinite(entry.legacyUsd)||entry.legacyUsd<0||typeof entry.legacyUnknown!=='boolean')throw error('BUDGET_STATE','費用台帳を確認できません。');
 return entry;
}
function usedUsd(entry){return entry.legacyUsd+entry.requests.reduce((n,r)=>{if(!Number.isFinite(r.bookedUsd)||r.bookedUsd<0)throw error('BUDGET_STATE','費用台帳に不正な金額があります。');return n+r.bookedUsd;},0);}
export function reserveSpend(s,spec,{at=new Date().toISOString(),env=process.env}={}){
 const policy=budgetPolicy(env),allowance=requestAllowance(spec),entry=stateFor(s,at);
 if(entry.legacyUnknown)throw error('BUDGET_HISTORY','今月の過去API費用に不明な記録があります。請求額を確認するまで新規生成を保留します。');
 if(entry.overrun)throw error('BUDGET_ACCOUNTING','予算見積もりとの差を検出しました。費用を確認するまで生成を保留します。');
 if(round(usedUsd(entry)+allowance.reservedUsd)>policy.aiUsd)throw error('MONTHLY_AI_BUDGET','今月のAI制作枠に達しました。新規生成は翌月まで待機します。',at);
 const day=at.slice(0,10);s.usage??={};if(s.usage.day!==day)s.usage={day,aiCalls:0};
 if(s.usage.aiCalls>=s.settings.dailyAiCalls)throw error('DAILY_AI_BUDGET','本日のAI利用予算に達しました。翌日の予算更新を待ちます。');
 if(!Number.isSafeInteger(s.usage.aiCalls)||s.usage.aiCalls<0)throw error('BUDGET_STATE','本日の費用台帳を確認できません。');
 s.usage.aiCalls++;
 const reservation={id:randomUUID(),at,month:monthOf(at),...allowance,bookedUsd:allowance.reservedUsd,status:'reserved',yenPerUsd:policy.yenPerUsd};
 entry.requests.push(reservation);return {...reservation};
}
// Unknown transport outcomes stay charged at their reserved allowance, including restarts.
export function settleSpend(s,reservation,{usage,searchCalls=0,rejected=false}={}){
 const entry=s.spendGuard?.months?.[reservation.month],r=entry?.requests.find(x=>x.id===reservation.id);
 if(!r||r.status!=='reserved')throw error('BUDGET_STATE','費用予約の整合性を確認できません。');
 let estimate=null;
 if(rejected){r.bookedUsd=0;r.status='rejected';return {estimatedUsd:0,bookedUsd:0};}
 if(r.kind==='response'&&Number.isSafeInteger(usage?.input_tokens)&&usage.input_tokens>=0&&Number.isSafeInteger(usage?.output_tokens)&&usage.output_tokens>=0&&Number.isSafeInteger(searchCalls)&&searchCalls>=0){
  estimate=round((usage.input_tokens*.25+usage.output_tokens*2)/1e6+searchCalls*.01);
 }else if(r.kind==='speech'&&['tts-1','tts-1-hd'].includes(r.model))estimate=r.reservedUsd;
 r.bookedUsd=estimate??r.reservedUsd;r.status=estimate===null?'conservative':'estimated';r.estimatedUsd=estimate;
 if(r.bookedUsd>r.reservedUsd||r.kind==='response'&&searchCalls>(r.search?MAX_SEARCH_CALLS:0))entry.overrun=true;
 return {estimatedUsd:estimate,bookedUsd:r.bookedUsd};
}
export function spendingSummary(s,{at=new Date().toISOString(),env=process.env}={}){
 const policy=budgetPolicy(env),copy=structuredClone(s),entry=stateFor(copy,at),used=round(usedUsd(entry));
 return {...policy,month:monthOf(at),managedUsedJpy:Math.ceil(used*policy.yenPerUsd),remainingJpy:Math.max(0,Math.floor((policy.aiUsd-used)*policy.yenPerUsd)),blocked:entry.legacyUnknown||!!entry.overrun||used>=policy.aiUsd,unknownHistory:entry.legacyUnknown,notInvoice:true};
}
