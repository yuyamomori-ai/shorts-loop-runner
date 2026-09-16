import {now} from '../lib/core.mjs';

// Deployment overlap must wait for the existing worker's lease, never steal it.
export function startPreparation(engine,{env=process.env,onSettled=()=>{}}={}) {
 const store=engine.store,id=env.SHORTSLOOP_PREPARE_VIDEO_ID,request=env.SHORTSLOOP_PREPARE_REQUEST;
 if(!id||!request||![id,request].every(x=>/^[a-zA-Z0-9-]{1,80}$/.test(x)))return false;
 const prior=store.read().productionPreparation,same=prior?.requestId===request;
 const waiting=same&&(prior.status==='waiting'||prior.errorCode==='PIPELINE_BUSY'||prior.error==='別の制作・送信処理が実行中です。');
 if(same&&!waiting&&!(prior.status==='running'&&(prior.attempts||0)<2))return false;
 const lease=store.db.prepare('SELECT expires FROM leases WHERE name=?').get('pipeline');
 if(engine.running||lease?.expires>Date.now())return true;
 store.update(s=>{s.productionPreparation={requestId:request,videoId:id,status:'running',startedAt:now(),attempts:same?(prior.attempts||0)+1:1};});
 engine.job('render',{id}).then(()=>store.update(s=>{s.productionPreparation.status='ready';s.productionPreparation.finishedAt=now();})).catch(e=>{
  store.update(s=>{s.productionPreparation.status=e.code==='PIPELINE_BUSY'?'waiting':'failed';s.productionPreparation.errorCode=e.code||null;s.productionPreparation.error=e.message;if(e.code==='PIPELINE_BUSY')s.productionPreparation.attempts--;});
  console.error('Production preparation stopped:',e.message);
 }).finally(onSettled);
 return true;
}
