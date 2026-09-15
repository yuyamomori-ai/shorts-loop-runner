import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {reviewTarget,reviewFile,reviewPlan} from '../runner/review-files.mjs';
test('production review is exactly one allowlisted video and does not expose internal paths',t=>{
 const dir=mkdtempSync(join(tmpdir(),'review-access-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const media=join(dir,'media','selected');mkdirSync(media,{recursive:true});writeFileSync(join(media,'frame-0.jpg'),'fixture');
 const target=reviewTarget('/api/review/selected/frame-0.jpg','selected');assert.equal(reviewFile(dir,target),join(media,'frame-0.jpg'));
 for(const p of ['/api/review/other/frame-0.jpg','/api/review/selected/../../connections.json','/api/review/selected/speech-0.wav','/api/review/selected/secret.json'])assert.equal(reviewTarget(p,'selected'),null);
 writeFileSync(join(dir,'private.json'),'private');symlinkSync(join(dir,'private.json'),join(media,'manifest.json'));assert.equal(reviewFile(dir,reviewTarget('/api/review/selected/manifest.json','selected')),null);
 const plan=reviewPlan({id:'selected',segments:[{text:'台本',audio:'/private/speech.wav'}],sourceEvidence:[{text:'full paper'}],videoFile:'/private/video.mp4'});assert(!JSON.stringify(plan).includes('/private'));assert(!JSON.stringify(plan).includes('full paper'));
});
