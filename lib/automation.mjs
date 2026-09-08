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
    {key:'public',label:'YouTubeへの公開投稿リクエスト',ready:state.settings.privacy==='private'||!!caps.publicApproved||!!a.publicUploadRequested}
  ];
  const missing=checks.filter(c=>!c.ready);
  return {checks,missing,ready:missing.length===0,learningReady:!!caps.derivedApproved};
}
// An explicit, versioned owner request is applied once. Later pauses survive restarts.
// Requesting public visibility does not claim that Google approved an API audit.
export function requestPublicAutopilot(state,requestId) {
  if(!requestId||!/^[a-zA-Z0-9-]{1,80}$/.test(requestId)||state.automation?.publicRequestId===requestId)return false;
  initializeAutomation(state);
  const a=state.automation;
  Object.assign(a,{enabled:true,publicUploadRequested:true,publicRequestId:requestId,firstPublicPending:true});
  Object.assign(state.settings,{mode:'auto',privacy:'public'});
  const billing=/credit_balance_exhausted|insufficient_quota|billing_hard_limit|残高|利用上限/.test(a.reason||'');
  const editable=a.reason==='冒頭を1〜2秒で読める長さにできませんでした。';
  if(a.phase!=='attention'||billing||editable){Object.assign(a,{userPaused:false,phase:'waiting',reason:null});state.settings.paused=true;delete a.retryAt;}
  return true;
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
