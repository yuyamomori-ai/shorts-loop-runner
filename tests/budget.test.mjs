import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState} from '../lib/core.mjs';
import {Store} from '../runner/store.mjs';
import {configureConnections} from '../runner/vault.mjs';
import {OpenAI,apiError} from '../runner/providers.mjs';
import {Engine} from '../runner/engine.mjs';
import {reserveSpend,settleSpend,spendingSummary,budgetPolicy,nextBudgetMonth} from '../runner/budget.mjs';
const textRequest={kind:'response',model:'gpt-5-mini'};
const at='2026-09-08T12:00:00Z';
const env={SHORTSLOOP_MONTHLY_TOTAL_JPY:'10000',SHORTSLOOP_MONTHLY_AI_JPY:'6000',SHORTSLOOP_BUDGET_JPY_PER_USD:'200'};
function setup(t,extra={}){
 const keys=[...Object.keys(env),'OPENAI_MODEL','OPENAI_TTS_MODEL','OPENAI_VOICE','DAILY_AI_CALLS'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,env,{OPENAI_MODEL:'gpt-5-mini',OPENAI_TTS_MODEL:'gpt-4o-mini-tts',OPENAI_VOICE:'coral',DAILY_AI_CALLS:'60'},extra);
 const dir=mkdtempSync(join(tmpdir(),'loop-budget-')),store=new Store(dir);configureConnections(dir,{openaiKey:'test-key-12345678901234567890'});
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];});
 return {store,dir,ai:new OpenAI(store)};
}
const response=(usage={input_tokens:1000,output_tokens:1000},extra={})=>Response.json({id:'response-test',status:'completed',usage,output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}],...extra});

