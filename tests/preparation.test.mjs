import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../runner/store.mjs';
import {startPreparation} from '../runner/preparation.mjs';
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
