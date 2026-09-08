import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {run,renderVideo,probe} from '../runner/render.mjs';
import {hash} from '../runner/providers.mjs';
// This exercises encoding/mixing only. Tone fixtures are never claimed to be real AI speech.
test('multi-asset 1080x1920 encode mixes timed audio, captions and diagrams',{skip:process.env.RUN_RENDER_TESTS!=='true',timeout:600000},async t=>{
 const directory=mkdtempSync(join(tmpdir(),'shortloop-encode-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const assets=[];
 for(let i=0;i<2;i++){
  const file=join(directory,'source-'+i+'.mp4');
  await run('ffmpeg',['-y','-f','lavfi','-i',`testsrc2=size=360x640:rate=30:duration=3`,'-vf',i?'hue=h=90':'hue=h=0','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',file]);
  assets.push({id:'source-'+i,file,sha256:hash(readFileSync(file)),duration:3,license:'owned',rightsStatus:'attested',commercialAllowed:true,modificationAllowed:true});
 }
 const v={id:'synthetic-encoder-test',synthetic:true,contentType:'A',genre:'Science',captionStyle:'clean',segmentAssets:{0:['source-0'],2:['source-1'],4:['source-0']},segments:['Where do bubbles come from?','Here is a schematic.','Pressure changes.','Gas leaves the liquid.','Watch the illustrative motion.','That is the basic idea.'].map((text,i)=>({text,role:i?'body':'hook',sourceIds:['s1'],visualQuery:'water',visualType:i%2?'diagram':'real_footage',effect:['zoom','pan','slow','pan','replay','zoom'][i],overlay:i?'Pressure and gas':'Look at the bubbles',...(i%2?{diagramSpec:{type:i===3?'comparison':'process',labels:['Pressure','Liquid','Bubbles'],sourceIds:['s1']}}:{})}))};
 let calls=0;
 const ai={key:'test-fixture-only',speech:async(text,file)=>{const seconds=calls++===0?1.85:4.4;await run('ffmpeg',['-y','-f','lavfi','-i',`sine=frequency=440:sample_rate=24000:duration=${seconds}`,'-c:a','pcm_s16le','-f','wav',file]);}};
 const r=await renderVideo(v,{directory,ai,assets,englishTest:true,retainAudio:true});
 const p=await probe(r.videoFile);
 assert.equal(p.streams.find(x=>x.codec_type==='video').codec_name,'h264');assert.equal(r.manifest.assetCount,2);assert(r.manifest.explanationCount>0);assert(r.manifest.mechanicalQa.passed);assert(r.scenePlan.length>=8);assert(r.manifest.synthetic);assert.equal(calls,6);
 assert(r.manifest.speech.every(s=>s.sha256&&s.duration>0));assert.equal(r.manifest.captions.maxLines,2);
 // The persistent cache ties every sentence to text/model/voice/speed and its byte hash.
 const speech=JSON.parse(readFileSync(join(directory,'media',v.id,'speech-0.json')));assert.equal(speech.sha256,hash(readFileSync(join(directory,'media',v.id,'speech-0.wav'))));
});
