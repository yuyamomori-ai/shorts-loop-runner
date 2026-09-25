import {blockers,log,now} from '../lib/core.mjs';

// Rebook only unsent automatic work. A resumable/uncertain upload must keep its
// original intent, and manual approvals must never be silently changed.
export function recoverExpiredSchedules(state,reserveSchedule,at=Date.now()) {
 if(state.settings.mode!=='auto'||state.settings.paused||state.settings.privacy!=='public'||!state.automation?.publicUploadRequested||state.automation.userPaused)return [];
 const changed=[];
 for(const v of state.live.videos){
  if(!['review','approved'].includes(v.status)||v.privacy!=='public'||!v.publishAt||Date.parse(v.publishAt)>at+60000)continue;
  if(!Number.isFinite(Date.parse(v.publishAt))||v.youtubeId||v.uploadIntent||v.uploadSession||v.risk||blockers(v,true).length)continue;
  if(v.status==='approved'&&!v.autoApproved)continue;
  const previous=v.publishAt;
  const candidate={...v,publishAt:null,plannedAt:null};
  reserveSchedule({...state,automation:{...state.automation,firstPublicPending:false}},candidate);
  // Lack of a free slot is not permission to publish immediately.
  if(!Number.isFinite(Date.parse(candidate.publishAt))||Date.parse(candidate.publishAt)<=at+60000)continue;
  v.publishAt=candidate.publishAt;v.plannedAt=candidate.plannedAt;v.hour=candidate.hour;
  v.status='review';v.revision=(v.revision||0)+1;v.approvedRevision=null;
  delete v.approvedDigest;delete v.approvedAt;delete v.autoApproved;
  v.scheduleRecovery={at:now(),previous,next:v.publishAt};changed.push(v.id);
  log(state.live,'schedule-recovery',`「${v.title}」の期限切れ予約を次の空き枠へ移動。品質確認と承認をやり直します。`);
 }
 return changed;
}
