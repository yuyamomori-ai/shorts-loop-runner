import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../runner/store.mjs';
import {Engine} from '../runner/engine.mjs';
import {dayOf} from '../lib/growth.mjs';

async function fixture(run){
 const dir=mkdtempSync(join(tmpdir(),'shorts-production-loop-')),store=new Store(dir),engine=new Engine(store);
 engine.progress=()=>{};engine.housekeep=()=>{};engine.youtube.connected=()=>false;
 try{await run(engine,store);}finally{store.close();rmSync(dir,{recursive:true,force:true});}
}
test('a malformed strategy plan is rejected without stopping subsequent production or forging QA',()=>fixture(async(engine,store)=>{
 store.update(s=>{s.settings.paused=false;s.automation.phase='running';s.live.videos.push({id:'bad-plan',status:'draft',qa:{facts:'pending'}});});
 engine.generate=async()=>{engine.activeVideoId='bad-plan';throw Error('実験・戦略条件と生成結果が一致しません。');};
 await assert.rejects(engine.job('generate'));
 const s=store.read();assert.equal(s.settings.paused,false);assert.equal(s.live.videos[0].status,'blocked');assert.equal(s.live.videos[0].qa.facts,'pending');
}));
test('budget pacing starts after the previous daily-plan latch and persists the attempt before calling AI',()=>fixture(async(engine,store)=>{
 store.update(s=>{s.settings.paused=false;s.settings.budgetPacing=true;s.settings.dailyAiCalls=60;s.lastPlanDay=dayOf(new Date().toISOString());});
 engine.ai.key='test-only';let calls=0;
 engine.generate=async()=>{calls++;assert.equal(store.read().productionLoop.attempts,1);};
 await engine.tick();await engine.tick();
 assert.equal(calls,1);assert.equal(store.read().productionPace.reason,'cooldown');
}));
test('exhausted monthly budget never calls the planner',()=>fixture(async(engine,store)=>{
 const at=new Date().toISOString();store.update(s=>{s.settings.paused=false;s.settings.budgetPacing=true;s.spendGuard={version:1,months:{[at.slice(0,7)]:{legacyUsd:30,legacyUnknown:false,requests:[]}}};});
 engine.ai.key='test-only';engine.generate=async()=>assert.fail('must not spend');
 await engine.tick();assert.equal(store.read().productionPace.reason,'monthly_budget');
}));
test('due scheduled uploads are confirmed without another upload or clearing their ID',()=>fixture(async(engine,store)=>{
 const past=new Date(Date.now()-60000).toISOString();store.update(s=>s.live.videos.push({id:'scheduled-test',youtubeId:'existing-youtube-id',privacy:'public',status:'scheduled',publishAt:past}));
 let reads=0;engine.youtube.request=async(resource,query)=>{reads++;assert.equal(resource,'videos');assert.equal(query.id,'existing-youtube-id');return {items:[{id:query.id,status:{privacyStatus:'public',uploadStatus:'processed'},processingDetails:{processingStatus:'succeeded'}}]};};
 engine.upload=async()=>assert.fail('must not reupload');engine.uploadThumbnail=async()=>{};
 await engine.confirmPublication('scheduled-test');const v=store.read().live.videos[0];
 assert.equal(reads,1);assert.equal(v.status,'published');assert.equal(v.publishedAt,past);assert(v.publicVerifiedAt);assert.equal(v.youtubeId,'existing-youtube-id');
}));
test('a future scheduled upload is not incorrectly rejected as private',()=>fixture(async(engine,store)=>{
 store.update(s=>s.live.videos.push({id:'future',youtubeId:'existing',privacy:'public',status:'scheduled',publishAt:new Date(Date.now()+3600000).toISOString()}));
 engine.youtube.request=async()=>assert.fail('publication is not due');await engine.confirmPublication('future');
 assert.equal(store.read().live.videos[0].status,'scheduled');
}));
test('failed YouTube processing retains the sent ID and stops publication',()=>fixture(async(engine,store)=>{
 store.update(s=>{s.settings.paused=false;s.live.videos.push({id:'failed',youtubeId:'existing',privacy:'public',status:'scheduled',publishAt:new Date(Date.now()-3600000).toISOString()});});
 engine.youtube.request=async()=>({items:[{id:'existing',status:{privacyStatus:'private',uploadStatus:'rejected'}}]});
 await engine.confirmPublication('failed');const s=store.read();assert(s.settings.paused);assert.equal(s.live.videos[0].status,'blocked');assert.equal(s.live.videos[0].youtubeId,'existing');
}));
