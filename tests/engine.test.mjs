import {readyVisual} from './fixtures/quality.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState,plan,learn,demoData,applyAction,scores,blockers,digestable} from '../lib/core.mjs';
import {Store} from '../runner/store.mjs';
import {Engine,observationWindow,similarity} from '../runner/engine.mjs';
import {trustedSource,hash,apiError} from '../runner/providers.mjs';
test('curated planning persists unique topics and uses available source references',()=>{const s=initialState();plan(s.live,3);assert.equal(s.live.videos.length,3);plan(s.live,3);assert.equal(s.live.videos.length,4);assert.throws(()=>plan(s.live,1));assert(s.live.videos.every(v=>v.sources[0].url.startsWith('https:')));});
test('no-data and small samples never create winning patterns',()=>{const s=initialState();learn(s.live,true);assert.equal(s.live.memory.patterns.length,0);assert.equal(s.live.memory.eligible,0);});
test('synthetic observations cannot influence live learning or be uploaded',()=>{const d=demoData();assert.equal(d.memory.eligible,24);learn(d,true,false);assert.equal(d.memory.eligible,0);assert(blockers(d.videos[0]).some(x=>x.includes('検証用')));});
test('independent score gate defaults to off; demo remains executable',()=>{const s=initialState();assert.throws(()=>applyAction(s,'learn'));applyAction(s,'demo',{},'demo');assert(s.demo.memory.patterns.some(p=>p.dimension==='hook'&&p.value==='question'&&p.effect>=8));assert.equal(s.live.metrics.length,0);});
test('learned hook changes subsequent proposal selection with exploration retained',()=>{const d=demoData();plan(d,1,()=>.8);assert.equal(d.videos[0].hook,'question');assert.equal(d.videos[0].strategyVersion,1);});
test('repeated snapshot for one video is not counted as independent videos',()=>{const d=demoData();const n=d.memory.eligible;d.metrics.push(...d.metrics);learn(d,true,true);assert.equal(d.memory.eligible,n);});
test('resynchronizing observations preserves actionable AI lessons for the next prompt',()=>{const d=demoData();d.videos[0].aiAnalysis={nextChange:'次回は前置きを一文短くする'};learn(d,true,true);learn(d,true,true);assert.equal(d.memory.latestLearnings[0].nextChange,'次回は前置きを一文短くする');});
test('API data deletion removes derived AI lessons and channel data while keeping scripts',()=>{const s=initialState();plan(s.live,1);const v=s.live.videos[0];v.aiAnalysis={nextChange:'sample'};v.lastAnalyzedHash='abc';v.dropPoints=[{atSeconds:3}];v.youtubeId='api-id';s.channel={name:'channel'};s.lastSync=new Date().toISOString();const script=v.segments;applyAction(s,'deleteApiData');assert.equal(s.channel,undefined);assert.equal(v.aiAnalysis,undefined);assert.equal(v.lastAnalyzedHash,undefined);assert.equal(v.dropPoints,undefined);assert.deepEqual(v.segments,script);});
test('missing scores remain null, original retention over 100% is preserved',()=>{const s=initialState();plan(s.live,1);const m={engagedViews:1000,averageViewPercentage:125};const result=scores(s.live.videos[0],m);assert.equal(result.hook,null);assert.equal(result.shareability,null);assert.equal(result.information,null);assert.equal(m.averageViewPercentage,125);assert.equal(result.retention,100);});
test('schedule rejects wrong count, duplicate slots and invalid times',()=>{const s=initialState();for(const times of [[],['12:00','12:00'],['25:00','12:00']])assert.throws(()=>applyAction(s,'settings',{...s.settings,dailyLimit:2,times}));});
test('unverified facts or subtitle-only previews cannot be approved',()=>{const s=initialState();plan(s.live,1);const v=s.live.videos[0];v.status='review';v.videoFile='a.mp4';v.qa.technical='preview';assert.throws(()=>applyAction(s,'approve',{id:v.id}));});
test('metadata edits invalidate approval and fact-check status',()=>{const s=initialState();plan(s.live,1);const v=s.live.videos[0];Object.assign(v,{originality:{originality:90,commentary:90,editing:90,educational:90,entertainment:90,copyrightRisk:0,reusedRisk:0,confidence:1},videoFile:'test.mp4',videoHash:'abc',status:'review',qa:{facts:'passed',rights:'passed',technical:'passed',visual:'passed'}});readyVisual(v);applyAction(s,'approve',{id:v.id});assert.equal(v.status,'approved');applyAction(s,'edit',{id:v.id,title:'新しい主張',description:'',privacy:'private'});assert.equal(v.approvedRevision,null);assert.equal(v.qa.facts,'pending');});
test('fixed complete observation period handles Pacific date and latency',()=>{const w=observationWindow('2026-07-01T01:00:00Z',new Date('2026-07-15T12:00:00Z'));assert.equal(w.startDate,'2026-07-01');assert.equal(w.endDate,'2026-07-07');assert.equal(w.mature,true);assert.equal(observationWindow('2026-07-01T01:00:00Z',new Date('2026-07-08T12:00:00Z')).mature,false);});
test('source allowlist rejects credentials, private addresses and hostname tricks',()=>{for(const url of ['http://nasa.gov','https://127.0.0.1','https://nasa.gov.evil.example/a','https://x@science.nasa.gov/a','https://science.nasa.gov:444/a'])assert.equal(trustedSource(url),false);assert.equal(trustedSource('https://science.nasa.gov/moon/tidal-locking/'),true);});
test('Japanese near duplicates are detected',()=>{assert(similarity('人は記憶を思い出す練習で学びます','人は記憶を思い出す練習で学びます。')>.95);});
test('billing exhaustion waits six hours; transient rate limits use shorter backoff',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'shorts-billing-')),store=new Store(dir),engine=new Engine(store);
 try{
  store.update(s=>{s.automation.retryAt=new Date(Date.now()+60000).toISOString();});
  engine.generate=async()=>{throw apiError(429,{error:{code:'credit_balance_exhausted'}});};
  await assert.rejects(engine.job('generate'),e=>e.code==='AI_BILLING');
  assert(Date.parse(store.read().automation.retryAt)>Date.now()+5.9*3600000);
  assert.notEqual(store.read().automation.phase,'attention');
  engine.generate=async()=>{throw apiError(429,{error:{code:'rate_limit_exceeded'}});};
  await assert.rejects(engine.job('generate'));assert(store.read().automation.retryAt);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('SQLite state survives process-store restart and leases exclude a second worker',()=>{const dir=mkdtempSync(join(tmpdir(),'shorts-test-'));let store=new Store(dir);store.update(s=>plan(s.live,1));assert.equal(store.acquire('job','one'),true);assert.equal(store.acquire('job','two'),false);store.close();store=new Store(dir);assert.equal(store.read().live.videos.length,1);store.close();rmSync(dir,{recursive:true,force:true});});
test('lost final upload response resumes saved session without a second insert',async()=>{const dir=mkdtempSync(join(tmpdir(),'shorts-upload-'));const store=new Store(dir);const engine=new Engine(store);const media=join(dir,'test.mp4');writeFileSync(media,Buffer.from('fake-media-for-transport-test'));let id;
 store.update(s=>{plan(s.live,1);const v=s.live.videos[0];id=v.id;Object.assign(v,{originality:{originality:90,commentary:90,editing:90,educational:90,entertainment:90,copyrightRisk:0,reusedRisk:0,confidence:1},privacy:'private',videoFile:media,videoHash:hash(Buffer.from('fake-media-for-transport-test')),status:'review',qa:{facts:'passed',rights:'passed',technical:'passed',visual:'passed'},mediaManifest:{credit:'test'}});readyVisual(v);applyAction(s,'approve',{id});});engine.youtube.token=async()=>'test-token';const old=globalThis.fetch;let inserts=0,puts=0;
 globalThis.fetch=async(url,options)=>{if(options.method==='POST'){inserts++;return new Response('',{status:200,headers:{location:'https://www.googleapis.com/upload/test-session'}});}puts++;if(puts===1)throw Error('connection lost');return Response.json({id:'yt-test',status:{privacyStatus:'private'}});};
 try{await assert.rejects(engine.upload(id));assert(store.read().live.videos[0].uploadSession);await engine.upload(id);assert.equal(inserts,1);assert.equal(store.read().live.videos[0].youtubeId,'yt-test');await assert.rejects(engine.upload(id));}finally{globalThis.fetch=old;store.close();rmSync(dir,{recursive:true,force:true});}
});
