import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewVideoId,reviewTarget} from '../runner/review-files.mjs';
test('request-scoped review resolves one exact owner request and cannot widen to latest or all videos',()=>{
 const videos=[{id:'one',initialPublicRequestId:'owner-1'},{id:'two',initialPublicRequestId:'owner-2'}],env={SHORTSLOOP_REVIEW_REQUEST_ID:'owner-1'};
 assert.equal(reviewVideoId(videos,env),'one');assert.equal(reviewTarget('/api/review/two/video.mp4',reviewVideoId(videos,env)),null);
 assert.equal(reviewVideoId(videos,{SHORTSLOOP_REVIEW_REQUEST_ID:'missing'}),null);assert.equal(reviewVideoId([...videos,{id:'three',initialPublicRequestId:'owner-1'}],env),null);
 assert.equal(reviewVideoId(videos,{}),null);assert.equal(reviewTarget('/api/state','one'),null);assert.equal(reviewTarget('/api/review/one/../../data.json','one'),null);
});
