import {configureConnections} from './vault.mjs';
import {pauseAutomation} from '../lib/automation.mjs';
import {OAuthFlow} from './oauth-flow.mjs';
import {attachAsset} from './assets.mjs';
import {createServer} from 'node:http';
import {existsSync,readFileSync,createReadStream,statSync,writeFileSync} from 'node:fs';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {Store} from './store.mjs';
import {Engine} from './engine.mjs';
import {applyAction,assert,log,now} from '../lib/core.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(existsSync(resolve(ROOT,'.env')))process.loadEnvFile(resolve(ROOT,'.env'));
const HOST=process.env.HOST||'127.0.0.1',PORT=Number(process.env.PORT||8787),DATA=process.env.DATA_DIR||resolve(ROOT,'data');
if(!['127.0.0.1','localhost','::1'].includes(HOST)&&!process.env.ENGINE_TOKEN&&process.env.TRUST_LOOPBACK_PROXY!=='true')throw Error('外部公開にはENGINE_TOKENが必要です。');
const store=new Store(DATA),engine=new Engine(store),oauth=new OAuthFlow(store.directory);
store.update(s=>{for(const v of s.live.videos){if(v.status==='uploading'){if(v.uploadSession)v.status='approved';else{v.status='blocked';v.error='前回の送信結果を確認する必要があります。';pauseAutomation(s,v.error);}}if(v.status==='rendering'){v.status='blocked';v.error='前回の動画制作が中断しました。再生成してください。';pauseAutomation(s,'前回の動画制作が中断しました。動画を確認してください。');}}});
engine.housekeep();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.mp4':'video/mp4','.json':'application/json'};
const pump=()=>{if(engine.running)return;engine.tryAutoStart();if(!store.read().settings.paused)engine.job('tick').catch(()=>{});else engine.housekeep();};
const secureEqual=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const remote=process.env.ENGINE_TOKEN;
 const auth=secureEqual(req.headers.authorization,remote?`Bearer ${remote}`:'__never__');
 const local=!remote&&(process.env.TRUST_LOOPBACK_PROXY==='true'||['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))&&['localhost','127.0.0.1','[::1]'].includes((req.headers.host||'').split(':')[0]);
 // Cloud runner is an authenticated origin, including HTML/static/error routes.
 // Only a data-free GET health check is public; OAuth returns through the private Site.
 const health=req.method==='GET'&&url.pathname==='/healthz';
 if(!health&&!auth&&(remote||url.pathname.startsWith('/api/')&&!local)){res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify({error:'認証が必要です。'}));return;}
 if(req.method!=='GET'&&!auth){const origin=req.headers.origin;const expected=`http://${req.headers.host}`;if(origin!==expected){res.writeHead(403);res.end('Origin rejected');return;}}
 function json(x,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(x));}
 try{
  if(url.pathname==='/api/oauth/start'&&req.method==='GET'){const base=process.env.PUBLIC_BASE_URL||(auth?req.headers['x-shorts-site-origin']:null)||`http://${req.headers.host}`;res.writeHead(302,{Location:oauth.start(base,store.read().automation?.targetEmail),'Cache-Control':'no-store'});res.end();return;}
  if(url.pathname==='/api/oauth/callback'&&req.method==='GET'){const identity=await oauth.complete(url.searchParams);store.update(s=>{s.automation.verifiedEmail=identity.email;});await engine.channel();engine.tryAutoStart();queueMicrotask(pump);res.writeHead(302,{Location:'/', 'Cache-Control':'no-store'});res.end();return;}
  if(url.pathname.startsWith('/api/assets/')&&req.method==='POST'){const chunks=[];let size=0;for await(const c of req){size+=c.length;assert(size<100*1024*1024,'素材は100MB未満にしてください。');chunks.push(c);}await attachAsset(store,url.pathname.split('/').at(-1),Buffer.concat(chunks));json(engine.publicState());return;}
  if(url.pathname==='/healthz'&&req.method==='GET'){json({ok:true});return;}
  if(url.pathname==='/api/state'&&req.method==='GET'){json(engine.publicState());return;}
  if(url.pathname==='/api/export'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="shorts-loop-backup.json"');json(engine.publicState().state);return;}
  if(url.pathname.startsWith('/api/media/')&&req.method==='GET'){
   const id=url.pathname.split('/').at(-1);const v=store.read().live.videos.find(x=>x.id===id);assert(v?.videoFile&&existsSync(v.videoFile),'動画はまだ生成されていません。');const file=resolve(v.videoFile);assert(file.startsWith(resolve(store.directory,'media')+'/'),'動画パスが不正です。');
   const size=statSync(file).size;const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);let start=range?Number(range[1]):0,end=range&&range[2]?Number(range[2]):size-1;assert(start<=end&&end<size,'Rangeが不正です。');res.writeHead(range?206:200,{'Content-Type':'video/mp4','Content-Length':end-start+1,'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});createReadStream(file,{start,end}).pipe(res);return;
  }
  if(url.pathname==='/api/action'&&req.method==='POST'){
   const chunks=[];let n=0;for await(const c of req){n+=c.length;assert(n<2000000,'入力サイズが大きすぎます。');chunks.push(c);}const b=JSON.parse(Buffer.concat(chunks));
   if(b.action==='configureConnections'){assert(b.dataset==='live','実チャンネルで操作してください。');assert(!engine.running,'制作中です。完了後に接続設定を変更してください。');configureConnections(store.directory,b.payload||{});engine.ai=new (engine.ai.constructor)(store);queueMicrotask(pump);json({...engine.publicState(),message:'接続情報を安全に保存しました。'});return;}
   if(['generate','render','preview','upload','sync','tick','channel','schedulePublished','discoverAsset'].includes(b.action)){
    assert(b.dataset==='live','検証データに対して外部APIを実行できません。');assert(!engine.running,'別の制作処理が進行中です。');
    // Queue before responding; errors and completion are persisted for polling clients.
    engine.job(b.action,b.payload).catch(e=>console.error('Pipeline stopped:',e.message));
    json({...engine.publicState(),message:'処理を開始しました。進行状況は画面に反映されます。'});return;
   }
   if(b.action==='resume'){assert(b.dataset==='live','実チャンネルで操作してください。');const c=engine.capabilities();assert(c.ai&&c.youtube&&c.renderer,'AI・YouTube・FFmpegの準備が必要です。');if(store.read().settings.mode==='review'){store.update(s=>{s.settings.paused=false;Object.assign(s.automation,{enabled:false,userPaused:false,phase:'running',reason:null});});}else{store.update(s=>{s.automation.enabled=true;s.automation.userPaused=false;s.automation.phase='waiting';s.automation.reason=null;});assert(engine.tryAutoStart(),'公開投稿・アカウントの準備を確認してください。');}queueMicrotask(pump);}
   else if(b.action==='disconnect')await engine.disconnect();
   else store.update(s=>applyAction(s,b.action,b.payload,b.dataset));
   json(engine.publicState());return;
  }
  if(req.method!=='GET'){json({error:'操作が見つかりません。'},404);return;}
  const publicRoot=resolve(ROOT,'local-dist');let file=resolve(publicRoot,'.'+decodeURIComponent(url.pathname));assert(file.startsWith(publicRoot+'/')||file===publicRoot,'パスが不正です。');if(!existsSync(file)||statSync(file).isDirectory())file=resolve(publicRoot,'index.html');assert(existsSync(file),'画面を先にビルドしてください。npm run build:local');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self'; frame-ancestors 'none'"});createReadStream(file).pipe(res);
 }catch(e){json({error:e.message},400);}
});
server.listen(PORT,HOST,()=>{console.log(`Shorts Loop: http://localhost:${PORT}`);pump();});
const timer=setInterval(pump,60000);
let closing=false;function shutdown(){if(closing)return;closing=true;clearInterval(timer);server.close();const t=setInterval(()=>{if(!engine.running){clearInterval(t);store.close();process.exit(0);}},200);setTimeout(()=>process.exit(0),25000).unref();}process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
