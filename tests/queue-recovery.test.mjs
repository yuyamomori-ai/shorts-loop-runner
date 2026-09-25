import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,digestable} from '../lib/core.mjs';
import {recoverExpiredSchedules} from '../runner/queue-recovery.mjs';
import {readyVisual} from './fixtures/quality.mjs';
import {Engine} from '../runner/engine.mjs';
import {Store} from '../runner/store.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

function fixture(){
 const s=initialState();Object.assign(s.settings,{mode:'auto',paused:false,privacy:'public'});
 s.automation={publicUploadRequested:true,phase:'running'};
 const v=readyVisual({id:'missed',title:'期限切れ',status:'approved',privacy:'public',revision:2,approvedRevision:2,autoApproved:true,segments:[],sources:[{id:'s1',status:'verified'}],qa:{facts:'passed',rights:'passed',technical:'passed'},originality:{originality:85,commentary:85,editing:85,educational:85,entertainment:85,copyrightRisk:0,reusedRisk:0,confidence:.99},videoFile:'fixture.mp4',videoHash:'fixture',publishAt:new Date(Date.now()-3600000).toISOString()});
 v.plannedAt=v.publishAt;v.approvedDigest=digestable(v);s.live.videos=[v];return {s,v};
}
test('missed automatic reservations receive a future slot and lose only their old approval',()=>{
 const {s,v}=fixture(),facts=structuredClone(v.qa),next=new Date(Date.now()+3600000).toISOString();
 assert.deepEqual(recoverExpiredSchedules(s,(_,x)=>{x.plannedAt=x.publishAt=next;}),['missed']);
 assert.equal(v.status,'review');assert.equal(v.publishAt,next);assert.equal(v.approvedDigest,undefined);assert.equal(v.approvedRevision,null);assert.deepEqual(v.qa,facts);
 assert.equal(v.revision,3);assert.equal(v.videoHash,'fixture');assert.deepEqual(recoverExpiredSchedules(s,()=>assert.fail('must not rebook again')),[]);
});
test('uncertain sends, manual approval, user pause and failed QA remain immutable',()=>{
 for(const patch of [{uploadIntent:'unknown'},{uploadSession:'secret-session'},{youtubeId:'posted'},{autoApproved:false},{risk:'rights'},{status:'blocked'},{privacy:'private'},{qa:{facts:'failed'}},{visualQa:{passed:false}}]){
  const {s,v}=fixture();Object.assign(v,patch);const before=structuredClone(v);
  assert.deepEqual(recoverExpiredSchedules(s,()=>assert.fail('must not rebook')),[]);assert.deepEqual(v,before);
 }
 for(const patch of [{userPaused:true},{publicUploadRequested:false}]){const {s}=fixture();Object.assign(s.automation,patch);assert.deepEqual(recoverExpiredSchedules(s,()=>assert.fail('must not rebook')),[]);}
});
test('no slot leaves the original record untouched and does not authorize immediate publication',()=>{
 const {s,v}=fixture(),before=structuredClone(v);recoverExpiredSchedules(s,(_,x)=>{x.hour='12:00';x.plannedAt=new Date().toISOString();});assert.deepEqual(v,before);
});
test('a resumed tick rebooks and reapproves without re-rendering or reuploading sent records',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'queue-recovery-')),store=new Store(dir),engine=new Engine(store);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});const {s}=fixture();
 store.update(x=>{Object.assign(x,s);x.settings.budgetPacing=true;});
 engine.youtube.connected=()=>false;engine.progress=()=>{};engine.housekeep=()=>{};engine.render=async()=>assert.fail('finished media should not be regenerated');
 let uploads=0;engine.upload=async(id,automatic)=>{uploads++;const v=store.read().live.videos.find(x=>x.id===id);assert(automatic);assert(Date.parse(v.publishAt)>Date.now()+60000);assert.equal(v.approvedDigest,digestable(v));assert.equal(v.approvedRevision,v.revision);};
 await engine.tick();const v=store.read().live.videos[0];assert(v.scheduleRecovery);assert.equal(v.status,'approved');assert(uploads<=1);
});
