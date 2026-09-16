import {spendingSummary,monthOf} from './budget.mjs';
import {dayOf} from '../lib/growth.mjs';

const DAY=86400000;
const finite=x=>Number.isFinite(x)&&x>=0;
// Uses our production costs only, never YouTube-derived performance data.
export function productionPace(state,{at=new Date().toISOString(),env=process.env}={}) {
 const budget=spendingSummary(state,{at,env}),time=Date.parse(at),date=new Date(time),day=dayOf(at);
 const daysLeft=Math.max(1,Math.ceil((Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)-time)/DAY));
 const costs=new Map();
 for(const x of state.costLedger||[])if(x.videoId&&finite(x.managedUsd??x.estimatedUsd))costs.set(x.videoId,(costs.get(x.videoId)||0)+(x.managedUsd??x.estimatedUsd)*budget.yenPerUsd);
 const completed=state.live.videos.filter(v=>!v.synthetic&&!v.validationOnly&&v.qa?.technical==='passed'&&costs.has(v.id));
 const measured=completed.map(v=>costs.get(v.id)).sort((a,b)=>a-b);
 // Early samples are too noisy to drive aggressive spending. Failed projects remain
 // in the monetary ledger, and after five completions also count toward unit cost.
 const allSpent=[...costs.values()].reduce((a,b)=>a+b,0);
 const costPerVideoJpy=Math.ceil(measured.length<5?100:Math.max(60,measured[Math.floor((measured.length-1)*.8)]*1.3,allSpent/completed.length));
 const requests=state.spendGuard?.months?.[monthOf(at)]?.requests||[];
 const todaySpent=requests.filter(x=>finite(x.bookedUsd)&&dayOf(x.at)===day).reduce((n,x)=>n+x.bookedUsd*budget.yenPerUsd,0);
 const dailyAllowanceJpy=Math.floor((budget.remainingJpy+todaySpent)/daysLeft);
 const minSpacing=Math.max(60,Number(state.settings.minSpacing)||90);
 const callTarget=Math.max(1,Math.floor((state.settings.dailyAiCalls||60)/16));
 const learnedLimit=state.settings.derivedApproved&&state.settings.adaptivePace?state.live.memory?.paceHistory?.at(-1)?.to:undefined;
 const target=budget.blocked?0:Math.max(0,Math.min(Math.floor(budget.remainingJpy/costPerVideoJpy),Math.max(1,Math.floor(dailyAllowanceJpy/costPerVideoJpy)),callTarget,Math.floor(16*60/minSpacing),Number.isInteger(learnedLimit)&&learnedLimit>0?learnedLimit:Infinity));
 const today=state.live.videos.filter(v=>!v.synthetic&&!v.validationOnly&&Number.isFinite(Date.parse(v.createdAt))&&dayOf(v.createdAt)===day);
 const made=today.filter(v=>!['blocked','rejected'].includes(v.status)).length;
 const active=state.live.videos.some(v=>['draft','rendering','review','approved','uploading'].includes(v.status));
 const previous=state.productionLoop?.day===day?state.productionLoop:null;
 const attempts=previous?.attempts||0,cooldown=Date.parse(state.productionLoop?.lastAttemptAt||'')+5*60000;
 const due=Number.isFinite(cooldown)&&cooldown>time;
 const reason=budget.blocked||!target?'monthly_budget':todaySpent+costPerVideoJpy>dailyAllowanceJpy?'daily_budget':made>=target?'daily_target':attempts>=Math.max(3,target*3)?'attempt_limit':active?'queue_active':due?'cooldown':'ready';
 return {enabled:state.settings.budgetPacing===true,day,daysLeft,target,made,attempts,costPerVideoJpy,dailyAllowanceJpy,todaySpentJpy:Math.ceil(todaySpent),remainingJpy:budget.remainingJpy,canGenerate:reason==='ready',reason,nextAttemptAt:due?new Date(cooldown).toISOString():null,scope:'production-cost planning estimate; monthly transactional guard remains authoritative'};
}
export function applyProductionRequest(state,env=process.env) {
 const id=env.SHORTSLOOP_GROWTH_REQUEST;
 if(!id||!/^[a-zA-Z0-9-]{1,80}$/.test(id)||state.productionLoop?.requestId===id)return false;
 state.productionLoop={...state.productionLoop,requestId:id};
 state.settings.budgetPacing=true;state.settings.productionLearning=true;
 state.settings.minSpacing=Math.max(90,state.settings.minSpacing||0);
 // Does not grant Google approval, resume a user pause, clear a safety stop, or
 // alter publication digests. The existing authorized autopilot controls those.
 return true;
}
export function recordProductionAttempt(state,pace,at=new Date().toISOString()) {
 const previous=state.productionLoop||{};
 state.productionLoop={...previous,day:pace.day,attempts:(previous.day===pace.day?previous.attempts||0:0)+1,lastAttemptAt:at};
}
