import test from 'node:test';
import assert from 'node:assert/strict';
import {requeueOutdatedMedia} from '../runner/media-policy.mjs';
import {FREE_TRACK} from '../runner/licensed-music.mjs';
const video=patch=>({id:'legacy',status:'approved',privacy:'public',revision:2,approvedRevision:2,approvedDigest:'immutable-old',qa:{facts:'passed',rights:'passed',technical:'passed',visual:'passed'},mediaManifest:{musicEvidence:{mode:'original'},generatedImageCount:0},...patch});
const state=v=>({settings:{mode:'auto',privacy:'public'},live:{videos:[v]}});
test('old unsent approvals are rendered and reviewed again before the new production music/image policy',()=>{
 const v=video(),s=state(v);assert.deepEqual(requeueOutdatedMedia(s,{licensed:true,generated:true}),['legacy']);
 assert.equal(v.status,'draft');assert.equal(v.approvedRevision,null);assert.equal(v.approvedDigest,undefined);assert.equal(v.qa.facts,'passed');assert.equal(v.qa.rights,'passed');assert.equal(v.qa.visual,'pending');
 assert.deepEqual(requeueOutdatedMedia(s,{licensed:true,generated:true}),[]);
});
test('published, resumable, rejected, private, and factual-risk records remain unchanged',()=>{
 for(const patch of [{youtubeId:'posted'},{uploadIntent:'unknown'},{uploadSession:'resumable'},{status:'blocked'},{privacy:'private'},{risk:'unverified'},{qa:{facts:'failed'}}]){
  const v=video(patch),before=structuredClone(v);assert.deepEqual(requeueOutdatedMedia(state(v),{licensed:true,generated:true}),[]);assert.deepEqual(v,before);
 }
});
test('valid new production media is not regenerated or reapproved on every tick',()=>{
 const v=video({mediaManifest:{musicEvidence:{...FREE_TRACK,mode:'licensed',acquiredAt:'2026-09-24T00:00:00Z'},generatedImageCount:2}}),before=structuredClone(v);
 assert.deepEqual(requeueOutdatedMedia(state(v),{licensed:true,generated:true}),[]);assert.deepEqual(v,before);
 assert.deepEqual(requeueOutdatedMedia(state(video()),{licensed:false,generated:false}),[]);
});

import {headlineLabel} from '../runner/science-cards.mjs';
test('large Japanese headlines preserve verb boundaries',()=>{const text=headlineLabel('一気に噴くのは？',7);assert(!text.includes('噴\\Nく'));assert.equal(text.replaceAll('\\N',''),'一気に噴くのは？');assert(text.split('\\N').every(s=>Array.from(s).length<=7));});
