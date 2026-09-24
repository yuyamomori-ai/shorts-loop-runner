import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceIssues} from '../runner/acceptance.mjs';
test('normal acceptance requires YouTube; renderer-only acceptance never claims a working connection',()=>{
 const checks={errors:[],youtubeAuthorized:false,youtubeError:'invalid_grant'};
 assert.deepEqual(acceptanceIssues(checks),['invalid_grant']);
 assert.deepEqual(acceptanceIssues(checks,{requireYouTube:false}),[]);
 assert.equal(checks.youtubeAuthorized,false);
 assert.deepEqual(acceptanceIssues({...checks,errors:['ffmpeg missing']},{requireYouTube:false}),['ffmpeg missing']);
 assert.deepEqual(acceptanceIssues({errors:[],youtubeAuthorized:true}),[]);
});
