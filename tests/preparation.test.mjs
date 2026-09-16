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
