import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {Store} from './store.mjs';
import {hash} from './providers.mjs';
import {licensedMusicValid} from './licensed-music.mjs';
import {visualClaims,usedAssetIds} from '../lib/visual.mjs';
import {assert,blockers,now,log} from '../lib/core.mjs';

// Explicit owner-requested transfer of a completed private production-quality
// artifact. No upload, new AI call, gate override, or duplicate video is created.
export function promoteAcceptedValidation(engine,request){
 if(!request)return null;
 const match=String(request).match(/^([a-zA-Z0-9-]{1,80})\/(science|knowledge)$/);assert(match,'投稿待ち移行の指定が不正です。');
 const [,runId,name]=match,state=engine.store.read();
 assert(state.settings.mode==='auto'&&state.settings.privacy==='public'&&state.automation?.publicUploadRequested,'公開投稿の依頼が必要です。');
 const directory=resolve(engine.store.directory,'validation',runId),reportFile=resolve(directory,'report.json');
 assert(existsSync(reportFile)&&existsSync(resolve(directory,'shorts-loop.sqlite')),'完了した検証記録がありません。');
 const report=JSON.parse(readFileSync(reportFile)),test=report.tests?.find(t=>t.name===name);
 assert(test?.passed===true&&/^[a-f0-9-]{36}$/.test(test.videoId||''),'合格済みの実動画だけを移行できます。');
 const previous=state.live.videos.find(v=>v.id===test.videoId);
 if(previous){assert(previous.acceptanceOrigin?.request===request,'同じIDの既存動画は変更できません。');return {videoId:previous.id,status:'already_queued',youtubeId:previous.youtubeId||null};}
 const source=new Store(directory);let v;try{v=source.read().live.videos.find(v=>v.id===test.videoId);}finally{source.close();}
 assert(v&&v.privacy==='private'&&v.status==='review'&&!v.synthetic&&!v.validationOnly&&!v.youtubeId&&!v.uploadIntent&&!v.uploadSession,'未送信の完成動画だけを移行できます。');
 assert(blockers(v,true).length===0,blockers(v,true).join(' / '));
 assert(usedAssetIds(v).length===0,'外部素材を使った検証動画は個別の素材移行が必要です。');
 assert(licensedMusicValid(v.mediaManifest?.musicEvidence)&&v.mediaManifest?.generatedImageCount>0,'指定したBGMとAI画像の確認が必要です。');
 assert(v.verifiedContentHash===hash(JSON.stringify(visualClaims(v))),'事実確認後に台本・図解が変わっています。');
 const sourceDir=resolve(directory,'media',v.id),realSource=realpathSync(sourceDir);
 assert(realpathSync(v.videoFile)===resolve(realSource,'video.mp4'),'検証動画の保存先が不正です。');
 const read=name=>{const file=resolve(sourceDir,name);assert(realpathSync(file)===resolve(realSource,name),'検証ファイルの保存先が不正です。');return readFileSync(file);};
 const video=read('video.mp4'),cover=read('cover.jpg');
 assert(hash(video)===v.videoHash&&v.videoHash===v.mediaManifest.sha256,'検証動画の整合性が変わっています。');
 assert(hash(cover)===v.mediaManifest.cover?.sha256,'確認済みサムネイルの整合性が変わっています。');
 const target=resolve(engine.store.directory,'media',v.id);mkdirSync(target,{recursive:true});
 for(const name of readdirSync(sourceDir).filter(n=>/^(video\.mp4|cover\.jpg|manifest\.json|captions\.(ass|srt)|frame-\d+\.jpg)$/.test(n))){
  const bytes=read(name),file=resolve(target,name);
  if(existsSync(file))assert(hash(readFileSync(file))===hash(bytes),'移行先の既存ファイルは上書きできません。');
  else writeFileSync(file,bytes,{flag:'wx',mode:0o600});
 }
 const candidate=structuredClone(v);
 Object.assign(candidate,{privacy:'public',status:'review',videoFile:resolve(target,'video.mp4'),revision:(v.revision||0)+1,approvedRevision:null,plannedAt:null,publishAt:null,acceptanceOrigin:{request,runId,name,validatedAt:report.finishedAt,promotedAt:now()}});
 for(const key of ['approvedDigest','approvedAt','autoApproved','initialPublicRequestId'])delete candidate[key];
 engine.store.update(s=>{
  assert(s.automation?.publicUploadRequested&&s.settings.mode==='auto'&&s.settings.privacy==='public','公開投稿の依頼が解除されています。');
  assert(!s.live.videos.some(x=>x.id===candidate.id),'動画はすでに移行されています。');
  engine.reserveSchedule(s,candidate);s.live.videos.unshift(candidate);
  log(s.live,'prepared-publication','全審査に合格した動画「'+candidate.title+'」を公開投稿待ちにしました。');
 });
 return {videoId:candidate.id,title:candidate.title,status:'queued',privacy:candidate.privacy,plannedAt:candidate.plannedAt,publishAt:candidate.publishAt};
}