test('default target preserves hosting reserve; config cannot raise total or lower FX allowance',()=>{
 assert.equal(budgetPolicy({}).aiUsd,30);assert.equal(budgetPolicy({}).nonAiReserveJpy,4000);
 const p=budgetPolicy({...env,SHORTSLOOP_MONTHLY_TOTAL_JPY:'999999',SHORTSLOOP_BUDGET_JPY_PER_USD:'1'});assert.equal(p.totalJpy,10000);assert.equal(p.yenPerUsd,200);
 assert.throws(()=>budgetPolicy({SHORTSLOOP_MONTHLY_AI_JPY:'NaN'}),{code:'BUDGET_CONFIG'});
});
test('existing data needs no destructive migration; unknown past costs never become zero',()=>{
 const s=initialState();assert.equal(spendingSummary(s,{at,env}).managedUsedJpy,0);assert.equal(s.spendGuard,undefined);
 s.costLedger=[{at,estimatedUsd:null}];assert.throws(()=>reserveSpend(s,textRequest,{at,env}),{code:'BUDGET_HISTORY'});
 assert.equal(spendingSummary(s,{at,env}).unknownHistory,true);
 const known=initialState();known.costLedger=[{at,estimatedUsd:30}];assert.throws(()=>reserveSpend(known,textRequest,{at,env}),{code:'MONTHLY_AI_BUDGET'});
});
test('all clients share persisted reservations before any concurrent network calls',async t=>{
 const {store,dir,ai}=setup(t,{SHORTSLOOP_MONTHLY_AI_JPY:'23'}),second=new Store(dir),other=new OpenAI(second);t.after(()=>second.close());
 let finish;const pending=new Promise(r=>{finish=r;});let calls=0;
 t.mock.method(globalThis,'fetch',()=>{calls++;return pending;});
 const first=ai.response('first');await assert.rejects(other.response('second'),{code:'MONTHLY_AI_BUDGET'});assert.equal(calls,1);
 assert.equal(spendingSummary(store.read()).managedUsedJpy,23);finish(response());await first;
 assert.equal(store.read().usage.aiCalls,1);assert(spendingSummary(store.read()).remainingJpy>20);
});
test('unknown transport outcomes remain reserved after reopening SQLite',async t=>{
 const {store,dir,ai}=setup(t,{SHORTSLOOP_MONTHLY_AI_JPY:'23'});
 t.mock.method(globalThis,'fetch',async()=>{throw Object.assign(Error('connection reset'),{cause:{code:'ECONNRESET'}});});
 await assert.rejects(ai.response('first'));const reopened=new Store(dir);
 try{const other=new OpenAI(reopened);await assert.rejects(other.response('retry'),{code:'MONTHLY_AI_BUDGET'});assert.equal(spendingSummary(reopened.read()).managedUsedJpy,23);assert.equal(store.read().usage.aiCalls,1);}finally{reopened.close();}
});
test('explicit request rejection releases dollars but never the daily attempt count',async t=>{
 const {store,ai}=setup(t,{DAILY_AI_CALLS:'1'});new Engine(store);
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:{code:'credit_balance_exhausted'}},{status:429}));
 await assert.rejects(ai.response('first'),{code:'AI_BILLING'});assert.equal(spendingSummary(store.read()).managedUsedJpy,0);
 await assert.rejects(ai.response('retry'),{code:'DAILY_AI_BUDGET'});assert.equal(store.read().usage.aiCalls,1);
});
test('actual text and bounded search usage is booked even when JSON output cannot be used',async t=>{
 const {store,ai}=setup(t);let sent;
 t.mock.method(globalThis,'fetch',async(u,o)=>{sent=JSON.parse(o.body);return response({input_tokens:10000,output_tokens:500},{status:'incomplete',output:[{type:'web_search_call'},{type:'web_search_call'}]});});
 await assert.rejects(ai.response('search',{search:true}));assert.equal(sent.max_tool_calls,2);assert.equal(sent.max_output_tokens,7000);assert.equal(sent.service_tier,'default');
 const entry=store.read().costLedger[0];assert.equal(entry.estimatedUsd,.0235);assert.equal(entry.searchCalls,2);assert.equal(entry.managedUsd,.0235);
});
test('TTS reserves a conservative allowance without pretending audio token cost was measured',async t=>{
 const {store,dir,ai}=setup(t,{SHORTSLOOP_MONTHLY_AI_JPY:'6'});let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(new Uint8Array(500));});
 await ai.speech('液体から気体へ変わります。',join(dir,'voice.wav'));
 assert(existsSync(join(dir,'voice.wav')));assert.equal(store.read().costLedger[0].estimatedUsd,null);assert.equal(spendingSummary(store.read()).managedUsedJpy,6);
 await assert.rejects(ai.speech('もう一度。',join(dir,'voice2.wav')),{code:'MONTHLY_AI_BUDGET'});assert.equal(calls,1);
});
test('unknown models and oversized speech stop before network use',async t=>{
 const {ai,dir,store}=setup(t);let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return response();});
 ai.model='unpriced-model';await assert.rejects(ai.response('test'),{code:'BUDGET_PRICING_UNKNOWN'});
 await assert.rejects(ai.speech('あ'.repeat(151),join(dir,'voice.wav')),{code:'BUDGET_INPUT'});assert.equal(calls,0);assert.equal(store.read().spendGuard,undefined);
});
test('successful responses without usage and HTTP 503 outcomes keep their full allowance',async t=>{
 const {store,ai}=setup(t);let calls=0;
 t.mock.method(globalThis,'fetch',async()=>++calls===1?Response.json({output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]}):Response.json({error:{code:'server_error'}},{status:503}));
 await ai.response('missing usage');await assert.rejects(ai.response('uncertain server outcome'),{status:503});
 const entries=Object.values(store.read().spendGuard.months)[0].requests;assert.deepEqual(entries.map(x=>x.status),['conservative','reserved']);assert.equal(entries.reduce((n,x)=>n+x.bookedUsd,0),.228);
});
test('month rollover keeps historical reservations and settles late responses in their original month',()=>{
 const s=initialState(),old=reserveSpend(s,textRequest,{at:'2026-09-30T23:59:59Z',env});
 assert.equal(spendingSummary(s,{at:'2026-10-01T00:00:01Z',env}).managedUsedJpy,0);
 reserveSpend(s,textRequest,{at:'2026-10-01T00:00:01Z',env});settleSpend(s,old,{usage:{input_tokens:1000,output_tokens:1000}});
 assert.equal(s.spendGuard.months['2026-09'].requests[0].bookedUsd,.00225);assert.equal(s.spendGuard.months['2026-10'].requests[0].status,'reserved');
 assert.equal(nextBudgetMonth('2026-12-31T23:59:59Z'),'2027-01-01T00:00:10.000Z');
});
test('unexpected tool counts and cost overruns latch an accounting hold',()=>{
 const s=initialState(),r=reserveSpend(s,textRequest,{at,env});settleSpend(s,r,{usage:{input_tokens:1,output_tokens:1},searchCalls:1});
 assert.throws(()=>reserveSpend(s,textRequest,{at,env}),{code:'BUDGET_ACCOUNTING'});
});
test('both local and provider monthly limits wait for next month without changing public mode',async t=>{
 const {store}=setup(t),engine=new Engine(store);store.update(s=>{s.settings.paused=false;s.settings.mode='auto';s.automation.phase='running';});
 for(const e of [Object.assign(Error('month'),{code:'MONTHLY_AI_BUDGET',retryAt:nextBudgetMonth(new Date())}),apiError(429,{error:{code:'project_spend_limit_exceeded'}})]){
  engine.tick=async()=>{throw e;};await assert.rejects(engine.job('tick'));
  const s=store.read();assert.equal(s.automation.retryAt,e.retryAt);assert.equal(s.settings.paused,false);assert.equal(s.settings.privacy,'public');assert.equal(s.settings.mode,'auto');
 }
});
