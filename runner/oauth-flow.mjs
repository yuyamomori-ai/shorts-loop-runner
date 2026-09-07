import {randomBytes,createHash} from 'node:crypto';
import {assert} from '../lib/core.mjs';
import {googleClient,writeSecret,readSecret} from './vault.mjs';
export const saveToken=(dir,token)=>writeSecret(dir,'youtube-token.json',token);
export const readToken=dir=>readSecret(dir,'youtube-token.json');
export class OAuthFlow {
 constructor(dir){this.dir=dir;this.pending=new Map();}
 config(){return googleClient(this.dir);}
 start(base,targetEmail=''){
  assert(this.config(),'Google接続の準備が必要です。接続設定ファイルを登録してください。');const origin=new URL(base);assert(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname),'接続先はHTTPSにしてください。');
  const c=this.config(),state=randomBytes(24).toString('hex'),verifier=randomBytes(48).toString('base64url');const redirect=origin.origin+'/api/oauth/callback';
  this.pending.set(state,{verifier,redirect,targetEmail,expires:Date.now()+600000});for(const[k,v]of this.pending)if(v.expires<Date.now())this.pending.delete(k);
  const scopes=['openid','email','https://www.googleapis.com/auth/youtube.force-ssl','https://www.googleapis.com/auth/yt-analytics.readonly'];if(process.env.YOUTUBE_REVENUE_SCOPE==='true')scopes.push('https://www.googleapis.com/auth/yt-analytics-monetary.readonly');
  return 'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:c.client_id,redirect_uri:redirect,response_type:'code',scope:scopes.join(' '),access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',...(targetEmail?{login_hint:targetEmail}:{})});
 }
 async complete(params){
  const state=params.get('state'),p=this.pending.get(state);assert(p&&p.expires>Date.now(),'接続状態を確認できません。もう一度「YouTubeと接続」を選んでください。');this.pending.delete(state);assert(!params.has('error'),'YouTube接続がキャンセルされました。');const c=this.config();
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,code:params.get('code')||'',code_verifier:p.verifier,redirect_uri:p.redirect,grant_type:'authorization_code'})});const x=await r.json();assert(r.ok&&x.refresh_token&&x.access_token,'接続トークンを取得できません。Google Cloudの設定を確認してください。');const granted=new Set((x.scope||'').split(' '));assert(['https://www.googleapis.com/auth/youtube.force-ssl','https://www.googleapis.com/auth/yt-analytics.readonly'].every(s=>granted.has(s)),'動画投稿と分析の権限を両方許可してください。');const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${x.access_token}`},signal:AbortSignal.timeout(20000)});const user=await info.json();
  assert(info.ok&&user.email_verified===true&&typeof user.email==='string','Googleアカウントを確認できません。');
  assert(!p.targetEmail||user.email.toLowerCase()===p.targetEmail.toLowerCase(),'指定したGoogleアカウントと違います。指定アカウントで接続し直してください。');
  saveToken(this.dir,{refresh_token:x.refresh_token,scope:x.scope,email:user.email,authorizedAt:new Date().toISOString()});return {email:user.email};
 }
}
