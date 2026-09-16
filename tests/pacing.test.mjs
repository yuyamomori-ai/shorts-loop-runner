import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/core.mjs';
import {applyProductionRequest,productionPace,recordProductionAttempt} from '../runner/pacing.mjs';
const at='2026-09-16T03:00:00Z',env={SHORTSLOOP_MONTHLY_AI_JPY:'6000',SHORTSLOOP_MONTHLY_TOTAL_JPY:'10000',SHORTSLOOP_BUDGET_JPY_PER_USD:'200'};
const make=()=>{const s=initialState();s.settings.dailyAiCalls=120;applyProductionRequest(s,{SHORTSLOOP_GROWTH_REQUEST:'owner-1'});return s;};
test('an owner request enables production learning and pacing without forging approval or clearing stops',()=>{
 const s=make();assert(s.settings.productionLearning);assert(s.settings.budgetPacing);assert.equal(s.settings.derivedApproved,false);assert.equal(s.settings.paused,true);
 s.settings.budgetPacing=false;assert.equal(applyProductionRequest(s,{SHORTSLOOP_GROWTH_REQUEST:'owner-1'}),false);assert.equal(s.settings.budgetPacing,false);
});
test('cost-aware pace spreads the remaining monthly allowance and ignores the stale daily latch',()=>{
 const s=make();s.lastPlanDay='2026-09-16';const p=productionPace(s,{at,env});assert(p.target>=3);assert(p.target<=7);assert(p.canGenerate);assert(p.target*p.costPerVideoJpy<=p.dailyAllowanceJpy);
 s.live.videos.push({id:'legacy'});assert.doesNotThrow(()=>productionPace(s,{at,env}));
});
test('mature performance pacing can reduce volume but cannot exceed the monetary ceiling',()=>{
 const s=make();s.settings.derivedApproved=true;s.settings.adaptivePace=true;s.live.memory.paceHistory=[{to:1}];
 assert.equal(productionPace(s,{at,env}).target,1);
 s.live.memory.paceHistory=[{to:100}];assert(productionPace(s,{at,env}).target<100);
 s.settings.derivedApproved=false;s.live.memory.paceHistory=[{to:1}];assert(productionPace(s,{at,env}).target>1);
});
test('failed production is charged and reserved unknown outcomes cannot restart spending',()=>{
 const s=make();s.spendGuard={version:1,months:{'2026-09':{legacyUsd:0,legacyUnknown:false,requests:[{id:'unresolved',at,kind:'response',reservedUsd:30,bookedUsd:30,status:'reserved'}]}}};
 const p=productionPace(s,{at,env});assert.equal(p.target,0);assert.equal(p.canGenerate,false);assert.equal(p.reason,'monthly_budget');
});
test('daily expenditure, active queue and cooldown independently prevent runaway production',()=>{
 const s=make();let p=productionPace(s,{at,env});recordProductionAttempt(s,p,at);assert.equal(productionPace(s,{at,env}).reason,'cooldown');
 assert(productionPace(s,{at:'2026-09-16T03:06:00Z',env}).canGenerate);
 s.live.videos.push({id:'active',status:'review',createdAt:at});assert.equal(productionPace(s,{at,env}).reason,'queue_active');
 s.live.videos=[];s.spendGuard={version:1,months:{'2026-09':{legacyUsd:0,legacyUnknown:false,requests:[{id:'spent',at,kind:'speech',reservedUsd:3,bookedUsd:3,status:'conservative'}]}}};assert.equal(productionPace(s,{at,env}).reason,'daily_budget');
});
test('the attempt limit survives repeated failed topics but resets the next day',()=>{
 const s=make(),p=productionPace(s,{at,env});s.productionLoop={...s.productionLoop,day:p.day,attempts:p.target*3};assert.equal(productionPace(s,{at,env}).reason,'attempt_limit');assert(productionPace(s,{at:'2026-09-17T03:00:00Z',env}).canGenerate);
});
