import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configureConnections,readSecret,pexelsKey} from '../runner/vault.mjs';
import {resumePreparedVisualAfterStockConnection} from '../runner/preparation.mjs';

test('stock credentials are encrypted and merged without deleting OAuth or AI credentials',t=>{
 const dir=mkdtempSync(join(tmpdir(),'shortloop-stock-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const stock='synthetic-pexels-secret-for-test',ai='synthetic-openai-secret-for-test';
 configureConnections(dir,{openaiKey:ai,google:{client_id:'test.apps.googleusercontent.com',client_secret:'test-secret'}});configureConnections(dir,{pexelsKey:stock});
 assert(!readFileSync(join(dir,'connections.json'),'utf8').includes(stock));const saved=readSecret(dir,'connections.json');assert.equal(saved.pexelsKey,stock);assert.equal(saved.openaiKey,ai);assert.equal(saved.google.client_id,'test.apps.googleusercontent.com');assert.equal(pexelsKey(dir),process.env.PEXELS_API_KEY||stock);assert.throws(()=>configureConnections(dir,{pexelsKey:'bad\nkey'}));
});
test('new stock connection wakes only an unsent visual rejection, never a rights or factual stop',()=>{
 const v={id:'one',status:'blocked',qa:{facts:'passed'},error:'映像品質を確認できないため投稿を保留します。'},s={live:{videos:[v]},automation:{userPaused:false},productionPreparation:{requestId:'request',status:'failed'}},store={read:()=>structuredClone(s),update:fn=>fn(s)},env={SHORTSLOOP_PREPARE_VIDEO_ID:'one',SHORTSLOOP_PREPARE_REQUEST:'request'};
 assert.equal(resumePreparedVisualAfterStockConnection(store,env),true);assert.equal(s.productionPreparation.status,'waiting');
 s.productionPreparation.status='failed';v.qa.facts='failed';assert.equal(resumePreparedVisualAfterStockConnection(store,env),false);v.qa.facts='passed';v.risk='権利未確認';assert.equal(resumePreparedVisualAfterStockConnection(store,env),false);delete v.risk;s.automation.userPaused=true;assert.equal(resumePreparedVisualAfterStockConnection(store,env),false);
});

test('Type A searches with the saved stock key without requiring an environment variable',async t=>{
 const {Engine}=await import('../runner/engine.mjs');
 const dir=mkdtempSync(join(tmpdir(),'shortloop-stock-search-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));configureConnections(dir,{pexelsKey:'synthetic-vault-stock-credential'});
 const state={live:{assets:[],events:[],videos:[{id:'one',segments:[{visualQuery:'water bubbles macro',visualType:'mixed'}]}]}},store={directory:dir,read:()=>structuredClone(state),update:fn=>fn(state)};
 const prior=globalThis.fetch;let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.match(String(url),/^https:\/\/api\.pexels\.com\/videos\/search\?/);assert.equal(options.headers.Authorization,process.env.PEXELS_API_KEY||'synthetic-vault-stock-credential');return Response.json({videos:[]});};t.after(()=>{globalThis.fetch=prior;});
 await Engine.prototype.prepareAssets.call({store,ai:{}},'one');assert.equal(calls,1);await Engine.prototype.prepareAssets.call({store,ai:{}},'one');assert.equal(calls,1);
});
