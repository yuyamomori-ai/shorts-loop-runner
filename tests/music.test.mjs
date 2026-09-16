import test from 'node:test';
import assert from 'node:assert/strict';
import {composeMusic} from '../runner/music.mjs';
test('original background music is bounded PCM with stable provenance and no external samples',()=>{
 const a=composeMusic(2,[0,.7],'video-one'),b=composeMusic(2,[0,.7],'video-one'),c=composeMusic(2,[0,.7],'video-two');
 assert(a.bytes.equals(b.bytes));assert(!a.bytes.equals(c.bytes));assert.equal(a.bytes.toString('ascii',0,4),'RIFF');assert.equal(a.bytes.readUInt32LE(24),24000);assert.equal(a.bytes.length,44+2*24000*2);
 let peak=0;for(let i=44;i<a.bytes.length;i+=2)peak=Math.max(peak,Math.abs(a.bytes.readInt16LE(i)));assert(peak>100&&peak<4000);assert.equal(a.metadata.externalSamples,false);assert.equal(a.metadata.trendVerified,false);
 assert.throws(()=>composeMusic(100));assert.throws(()=>composeMusic(NaN));
});
