import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('production server starts, serves the UI, persists API actions, and rejects cross-origin writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'shorts-http-'));const child=spawn(process.execPath,['runner/server.mjs'],{env:{...process.env,PORT:'18787',HOST:'127.0.0.1',DATA_DIR:dir,OPENAI_API_KEY:'',ENGINE_TOKEN:'',TRUST_LOOPBACK_PROXY:'false'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((res,rej)=>{const t=setTimeout(()=>rej(Error('server startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(t);res();});child.once('exit',code=>rej(Error('server exited '+code)));});
 const base='http://127.0.0.1:18787';assert.equal((await fetch(base)).status,200);
 let r=await fetch(base+'/api/action',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'plan',payload:{count:2},dataset:'live'})});assert.equal(r.status,200);let x=await r.json();assert.equal(x.state.live.videos.length,2);
 r=await fetch(base+'/api/state');x=await r.json();assert.equal(x.state.live.videos.length,2);assert.equal(x.capabilities.runtime,'local');
 r=await fetch(base+'/api/action',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({action:'pause'})});assert.equal(r.status,403);
 r=await fetch(base+'/api/action',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'demo',dataset:'demo'})});x=await r.json();assert.equal(x.state.demo.videos.length,24);assert.equal(x.state.live.videos.length,2);
 }finally{child.kill('SIGINT');await new Promise(r=>child.once('exit',r));rmSync(dir,{recursive:true,force:true});}
});
test('cloud origin rejects all unauthenticated routes even with loopback Host, except a data-free health check',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'shorts-cloud-http-'));const secret='test-transport-secret';
 mkdirSync(join(dir,'validation','export-test'),{recursive:true});writeFileSync(join(dir,'validation','export-test','report.json'),JSON.stringify({runId:'export-test',status:'failed',tests:[]}));
 const child=spawn(process.execPath,['runner/server.mjs'],{env:{...process.env,PORT:'18788',HOST:'0.0.0.0',DATA_DIR:dir,OPENAI_API_KEY:'',ENGINE_TOKEN:secret,TRUST_LOOPBACK_PROXY:'false',SHORTSLOOP_VALIDATION_TOKEN:'test-export-token',SHORTSLOOP_VALIDATION_ACCESS_EXPIRES:new Date(Date.now()+60000).toISOString()},stdio:['ignore','pipe','pipe']});
 try{await new Promise((res,rej)=>{const t=setTimeout(()=>rej(Error('server startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(t);res();});child.once('exit',code=>rej(Error('server exited '+code)));});
 const base='http://127.0.0.1:18788';
 for(const route of ['/','/assets/index.js','/api/state','/api/export','/api/oauth/start','/api/oauth/callback?code=test','/api/media/test','/unknown']){
   const r=await fetch(base+route,{redirect:'manual'});assert.equal(r.status,401,route);assert.deepEqual(await r.json(),{error:'認証が必要です。'});
 }
 assert.deepEqual(await (await fetch(base+'/healthz')).json(),{ok:true});
 assert.equal((await fetch(base+'/healthz',{method:'POST'})).status,401);
 assert.equal((await fetch(base+'/api/state',{headers:{Authorization:'Bearer wrong'}})).status,401);
 const exportHeaders={Authorization:'Bearer test-export-token'};
 assert.equal((await fetch(base+'/api/validation/export-test/report.json',{headers:exportHeaders})).status,200);
 for(const route of ['/api/state','/api/export','/api/media/existing','/api/oauth/start'])assert.equal((await fetch(base+route,{headers:exportHeaders})).status,401,route);
 assert.equal((await fetch(base+'/api/action',{method:'POST',headers:exportHeaders,body:'{}'})).status,401);
 assert.equal((await fetch(base+'/api/validation/export-test/secret.json',{headers:exportHeaders})).status,404);
 const r=await fetch(base+'/api/state',{headers:{Authorization:`Bearer ${secret}`}});assert.equal(r.status,200);assert.equal((await r.json()).capabilities.scheduler,true);
 }finally{child.kill('SIGINT');await new Promise(r=>child.once('exit',r));rmSync(dir,{recursive:true,force:true});}
});
