// Explicitly select public diagnostic fields. Never serialize the database,
// channel identity, source bodies, paths, credentials or upload-session URLs.
export function operationalStatus(state,caps,at=new Date().toISOString()) {
 const a=state.automation||{},videos=state.live?.videos||[];
 return {
  at,phase:a.phase||'waiting',paused:state.settings.paused,mode:state.settings.mode,privacy:state.settings.privacy,
  youtube:!!caps.youtube,reconnectRequired:!!a.youtubeReconnectRequired,
  ai:!!caps.ai,renderer:!!caps.renderer,scheduler:!!caps.scheduler,
  musicMode:caps.musicMode,generatedImages:!!caps.generatedImages,
  productionLearning:!!caps.productionLearning,performanceLearning:!!caps.derivedApproved,
  budget:caps.budget?{totalJpy:caps.budget.totalJpy,aiJpy:caps.budget.aiJpy,managedUsedJpy:caps.budget.managedUsedJpy,remainingJpy:caps.budget.remainingJpy,blocked:caps.budget.blocked}:null,
  videos:videos.filter(v=>!v.synthetic&&(['draft','rendering','review','approved','uploading'].includes(v.status)||v.publicVerifiedAt)).slice(0,8).map(v=>({
   id:v.id,title:v.title,status:v.status,youtubeId:v.youtubeId||null,publicVerifiedAt:v.publicVerifiedAt||null,
   plannedAt:v.plannedAt||null,publishAt:v.publishAt||null,
   duration:v.mediaManifest?.duration??null,scenes:v.mediaManifest?.sceneCount??null,
   diagrams:v.mediaManifest?.explanationCount??null,images:v.mediaManifest?.generatedImageCount??null,
   narration:v.mediaManifest?.narrationVerified===true,music:v.mediaManifest?.musicEvidence?.title||null,
   coverLuma:v.mediaManifest?.cover?.meanLuma??null,
   facts:v.qa?.facts==='passed',rights:v.qa?.rights==='passed',visual:v.visualQa?.passed===true
  }))
 };
}
