import {saveToken} from './oauth-flow.mjs';
// Run on the user's computer; never paste OAuth tokens into ChatGPT.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');if(existsSync(resolve(root,'.env')))process.loadEnvFile(resolve(root,'.env'));
const dir=resolve(process.env.DATA_DIR||resolve(root,'data'));mkdirSync(dir,{recursive:true,mode:0o700});
const config=JSON.parse(readFileSync(resolve(dir,'client_secret.json')));const client=config.installed;
if(!client)throw new Error('デスクトップアプリ用OAuthクライアントを使用してください。');
const state=randomBytes(24).toString('hex'),verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
let redirect;
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1');if(u.pathname!=='/oauth/callback'){res.writeHead(404);res.end();return;}
  const actual=Buffer.from(u.searchParams.get('state')||''),expected=Buffer.from(state);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('認可状態を確認できません。');
  if(u.searchParams.has('error'))throw Error('認可がキャンセルされました。');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.client_id,client_secret:client.client_secret,code:u.searchParams.get('code')||'',code_verifier:verifier,redirect_uri:redirect,grant_type:'authorization_code'}),signal:AbortSignal.timeout(30000)});
  const token=await r.json();if(!r.ok||!token.refresh_token)throw Error('更新トークンを取得できませんでした。認可を再実行してください。');
  saveToken(dir,{refresh_token:token.refresh_token,scope:token.scope,authorizedAt:new Date().toISOString()});res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<h1>YouTubeに接続しました</h1><p>このタブを閉じ、Shorts Loopの画面を再読み込みしてください。</p>');server.close();clearTimeout(timer);
 }catch(e){res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end(e.message);}
});
const timer=setTimeout(()=>{server.close();console.error('認可の制限時間を過ぎました。もう一度実行してください。');},600000);
server.listen(0,'127.0.0.1',()=>{
 redirect=`http://127.0.0.1:${server.address().port}/oauth/callback`;
 const q=new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly',access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'});
 console.log('自分のブラウザで次のURLを開き、運用するYouTubeチャンネルを認可してください。\nhttps://accounts.google.com/o/oauth2/v2/auth?'+q);
});
