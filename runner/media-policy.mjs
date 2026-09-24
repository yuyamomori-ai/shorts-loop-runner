import {licensedMusicValid,musicMode} from './licensed-music.mjs';
// Upgrade only unsent, fact-checked production candidates. Never mutate a
// resumable upload, a posted video, a rejected item, or a private preview.
export function requeueOutdatedMedia(state,{licensed=musicMode()==='licensed',generated=process.env.SHORTSLOOP_GENERATED_IMAGES!=='false'}={}){
 if(state.settings.mode!=='auto')return [];
 const ids=[];
 for(const v of state.live.videos){
  if(!['review','approved'].includes(v.status)||v.privacy!==state.settings.privacy||v.youtubeId||v.uploadIntent||v.uploadSession||v.risk||v.qa?.facts!=='passed')continue;
  if((!licensed||licensedMusicValid(v.mediaManifest?.musicEvidence))&&(!generated||v.mediaManifest?.generatedImageCount>0))continue;
  v.status='draft';v.revision=(v.revision||0)+1;v.approvedRevision=null;delete v.approvedDigest;delete v.approvedAt;delete v.autoApproved;v.qa.technical='pending';v.qa.visual='pending';v.mediaPolicyRefresh=true;ids.push(v.id);
 }
 return ids;
}
