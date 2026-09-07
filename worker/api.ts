import {initializeAutomation} from '../lib/automation.mjs';
import { initialState, applyAction, migrateState } from '../lib/core.mjs';
export async function api(request: Request, env: any): Promise<Response> {
 const url=new URL(request.url);const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return Response.json({error:'サインインが必要です。'},{status:401});
 if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)return Response.json({error:'送信元を確認できません。'},{status:403});
 if(env.ENGINE_URL&&env.ENGINE_TOKEN){
   const base=new URL(env.ENGINE_URL);if(base.protocol!=='https:')throw new Error('実行アプリはHTTPSで接続してください。');
   const upstream=await fetch(new URL(url.pathname+url.search,base),{method:request.method,headers:{'X-Shorts-Site-Origin':url.origin,Authorization:`Bearer ${env.ENGINE_TOKEN}`,'Content-Type':request.headers.get('content-type')||'application/json',...(request.headers.get('range')?{'Range':request.headers.get('range')!}:{})},body:request.method==='GET'?undefined:request.body,redirect:'manual'});
   return new Response(upstream.body,{status:upstream.status,headers:{'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store',...Object.fromEntries(['content-length','content-range','accept-ranges','content-disposition'].map(k=>[k,upstream.headers.get(k)]).filter((x):x is [string,string]=>x[1]!==null)),...(upstream.headers.get('location')?{'Location':upstream.headers.get('location')!}:{})}});
 }
 try{
   let row=await env.DB.prepare('SELECT data, revision FROM workspaces WHERE owner = ?').bind(owner).first();
   if(!row){await env.DB.prepare('INSERT OR IGNORE INTO workspaces (owner,data,revision,updated_at) VALUES (?,?,0,?)').bind(owner,JSON.stringify(initialState()),new Date().toISOString()).run();row=await env.DB.prepare('SELECT data,revision FROM workspaces WHERE owner = ?').bind(owner).first();}
   const state=migrateState(JSON.parse(row.data));initializeAutomation(state,{enabled:env.AUTO_START_ON_CONNECT==='true',targetEmail:env.YOUTUBE_TARGET_EMAIL||''});
   const capabilities={runtime:'hosted',ai:false,oauthConfigured:false,youtube:false,renderer:false,scheduler:false,derivedApproved:false,publicApproved:false};
   if(request.method==='GET'&&url.pathname==='/api/state')return Response.json({state,capabilities},{headers:{'Cache-Control':'no-store'}});
   if(request.method==='GET'&&url.pathname==='/api/export')return Response.json(state,{headers:{'Content-Disposition':'attachment; filename="shorts-loop-backup.json"','Cache-Control':'no-store'}});
   if(request.method==='POST'&&url.pathname==='/api/action'){
     const raw=await request.text();if(raw.length>2000000)throw new Error('入力が大きすぎます。');const b=JSON.parse(raw);if(b.action==='configureConnections')return Response.json({error:'動かし続けるサーバーが未接続です。接続後に設定できます。'},{status:503});
     applyAction(state,b.action,b.payload,b.dataset);
     const r=await env.DB.prepare('UPDATE workspaces SET data=?, revision=revision+1, updated_at=? WHERE owner=? AND revision=?').bind(JSON.stringify(state),new Date().toISOString(),owner,row.revision).run();
     if(!r.meta.changes)return Response.json({error:'別の操作が先に保存されました。再読み込みしてください。'},{status:409});
     return Response.json({state,capabilities});
   }
   return Response.json({error:'操作が見つかりません。'},{status:404});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'保存できませんでした。再試行してください。'},{status:400});}
}
