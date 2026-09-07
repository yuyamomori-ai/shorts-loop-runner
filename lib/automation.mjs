// Durable intent: authorizing YouTube starts work, but never clears a safety stop.
export function initializeAutomation(state, defaults={}) {
  if (state.automation) {
    const a=state.automation;
    if(defaults.enabled===true&&!a.enrolledFromEnvironment){a.enabled=true;a.enrolledFromEnvironment=true;if(!a.userPaused&&a.phase!=='attention')Object.assign(state.settings,{mode:'auto',privacy:'public',paused:true});}
    if(defaults.targetEmail&&defaults.targetEmail!==a.targetEmail){a.targetEmail=defaults.targetEmail;delete a.verifiedEmail;state.settings.paused=true;if(!a.userPaused&&a.phase!=='attention')a.phase='waiting';}
    return;
  }
  state.automation={enabled:defaults.enabled===true,enrolledFromEnvironment:defaults.enabled===true,targetEmail:defaults.targetEmail||'',phase:'waiting',userPaused:false,reason:null};
  if (state.automation.enabled) Object.assign(state.settings,{mode:'auto',privacy:'public',paused:true});
}
export function automationReadiness(state,caps) {
  const a=state.automation||{};
  const checks=[
    {key:'server',label:'動かし続けるサーバー',ready:!!caps.scheduler&&!!caps.renderer},
    {key:'ai',label:'AIによる企画・音声・確認',ready:!!caps.ai},
    {key:'google',label:'Google接続の準備',ready:!!caps.oauthConfigured},
    {key:'youtube',label:'YouTubeへのアクセス許可',ready:!!caps.youtube},
    {key:'account',label:'投稿するアカウントの確認',ready:!a.targetEmail||!!a.verifiedEmail&&a.verifiedEmail.toLowerCase()===a.targetEmail.toLowerCase()},
    {key:'public',label:'YouTube APIからの公開投稿',ready:state.settings.privacy==='private'||!!caps.publicApproved}
  ];
  const missing=checks.filter(c=>!c.ready);
  return {checks,missing,ready:missing.length===0,learningReady:!!caps.derivedApproved};
}
export function startWhenReady(state,caps,at=new Date().toISOString()) {
  const a=state.automation;
  if(!a?.enabled||a.userPaused||['attention','paused'].includes(a.phase))return false;
  if(!automationReadiness(state,caps).ready)return false;
  if(a.phase==='running'&&!state.settings.paused)return false;
  state.settings.mode='auto';state.settings.paused=false;
  Object.assign(a,{phase:'running',startedAt:a.startedAt||at,reason:null});
  return true;
}
export function pauseAutomation(state,reason,user=false) {
  state.settings.paused=true;
  if(state.automation)Object.assign(state.automation,{phase:user?'paused':'attention',userPaused:user,reason});
}
