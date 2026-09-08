import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState,applyAction} from '../lib/core.mjs';
import {initializeAutomation,startWhenReady,automationReadiness,requestPublicAutopilot} from '../lib/automation.mjs';
import {configureConnections,googleClient,aiKey} from '../runner/vault.mjs';
import {OAuthFlow,readToken} from '../runner/oauth-flow.mjs';
import {Store} from '../runner/store.mjs';
import {Engine} from '../runner/engine.mjs';
const ready={ai:true,renderer:true,scheduler:true,oauthConfigured:true,youtube:true,publicApproved:true,derivedApproved:true};
const armed=()=>{const s=initialState();initializeAutomation(s,{enabled:true,targetEmail:'creator@example.com'});return s;};
test('public autopilot request applies once, preserves safety stops and never invents API audit approval',()=>{
 const s=armed();s.automation.verifiedEmail='creator@example.com';applyAction(s,'pause');
 assert(requestPublicAutopilot(s,'owner-request-1'));assert.equal(s.settings.privacy,'public');assert.equal(s.settings.mode,'auto');assert.equal(s.settings.publicApproved,false);
 assert(startWhenReady(s,{...ready,publicApproved:false}));applyAction(s,'pause');
 assert.equal(requestPublicAutopilot(s,'owner-request-1'),false);assert.equal(startWhenReady(s,ready),false);
 Object.assign(s.automation,{phase:'attention',reason:'著作権確認に失敗',userPaused:false});requestPublicAutopilot(s,'owner-request-2');assert.equal(startWhenReady(s,ready),false);
 s.automation.reason='外部API 429: credit_balance_exhausted';requestPublicAutopilot(s,'owner-request-3');assert(startWhenReady(s,{...ready,publicApproved:false}));
});
test('public upload responses must confirm visibility; private fallback preserves ID and stops without reupload',()=>{
 const dir=mkdtempSync(join(tmpdir(),'loop-public-')),store=new Store(dir),engine=new Engine(store);
 try{store.update(s=>{requestPublicAutopilot(s,'public-test');s.live.videos.push({id:'one',title:'one',privacy:'public',initialPublicRequestId:'public-test'},{id:'two',title:'two',privacy:'public'});});
 engine.completeUpload('one',{id:'youtube-one',status:{privacyStatus:'public'}});let s=store.read();assert.equal(s.live.videos[0].everPublic,true);assert.equal(s.automation.firstPublicPending,false);
 engine.completeUpload('two',{id:'youtube-two',status:{privacyStatus:'private'}});s=store.read();assert.equal(s.live.videos[1].youtubeId,'youtube-two');assert.equal(s.live.videos[1].status,'blocked');assert.equal(s.automation.phase,'attention');assert.equal(s.settings.paused,true);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('billing exhaustion retries conservatively and resumes after recovery',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'loop-billing-')),store=new Store(dir),engine=new Engine(store);
 try{store.update(s=>{s.settings.paused=false;s.automation.phase='running';});engine.tick=async()=>{throw Object.assign(Error('credits'),{code:'AI_BILLING',status:429});};await assert.rejects(engine.job('tick'));
 let s=store.read();assert.equal(s.settings.paused,false);assert(Date.parse(s.automation.retryAt)-Date.now()>5.9*3600000);
 store.update(s=>{s.automation.retryAt=new Date(0).toISOString();});engine.tick=async()=>{};await engine.job('tick');s=store.read();assert.equal(s.automation.retryAt,undefined);assert.equal(s.automation.reason,null);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('OAuth completion starts the loop without a second start action',()=>{const s=armed();s.automation.verifiedEmail='creator@example.com';assert(startWhenReady(s,ready));assert.equal(s.settings.paused,false);assert.equal(s.settings.mode,'auto');assert.equal(s.settings.privacy,'public');assert.equal(startWhenReady(s,ready),false);});
test('email text alone, absent runtime, and wrong account never start posting',()=>{for(const change of [{},{verifiedEmail:'other@example.com'}]){const s=armed();Object.assign(s.automation,change);assert.equal(startWhenReady(s,ready),false);}const s=armed();s.automation.verifiedEmail='creator@example.com';assert.equal(startWhenReady(s,{...ready,scheduler:false}),false);assert(automationReadiness(s,{...ready,scheduler:false}).missing.some(x=>x.key==='server'));});
test('manual pause survives reconnection and state reinitialization',()=>{const s=armed();s.automation.verifiedEmail='creator@example.com';startWhenReady(s,ready);applyAction(s,'pause');initializeAutomation(s,{enabled:true});assert.equal(startWhenReady(s,ready),false);assert.equal(s.automation.userPaused,true);});
test('encrypted connection settings never contain plaintext credentials',()=>{const dir=mkdtempSync(join(tmpdir(),'loop-vault-'));try{configureConnections(dir,{openaiKey:'test-key-12345678901234567890',google:{web:{client_id:'test.apps.googleusercontent.com',client_secret:'test-client-secret'}}});const disk=readFileSync(join(dir,'connections.json'),'utf8');assert(!disk.includes('test-key'));assert(!disk.includes('test-client-secret'));assert.equal(aiKey(dir),'test-key-12345678901234567890');assert.equal(googleClient(dir).client_id,'test.apps.googleusercontent.com');}finally{rmSync(dir,{recursive:true,force:true});}});
test('OAuth requests the named account and rejects a different verified identity',async()=>{const dir=mkdtempSync(join(tmpdir(),'loop-identity-'));const old=globalThis.fetch;try{configureConnections(dir,{google:{client_id:'test.apps.googleusercontent.com',client_secret:'test-secret'}});const flow=new OAuthFlow(dir),url=new URL(flow.start('https://studio.example','creator@example.com'));assert.equal(url.searchParams.get('login_hint'),'creator@example.com');assert(url.searchParams.get('scope').includes('openid'));globalThis.fetch=async u=>Response.json(String(u).endsWith('/token')?{refresh_token:'test-refresh',access_token:'test-access',scope:'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly'}:{email_verified:true,email:'wrong@example.com'});await assert.rejects(flow.complete(new URLSearchParams({state:url.searchParams.get('state'),code:'test-code'})),/違います/);assert.equal(existsSync(join(dir,'youtube-token.json')),false);await assert.rejects(flow.complete(new URLSearchParams({state:url.searchParams.get('state'),code:'test-code'})));}finally{globalThis.fetch=old;rmSync(dir,{recursive:true,force:true});}});
test('successful OAuth retains verified account and encrypted refresh token',async()=>{const dir=mkdtempSync(join(tmpdir(),'loop-oauth-ok-'));const old=globalThis.fetch;try{configureConnections(dir,{google:{client_id:'test.apps.googleusercontent.com',client_secret:'test-secret'}});const flow=new OAuthFlow(dir),url=new URL(flow.start('https://studio.example','creator@example.com'));globalThis.fetch=async u=>Response.json(String(u).endsWith('/token')?{refresh_token:'test-refresh',access_token:'test-access',scope:'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly'}:{email_verified:true,email:'creator@example.com'});const result=await flow.complete(new URLSearchParams({state:url.searchParams.get('state'),code:'test-code'}));assert.equal(result.email,'creator@example.com');assert.equal(readToken(dir).email,result.email);assert(!readFileSync(join(dir,'youtube-token.json'),'utf8').includes('test-refresh'));}finally{globalThis.fetch=old;rmSync(dir,{recursive:true,force:true});}});
test('temporary server errors retry later while safety stops stay latched after restart',async()=>{const dir=mkdtempSync(join(tmpdir(),'loop-retry-'));let store=new Store(dir);try{let e=new Engine(store);store.update(s=>{s.automation.enabled=true;s.automation.phase='running';s.settings.paused=false;});e.tick=async()=>{throw Object.assign(Error('temporary'),{status:503});};await assert.rejects(e.job('tick'));assert.equal(store.read().settings.paused,false);assert(Date.parse(store.read().automation.retryAt)>Date.now());e.stop(Error('権利確認に失敗'));store.close();store=new Store(dir);e=new Engine(store);e.capabilities=()=>ready;assert.equal(e.tryAutoStart(),false);assert.equal(store.read().automation.phase,'attention');}finally{store.close();rmSync(dir,{recursive:true,force:true});}});

test('legacy missing-stock hold can recover once using sourced Type A without clearing rights failures',()=>{
 const dir=mkdtempSync(join(tmpdir(),'loop-stock-recovery-')),store=new Store(dir);
 try{store.update(s=>{initializeAutomation(s);Object.assign(s.automation,{publicUploadRequested:true,phase:'attention',reason:'TYPE Bには権利確認済みの素材、またはPEXELS_API_KEYが必要です。'});});new Engine(store);assert.equal(store.read().automation.phase,'waiting');assert(store.read().automation.visualFallbackRecovered);
 store.update(s=>{Object.assign(s.automation,{phase:'attention',reason:'著作権確認に失敗'});});new Engine(store);assert.equal(store.read().automation.phase,'attention');
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('public success is verified from YouTube processing status without uploading again',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'loop-public-status-')),store=new Store(dir),engine=new Engine(store);let calls=0;
 try{store.update(s=>{s.live.videos.push({id:'new',title:'new',privacy:'public',status:'published',youtubeId:'youtube-new'});});
 engine.youtube.request=async(path,params)=>{calls++;assert.equal(path,'videos');assert.equal(params.id,'youtube-new');return {items:[{id:'youtube-new',status:{privacyStatus:'public',uploadStatus:calls===1?'uploaded':'processed'},processingDetails:{processingStatus:calls===1?'processing':'succeeded'}}]};};
 await engine.confirmPublication('new');assert.equal(store.read().live.videos[0].publicVerifiedAt,undefined);
 await engine.confirmPublication('new');assert(store.read().live.videos[0].publicVerifiedAt);assert.equal(calls,2);
 engine.youtube.request=async()=>({items:[{id:'youtube-new',status:{privacyStatus:'private',uploadStatus:'processed'}}]});await engine.confirmPublication('new');const s=store.read();assert.equal(s.live.videos[0].youtubeId,'youtube-new');assert.equal(s.live.videos[0].status,'blocked');assert.equal(s.settings.paused,true);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('an explicit funded public request clears the old billing wait without altering the budget ledger',()=>{
 const s=armed();Object.assign(s.automation,{phase:'running',reason:'OpenAI APIの残高・利用上限の確認が必要です。',retryAt:'2099-01-01T00:00:00Z'});s.spendGuard={version:1,months:{fixture:{requests:[{bookedUsd:1}]}}};const ledger=JSON.stringify(s.spendGuard);
 assert(requestPublicAutopilot(s,'funded-request'));assert.equal(s.automation.retryAt,undefined);assert.equal(JSON.stringify(s.spendGuard),ledger);assert.equal(s.settings.privacy,'public');
});
test('a long or misplaced hook gets one bounded rewrite while sources and body remain for fact checking',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'loop-hook-')),store=new Store(dir),engine=new Engine(store);
 try{const candidate={title:'覚える仕組み',sources:[{id:'s1',url:'https://www.nasa.gov/example'}],segments:[{role:'body',text:'長い冒頭の文章をそのまま読み上げ続けないための例です。',sourceIds:['s1'],overlay:'覚える仕組み'},{role:'body',text:'説明の文章。',sourceIds:['s1']}]};const body=JSON.stringify(candidate.segments[1]),sources=JSON.stringify(candidate.sources);let calls=0;
 engine.ai.response=async()=>{calls++;return {value:{text:'どう覚える？'}};};await engine.shortenHook(candidate,'hook-test');assert.equal(candidate.segments[0].role,'hook');assert.equal(candidate.segments[0].text,'どう覚える？');assert.equal(JSON.stringify(candidate.segments[1]),body);assert.equal(JSON.stringify(candidate.sources),sources);await engine.shortenHook(candidate,'hook-test');assert.equal(calls,1);
 const s=armed();Object.assign(s.automation,{phase:'attention',reason:'冒頭を1〜2秒で読める長さにできませんでした。'});requestPublicAutopilot(s,'hook-repair-request');assert.equal(s.automation.phase,'waiting');s.automation.phase='attention';s.automation.reason='事実確認が完了しなかったため、自動運転を停止しました。';requestPublicAutopilot(s,'another-request');assert.equal(s.automation.phase,'attention');
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
