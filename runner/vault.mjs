import {readFileSync,writeFileSync,existsSync,renameSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {assert} from '../lib/core.mjs';
function key(dir){
  if(process.env.TOKEN_ENCRYPTION_KEY){const k=Buffer.from(process.env.TOKEN_ENCRYPTION_KEY,'base64');assert(k.length===32,'暗号化の設定を確認してください。');return k;}
  const p=resolve(dir,'token-encryption.key');if(!existsSync(p))writeFileSync(p,randomBytes(32),{mode:0o600,flag:'wx'});return readFileSync(p);
}
export function writeSecret(dir,name,value){
  assert(['connections.json','youtube-token.json'].includes(name),'保存先が不正です。');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(dir),iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);const p=resolve(dir,name);
  writeFileSync(p+'.tmp',JSON.stringify({v:2,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600});renameSync(p+'.tmp',p);try{chmodSync(p,0o600);}catch{}
}
export function readSecret(dir,name){
  const p=resolve(dir,name);if(!existsSync(p))return null;
  const x=JSON.parse(readFileSync(p));
  if(name==='youtube-token.json'&&x.refresh_token){writeSecret(dir,name,x);return x;}
  const d=createDecipheriv('aes-256-gcm',key(dir),Buffer.from(x.iv,'base64'));d.setAuthTag(Buffer.from(x.tag,'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(x.data,'base64')),d.final()]).toString());
}
export function googleClient(dir){
  if(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET)return {client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET};
  const saved=readSecret(dir,'connections.json');if(saved?.google)return saved.google;
  const p=resolve(dir,'client_secret.json');if(existsSync(p)){const x=JSON.parse(readFileSync(p));return x.web||x.installed;}
  return null;
}
export function aiKey(dir){return process.env.OPENAI_API_KEY||readSecret(dir,'connections.json')?.openaiKey||'';}
export function configureConnections(dir,input){
  const saved=readSecret(dir,'connections.json')||{};
  if(input.openaiKey){assert(typeof input.openaiKey==='string'&&input.openaiKey.length>=20&&input.openaiKey.length<=1000&&!/\s/.test(input.openaiKey),'AIキーの形式を確認してください。');saved.openaiKey=input.openaiKey;}
  if(input.google){const c=input.google.web||input.google.installed||input.google;assert(typeof c.client_id==='string'&&c.client_id.endsWith('.apps.googleusercontent.com')&&typeof c.client_secret==='string'&&c.client_secret.length>5,'Googleから取得した接続設定ファイルを選んでください。');saved.google={client_id:c.client_id,client_secret:c.client_secret};}
  writeSecret(dir,'connections.json',saved);
}
