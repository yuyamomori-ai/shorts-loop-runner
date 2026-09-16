import test from 'node:test';
import assert from 'node:assert/strict';
import {composeMusic,musicStyleFor} from '../runner/music.mjs';
test('automatic original music fits the topic and respects a supported explicit choice',()=>{
 assert.equal(musicStyleFor({title:'記憶の実験',genre:'雑学'}),'calm');
 assert.equal(musicStyleFor({genre:'動物'}),'playful');
 assert.equal(musicStyleFor({title:'炭酸の泡',musicStyle:'unknown'}),'curious');
 assert.equal(musicStyleFor({title:'記憶の実験',musicStyle:'playful'}),'playful');
});
test('original background music is bounded PCM with stable provenance and no external samples',()=>{
 const a=composeMusic(2,[0,.7],'video-one'),b=composeMusic(2,[0,.7],'video-one'),c=composeMusic(2,[0,.7],'video-two');
 assert(a.bytes.equals(b.bytes));assert(!a.bytes.equals(c.bytes));assert.equal(a.bytes.toString('ascii',0,4),'RIFF');assert.equal(a.bytes.readUInt32LE(24),24000);assert.equal(a.bytes.length,44+2*24000*2);
 let peak=0;for(let i=44;i<a.bytes.length;i+=2)peak=Math.max(peak,Math.abs(a.bytes.readInt16LE(i)));assert(peak>100&&peak<4000);assert.equal(a.metadata.externalSamples,false);assert.equal(a.metadata.trendVerified,false);
 assert.throws(()=>composeMusic(100));assert.throws(()=>composeMusic(NaN));
});
test('native Shorts sound mode contains effects only, never a substitute song',()=>{
 const silence=composeMusic(2,[],'one',undefined,{effectsOnly:true});assert(silence.bytes.subarray(44).every(x=>x===0));assert.equal(silence.metadata.hasBackgroundMusic,false);
 const effects=composeMusic(2,[.5],'one',undefined,{effectsOnly:true});assert(effects.bytes.subarray(44).some(x=>x!==0));assert.equal(effects.metadata.style,'effects-only');
});
