import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../runner/store.mjs';
import {startPreparation,preparationRejection,resumeReviewedPreparation} from '../runner/preparation.mjs';
import {initialState} from '../lib/core.mjs';
import {readyVisual} from './fixtures/quality.mjs';
const env={SHORTSLOOP_PREPARE_VIDEO_ID:'one-video',SHORTSLOOP_PREPARE_REQUEST:'one-request'};
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'prepare-')),store=new Store(dir);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return store;}
test('deployment overlap waits for the existing lease and then prepares exactly once',async t=>{
 const store=fixture(t);store.acquire('pipeline','old-worker',120);let calls=0,done;const settled=new Promise(r=>{done=r;}),engine={store,running:false,job:async(action,payload)=>{calls++;assert.equal(action,'render');assert.equal(payload.id,'one-video');}};
 assert(startPreparation(engine,{env}));assert.equal(calls,0);assert.equal(store.read().productionPreparation,undefined);
 store.release('pipeline','old-worker');assert(startPreparation(engine,{env,onSettled:done}));await settled;
 assert.equal(calls,1);assert.equal(store.read().productionPreparation.status,'ready');assert.equal(startPreparation(engine,{env}),false);
});
test('a rejected quality check is not retried indefinitely by preparation',async t=>{
 const store=fixture(t);let done;const settled=new Promise(r=>{done=r;});const engine={store,running:false,job:async()=>{throw Error('quality failed');}};
 startPreparation(engine,{env,onSettled:done});await settled;assert.equal(store.read().productionPreparation.status,'failed');assert.equal(startPreparation(engine,{env}),false);
});

test('explicit narration correction is hash-bound, preserves sources and rechecks facts',async()=>{
 const {revisePreparedNarration}=await import('../runner/preparation.mjs');
 const {hash}=await import('../runner/providers.mjs');
 const v={id:'draft',status:'blocked',revision:1,qa:{facts:'passed'},segments:[{text:'old text',sourceIds:['s1'],diagramSpec:{sourceIds:['s1'],labels:['元情報','警告']}}],videoFile:'/old',approvedDigest:'old',verifiedContentHash:'old',visualQa:{passed:true}};
 const state={live:{videos:[v]}},store={read:()=>structuredClone(state),update:fn=>fn(state)};
 assert.throws(()=>revisePreparedNarration(store,'draft','req',{expectedHash:'wrong',texts:['新しい文章']}));
 const correction={expectedHash:hash(JSON.stringify(['old text'])),texts:['新しい文章']};revisePreparedNarration(store,'draft','req',correction);
 assert.equal(v.qa.facts,'pending');assert.equal(v.videoFile,undefined);assert.equal(v.approvedDigest,undefined);assert.deepEqual(v.segments[0].sourceIds,['s1']);assert.equal(v.visualQa,undefined);
 revisePreparedNarration(store,'draft','req',correction);assert.equal(v.revision,2);
 v.qa.facts='passed';v.youtubeId='sent';assert.throws(()=>revisePreparedNarration(store,'draft','different',{expectedHash:hash(JSON.stringify(correction.texts)),texts:['送信後の変更']}));
});

function reviewed(){
 const s=initialState(),reason='独自性・解説価値・再利用リスクの審査で停止しました。';
 Object.assign(s.settings,{mode:'auto',privacy:'public',paused:true});
 s.automation={enabled:true,publicUploadRequested:true,phase:'attention',reason};
 const v=readyVisual({id:'repaired',status:'review',privacy:'public',revision:2,videoFile:'/new',videoHash:'changed',segments:[],sources:[],qa:{facts:'passed',rights:'passed',technical:'passed'},originality:{originality:80,commentary:80,editing:80,educational:80,entertainment:80,copyrightRisk:0,reusedRisk:0,confidence:.95,checkedAt:'2026-09-28T05:01:00Z'}});
 v.visualQa.checkedAt='2026-09-28T05:01:00Z';v.mediaManifest.sha256=v.videoHash;s.live.videos=[v];
 s.productionPreparation={videoId:v.id,status:'ready',startedAt:'2026-09-28T05:00:00Z',previousRejection:{videoId:v.id,reason,revision:1,videoHash:'old',originality:{originality:60,copyrightRisk:25}}};
 return s;
}
test('only changed, newly reviewed media can resolve its exact preparation stop',()=>{
 const s=reviewed();assert(resumeReviewedPreparation(s));assert.equal(s.automation.phase,'waiting');assert.equal(s.settings.paused,true);assert.equal(s.live.videos[0].status,'review');assert.equal(s.live.videos[0].youtubeId,undefined);
 assert.equal(s.productionPreparation.previousRejection.originality.copyrightRisk,25);
});
test('failed gates, stale reviews, ambiguous stops, uploads and user/OAuth pauses stay stopped',()=>{
 const changes=[s=>s.automation.userPaused=true,s=>s.automation.youtubeReconnectRequired=true,s=>s.automation.reason='another stop',s=>s.automation.publicUploadRequested=false,s=>s.settings.mode='review',s=>s.live.videos[0].qa.facts='failed',s=>s.live.videos[0].qa.rights='failed',s=>s.live.videos[0].originality.copyrightRisk=25,s=>s.live.videos[0].visualQa.passed=false,s=>s.live.videos[0].originality.checkedAt='2026-09-27T01:00:00Z',s=>s.live.videos[0].visualQa.checkedAt='2026-09-27T01:00:00Z',s=>s.live.videos[0].segments=[{text:'changed after fact check'}],s=>s.live.videos[0].videoHash='old',s=>s.live.videos[0].revision=1,s=>s.live.videos[0].uploadSession='pending',s=>s.live.videos[0].uploadIntent='unknown',s=>s.live.videos[0].youtubeId='sent',s=>s.productionPreparation.previousRejection.videoId='another'];
 for(const change of changes){const s=reviewed();change(s);assert.equal(resumeReviewedPreparation(s),false);assert.equal(s.automation.phase,'attention');assert.equal(s.settings.paused,true);}
 const s=reviewed(),v=s.live.videos[0];v.status='blocked';v.error=s.automation.reason;assert(preparationRejection(s,v.id));s.live.videos.push({...v,id:'another'});assert.equal(preparationRejection(s,v.id),null);
});
