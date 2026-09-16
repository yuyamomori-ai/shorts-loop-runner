import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../runner/store.mjs';
import {Engine} from '../runner/engine.mjs';
function fixture(t){
 const directory=mkdtempSync(join(tmpdir(),'presentation-')),store=new Store(directory),engine=new Engine(store);
 t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
 store.update(s=>s.live.videos.push({id:'draft',title:'記憶',synthetic:false,status:'draft',revision:1,approvedDigest:'stale',approvedRevision:1,qa:{facts:'passed'},sources:[{id:'s1',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC7753404/'}],segments:[{text:'元の台本',sourceIds:['s1']}],mediaManifest:{old:true},videoFile:'old.mp4'}));
 return {engine,store};
}
const edited=()=>Array.from({length:6},(_,i)=>({text:i?'実験で比べました。':'記憶が変わる？',role:i?'body':'hook',sourceIds:['s1'],visualType:'diagram',diagramSpec:{type:'concept',labels:['記憶','実験'],sourceIds:['s1']}}));
test('shorter spoken script invalidates approval and requires fresh factual review exactly once',async t=>{
 const {engine,store}=fixture(t);let calls=0,verified=0;
 engine.ai.response=async()=>{calls++;return {value:{segments:edited()}};};
 engine.verify=async id=>{verified++;const v=store.read().live.videos[0];assert.equal(id,'draft');assert.equal(v.qa.facts,'pending');assert.equal(v.approvedDigest,undefined);assert.equal(v.mediaManifest,undefined);assert.equal(v.videoFile,undefined);store.update(s=>{s.live.videos[0].qa.facts='passed';});};
 await engine.polishPresentation('draft');assert.equal(calls,1);assert.equal(verified,1);assert.equal(store.read().live.videos[0].revision,2);
 await assert.rejects(engine.polishPresentation('draft'));assert.equal(calls,1);
});
test('invented source IDs never replace the original script or trigger rendering',async t=>{
 const {engine,store}=fixture(t),segments=edited();segments[2].sourceIds=['invented'];engine.ai.response=async()=>({value:{segments}});
 await assert.rejects(engine.polishPresentation('draft'));assert.equal(store.read().live.videos[0].segments[0].text,'元の台本');
});
