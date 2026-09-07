import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {api} from '../worker/api.ts';
test('hosted API applies migrations, persists separate owner data and denies untrusted writes',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_optimal_tattoo.sql','utf8'));db.exec(readFileSync('drizzle/0001_flaky_yellow_claw.sql','utf8'));
 const env={DB:{prepare(sql){let params=[];return {bind(...xs){params=xs;return this;},async first(){return db.prepare(sql).get(...params)||null;},async run(){const r=db.prepare(sql).run(...params);return {meta:{changes:r.changes}};}};}}};
 const req=(owner,action,origin='https://studio.example')=>new Request('https://studio.example/api/'+(action?'action':'state'),{method:action?'POST':'GET',headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),Origin:origin,'Content-Type':'application/json'},...(action?{body:JSON.stringify({action,payload:{count:2},dataset:'live'})}:{})});
 try{assert.equal((await api(req(null),env)).status,401);assert.equal((await api(req('owner','plan','https://bad.example'),env)).status,403);let r=await api(req('owner','plan'),env);assert.equal(r.status,200);assert.equal((await r.json()).state.live.videos.length,2);assert.equal((await (await api(req('other'),env)).json()).state.live.videos.length,0);const read=await(await api(req('owner'),env)).json();assert.equal(read.state.live.videos.length,2);assert.equal(read.state.version,2);}finally{db.close();}
});
