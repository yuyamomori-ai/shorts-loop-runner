import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceIssues,canRepairAcceptance} from '../runner/acceptance.mjs';
test('normal acceptance requires YouTube; renderer-only acceptance never claims a working connection',()=>{
 const checks={errors:[],youtubeAuthorized:false,youtubeError:'invalid_grant'};
 assert.deepEqual(acceptanceIssues(checks),['invalid_grant']);
 assert.deepEqual(acceptanceIssues(checks,{requireYouTube:false}),[]);
 assert.equal(checks.youtubeAuthorized,false);
 assert.deepEqual(acceptanceIssues({...checks,errors:['ffmpeg missing']},{requireYouTube:false}),['ffmpeg missing']);
 assert.deepEqual(acceptanceIssues({errors:[],youtubeAuthorized:true}),[]);
});

test('acceptance retries preserve factual, rights, private-only and upload duplication gates',()=>{
 const prior={passed:false,error:'quality'},v={privacy:'private',qa:{facts:'passed'},visualQa:{passed:false,safetyConcern:false,factConcern:false,copyrightConcern:false,issues:['scene_variety']}};
 assert(canRepairAcceptance(prior,v));
 for(const change of [{privacy:'public'},{youtubeId:'sent'},{uploadIntent:'unknown'},{risk:'facts'},{qa:{facts:'failed'}},{visualQa:{...v.visualQa,copyrightConcern:true}}])assert(!canRepairAcceptance(prior,{...v,...change}));
 assert(canRepairAcceptance({passed:false,error:'図解は同じセグメントの出典で裏付けてください。'},null));
 assert(!canRepairAcceptance({passed:false,error:'著作権確認に失敗'},null));
});
