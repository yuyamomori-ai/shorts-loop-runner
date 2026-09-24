import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../runner/store.mjs';
import {promoteAcceptedValidation} from '../runner/promote-validation.mjs';
import {hash} from '../runner/providers.mjs';
import {readyVisual} from './fixtures/quality.mjs';
const id='11111111-1111-4111-8111-111111111111';
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'promotion-')),store=new Store(root),dir=join(root,'validation','fixture'),src=new Store(dir),media=join(dir,'media',id);mkdirSync(media,{recursive:true});
 t.after(()=>{src.close();store.close();rmSync(root,{recursive:true,force:true});});
 store.update(s=>{s.settings.mode='auto';s.settings.privacy='public';s.automation={publicUploadRequested:true,phase:'attention',youtubeReconnectRequired:true};});
 const video=Buffer.from('transport fixture, not rendered media'),cover=Buffer.from('cover fixture');
 writeFileSync(join(media,'video.mp4'),video);writeFileSync(join(media,'cover.jpg'),cover);
 const v=readyVisual({id,title:'公開待ちの検証動画',status:'review',privacy:'private',revision:1,contentType:'A',segments:[],sources:[],qa:{facts:'passed',rights:'passed',technical:'passed'},originality:{originality:85,commentary:85,editing:85,educational:85,entertainment:85,copyrightRisk:0,reusedRisk:0,confidence:.99},videoFile:join(media,'video.mp4'),videoHash:hash(video)});
 v.mediaManifest.sha256=v.videoHash;v.mediaManifest.cover={sha256:hash(cover)};
 src.update(s=>{s.live.videos=[v];});writeFileSync(join(dir,'report.json'),JSON.stringify({finishedAt:new Date().toISOString(),tests:[{name:'science',videoId:id,passed:true}]}));
 let uploads=0;const engine={store,reserveSchedule:(s,v)=>{v.plannedAt=new Date().toISOString();},upload:()=>{uploads++;throw Error('must not upload');}};
 return {store,src,media,engine,uploads:()=>uploads};
}
test('a completed immutable artifact is queued once while OAuth remains paused; no upload occurs',t=>{
 const f=fixture(t),r=promoteAcceptedValidation(f.engine,'fixture/science');
 assert.equal(r.status,'queued');assert.equal(f.uploads(),0);
 const s=f.store.read(),v=s.live.videos.find(x=>x.id===id);
 assert.equal(v.privacy,'public');assert.equal(v.status,'review');assert.equal(v.approvedRevision,null);assert.equal(s.automation.phase,'attention');
 assert.equal(hash(readFileSync(v.videoFile)),v.videoHash);assert.equal(f.src.read().live.videos[0].privacy,'private');
 assert.equal(promoteAcceptedValidation(f.engine,'fixture/science').status,'already_queued');assert.equal(f.store.read().live.videos.filter(v=>v.id===id).length,1);
});
test('tampered media and unapproved public intent never enter the production queue',t=>{
 const f=fixture(t);writeFileSync(join(f.media,'video.mp4'),'tampered');
 assert.throws(()=>promoteAcceptedValidation(f.engine,'fixture/science'),/整合性/);assert.equal(f.store.read().live.videos.length,0);
 f.store.update(s=>{s.automation.publicUploadRequested=false;});
 assert.throws(()=>promoteAcceptedValidation(f.engine,'fixture/science'),/公開投稿の依頼/);
});
test('factual or upload uncertainty cannot be promoted through a stale acceptance report',t=>{
 const f=fixture(t);f.src.update(s=>{s.live.videos[0].qa.facts='failed';});
 assert.throws(()=>promoteAcceptedValidation(f.engine,'fixture/science'),/情報源/);
 f.src.update(s=>{s.live.videos[0].qa.facts='passed';s.live.videos[0].uploadIntent='unknown';});
 assert.throws(()=>promoteAcceptedValidation(f.engine,'fixture/science'),/未送信/);
 assert.equal(f.store.read().live.videos.length,0);
});
