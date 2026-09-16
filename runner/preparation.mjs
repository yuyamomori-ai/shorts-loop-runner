import {now,assert} from '../lib/core.mjs';
import {hash} from './providers.mjs';

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
 store.update(s=>{s.productionPreparation={requestId:request,videoId:id,status:'running',startedAt:now(),attempts:same?(prior.attempts||0)+1:1};});
 engine.job('render',{id}).then(()=>store.update(s=>{s.productionPreparation.status='ready';s.productionPreparation.finishedAt=now();if(env.SHORTSLOOP_MUSIC_MODE==='shorts-library'&&!s.automation?.userPaused){s.automation??={};s.automation.phase='waiting';s.automation.reason='品質確認済みです。YouTubeアプリで希望曲を追加して公開できます。';}})).catch(e=>{
  store.update(s=>{s.productionPreparation.status=e.code==='PIPELINE_BUSY'?'waiting':'failed';s.productionPreparation.errorCode=e.code||null;s.productionPreparation.error=e.message;if(e.code==='PIPELINE_BUSY')s.productionPreparation.attempts--;});
  console.error('Production preparation stopped:',e.message);
 }).finally(onSettled);
 return true;
}
