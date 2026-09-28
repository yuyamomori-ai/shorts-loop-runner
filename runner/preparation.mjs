import {now,assert,blockers} from '../lib/core.mjs';
import {hash} from './providers.mjs';
import {visualClaims} from '../lib/visual.mjs';
import {originalityPass} from '../lib/rights.mjs';

const originalityStop='独自性・解説価値・再利用リスクの審査で停止しました。';
export function preparationRejection(state,id){
 const a=state.automation,items=state.live.videos.filter(v=>v.status==='blocked'&&v.error===originalityStop);
 if(a?.phase!=='attention'||a.reason!==originalityStop||items.length!==1||items[0].id!==id)return null;
 const v=items[0];return {videoId:id,reason:v.error,revision:v.revision,videoHash:v.videoHash,originality:v.originality};
}
// An explicit preparation request may repair the exact rejected artifact. Resume
// only after changed media passes every gate; never clear a different/user stop.
export function resumeReviewedPreparation(state){
 const p=state.productionPreparation,a=state.automation,v=state.live.videos.find(v=>v.id===p?.videoId),old=p?.previousRejection;
 if(p?.status!=='ready'||!old||old.videoId!==p.videoId||!old.videoHash||originalityPass(old.originality)||old.reason!==originalityStop||a?.phase!=='attention'||a.reason!==old.reason||a.userPaused||a.youtubeReconnectRequired||!a.enabled||!a.publicUploadRequested)return false;
 if(state.settings.mode!=='auto'||state.settings.privacy!=='public'||v?.privacy!=='public'||v?.status!=='review'||v.youtubeId||v.uploadIntent||v.uploadSession||!(v.revision>old.revision)||blockers(v,true).length)return false;
 if(!v.videoHash||v.videoHash===old.videoHash||v.mediaManifest?.sha256!==v.videoHash||v.verifiedContentHash!==hash(JSON.stringify(visualClaims(v))))return false;
 if(!(Date.parse(v.originality?.checkedAt)>=Date.parse(p.startedAt))||!(Date.parse(v.visualQa?.checkedAt)>=Date.parse(p.startedAt)))return false;
 a.phase='waiting';a.reason=null;p.resumedAfterReviewAt=now();return true;
}

export function resumePreparedVisualAfterStockConnection(store,env=process.env){
 const s=store.read(),p=s.productionPreparation,v=s.live.videos.find(x=>x.id===env.SHORTSLOOP_PREPARE_VIDEO_ID);
 if(s.automation?.userPaused||!p||p.requestId!==env.SHORTSLOOP_PREPARE_REQUEST||p.status!=='failed'||!v||v.status!=='blocked'||v.risk||v.youtubeId||v.uploadIntent||v.uploadSession||v.qa?.facts!=='passed'||v.qa?.assetRights==='failed'||!String(v.error||'').startsWith('映像品質を確認できない'))return false;
 store.update(state=>{state.productionPreparation.status='waiting';});return true;
}

export function revisePreparedNarration(store,id,request,revision){
 if(!revision)return;
 const v=store.read().live.videos.find(x=>x.id===id);
 if(v?.narrationCorrectionRequest===request)return;
 assert(v&&!v.youtubeId&&!v.uploadIntent&&!v.uploadSession&&!v.risk&&v.qa?.facts==='passed'&&['draft','review','blocked','approved'].includes(v.status),'未送信で根拠確認済みの台本のみ修正できます。');
 assert(revision.expectedHash===hash(JSON.stringify(v.segments.map(s=>s.text))),'台本が変更されています。最新の内容を確認してください。');
 assert(Array.isArray(revision.texts)&&revision.texts.length===v.segments.length&&revision.texts.every(t=>typeof t==='string'&&t.length>0&&t.length<=100&&!/[{}\\\u0000-\u001f]/.test(t))&&revision.texts.join('').length<=240,'修正台本の形式・長さが不正です。');
 store.update(s=>{const x=s.live.videos.find(x=>x.id===id);x.segments=x.segments.map((segment,i)=>({...segment,text:revision.texts[i]}));x.narrationCorrectionRequest=request;x.revision++;x.status='draft';x.qa.facts='pending';x.qa.technical='pending';x.qa.visual='pending';x.approvedRevision=null;delete x.approvedDigest;delete x.verifiedContentHash;delete x.mediaManifest;delete x.videoFile;delete x.visualQa;});
}

// Deployment overlap must wait for the existing worker's lease, never steal it.
export function startPreparation(engine,{env=process.env,onSettled=()=>{}}={}) {
 const store=engine.store,id=env.SHORTSLOOP_PREPARE_VIDEO_ID,request=env.SHORTSLOOP_PREPARE_REQUEST;
 if(!id||!request||![id,request].every(x=>/^[a-zA-Z0-9-]{1,80}$/.test(x)))return false;
 const prior=store.read().productionPreparation,same=prior?.requestId===request;
 const waiting=same&&(prior.status==='waiting'||prior.errorCode==='PIPELINE_BUSY'||prior.error==='別の制作・送信処理が実行中です。');
 if(same&&!waiting&&!(prior.status==='running'&&(prior.attempts||0)<2))return false;
 const lease=store.db.prepare('SELECT expires FROM leases WHERE name=?').get('pipeline');
 if(engine.running||lease?.expires>Date.now())return true;
 try{revisePreparedNarration(store,id,request,env.SHORTSLOOP_PREPARE_SCRIPT?JSON.parse(env.SHORTSLOOP_PREPARE_SCRIPT):null);}catch(e){store.update(s=>{s.productionPreparation={requestId:request,videoId:id,status:'failed',error:e.message,attempts:0};});console.error('Narration revision stopped:',e.message);return true;}
 store.update(s=>{const previousRejection=same?prior.previousRejection:preparationRejection(s,id);s.productionPreparation={requestId:request,videoId:id,status:'running',startedAt:now(),attempts:same?(prior.attempts||0)+1:1,previousRejection};});
 engine.job('render',{id}).then(()=>store.update(s=>{s.productionPreparation.status='ready';s.productionPreparation.finishedAt=now();if(env.SHORTSLOOP_MUSIC_MODE==='licensed')resumeReviewedPreparation(s);if(env.SHORTSLOOP_MUSIC_MODE==='shorts-library'&&!s.automation?.userPaused){s.automation??={};s.automation.phase='waiting';s.automation.reason='品質確認済みです。YouTubeアプリで希望曲を追加して公開できます。';}})).catch(e=>{
  store.update(s=>{s.productionPreparation.status=e.code==='PIPELINE_BUSY'?'waiting':'failed';s.productionPreparation.errorCode=e.code||null;s.productionPreparation.error=e.message;if(e.code==='PIPELINE_BUSY')s.productionPreparation.attempts--;});
  console.error('Production preparation stopped:',e.message);
 }).finally(onSettled);
 return true;
}
