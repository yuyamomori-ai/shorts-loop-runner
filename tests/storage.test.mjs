import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {collectGeneratedMedia,cleanRenderIntermediates} from '../runner/storage.mjs';

function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'shorts-storage-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return dir;
}
function rendered(dir,id,extra={}) {
  const folder=join(dir,'media',id);mkdirSync(folder,{recursive:true});
  const videoFile=join(folder,'video.mp4');writeFileSync(videoFile,Buffer.alloc(2048));
  return {id,videoFile,uploadedAt:'2026-01-01T00:00:00Z',status:'published',actualPrivacy:'public',youtubeId:'yt-'+id,mediaManifest:{preview:false},...extra};
}
test('cleanup frees confirmed uploads while retaining pending uploads, previews and records',t=>{
  const dir=fixture(t),videos=[rendered(dir,'sent'),rendered(dir,'scheduled',{status:'scheduled',actualPrivacy:'private'}),rendered(dir,'draft',{youtubeId:null,status:'draft'}),rendered(dir,'uncertain',{uploadSession:'session',status:'uploading'}),rendered(dir,'preview',{mediaManifest:{preview:true}}),rendered(dir,'private',{actualPrivacy:'private'})];
  const script=[{text:'保存する台本'}];videos[0].segments=script;videos[0].sources=[{url:'https://example.org'}];
  writeFileSync(join(dir,'shorts-loop.sqlite'),'database');
  assert.deepEqual(collectGeneratedMedia(dir,videos,{retentionHours:24,now:Date.parse('2026-01-03T00:00:00Z')}),['sent']);
  for(const v of videos.slice(1))assert(existsSync(v.videoFile));
  assert(existsSync(join(dir,'shorts-loop.sqlite')));assert.deepEqual(videos[0].segments,script);assert(videos[0].sources.length);
});
test('budget evicts the oldest completed render and never evicts an unposted one',t=>{
  const dir=fixture(t),old=rendered(dir,'old'),recent=rendered(dir,'recent',{uploadedAt:'2026-01-02T00:00:00Z'}),draft=rendered(dir,'draft',{youtubeId:null,status:'approved'});
  assert.deepEqual(collectGeneratedMedia(dir,[old,recent,draft],{retentionHours:0,budgetMB:4096/1024/1024}),['old']);
  assert(existsSync(recent.videoFile));assert(existsSync(draft.videoFile));
});
test('cleanup refuses path traversal and symbolic links out of the renderer folder',t=>{
  const dir=fixture(t),outside=fixture(t);writeFileSync(join(outside,'video.mp4'),'keep');mkdirSync(join(dir,'media'));symlinkSync(outside,join(dir,'media','linked'),'dir');
  const linked={id:'linked',videoFile:join(dir,'media','linked','video.mp4'),youtubeId:'yt',status:'published',uploadedAt:'2020-01-01',mediaManifest:{preview:false}};
  assert.deepEqual(collectGeneratedMedia(dir,[linked,{...linked,id:'../../escape'}],{retentionHours:1}),[]);
  assert(existsSync(join(outside,'video.mp4')));
});
test('render cleanup keeps final video, captions and visual-review frames',t=>{
  const dir=fixture(t),v=rendered(dir,'rendered'),folder=join(dir,'media',v.id);
  for(const name of ['speech-0.wav','scene-1.mp4','music.wav','background.mp4','scenes.txt','captions.srt','frame-0.jpg','manifest.json'])writeFileSync(join(folder,name),'file');
  cleanRenderIntermediates(dir,v.id);
  for(const name of ['video.mp4','captions.srt','frame-0.jpg','manifest.json'])assert(existsSync(join(folder,name)));
  for(const name of ['speech-0.wav','scene-1.mp4','music.wav','background.mp4','scenes.txt'])assert(!existsSync(join(folder,name)));
});
