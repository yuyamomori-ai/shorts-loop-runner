import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {run,renderVideo,probe} from '../runner/render.mjs';
import {hash} from '../runner/providers.mjs';
import {FREE_TRACK} from '../runner/licensed-music.mjs';
// This exercises encoding/mixing only. Tone fixtures are never claimed to be real AI speech.
test('multi-asset 1080x1920 encode mixes timed audio, original music, captions and diagrams',{skip:process.env.RUN_RENDER_TESTS!=='true',timeout:600000},async t=>{
 const priorMode=process.env.SHORTSLOOP_MUSIC_MODE;process.env.SHORTSLOOP_MUSIC_MODE='original';t.after(()=>{if(priorMode===undefined)delete process.env.SHORTSLOOP_MUSIC_MODE;else process.env.SHORTSLOOP_MUSIC_MODE=priorMode;});
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
 assert.equal(r.manifest.musicEvidence.hasBackgroundMusic,true);assert.notEqual(r.manifest.musicEvidence.selectionStatus,'pending_native_selection');assert.equal(r.manifest.musicEvidence.externalSamples,false);
 assert.equal(r.manifest.cover.sha256,hash(readFileSync(join(directory,'media',v.id,'cover.jpg'))));
 // The persistent cache ties every sentence to text/model/voice/speed and its byte hash.
 const speech=JSON.parse(readFileSync(join(directory,'media',v.id,'speech-0.json')));assert.equal(speech.sha256,hash(readFileSync(join(directory,'media',v.id,'speech-0.wav'))));
});
test('bright image motion and sourced diagrams mix licensed music with readable captions',{skip:process.env.RUN_RENDER_TESTS!=='true'||!process.env.MUSIC_TEST_FILE,timeout:600000},async t=>{
 const before=process.env.SHORTSLOOP_MUSIC_MODE;process.env.SHORTSLOOP_MUSIC_MODE='licensed';t.after(()=>{if(before===undefined)delete process.env.SHORTSLOOP_MUSIC_MODE;else process.env.SHORTSLOOP_MUSIC_MODE=before;});
 const directory=mkdtempSync(join(tmpdir(),'shortloop-image-encode-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 assert.equal(hash(readFileSync(process.env.MUSIC_TEST_FILE)),FREE_TRACK.sha256);mkdirSync(join(directory,'licensed-music'));
 copyFileSync(process.env.MUSIC_TEST_FILE,join(directory,'licensed-music',FREE_TRACK.id+'.mp3'));writeFileSync(join(directory,'licensed-music',FREE_TRACK.id+'.json'),JSON.stringify({...FREE_TRACK,mode:'licensed',acquiredAt:'2026-09-24T00:00:00Z',hasBackgroundMusic:true,selectionStatus:'licensed_attached'}));
 const images=[];for(let i=0;i<2;i++){const file=join(directory,'fixture-'+i+'.png');await run('ffmpeg',['-y','-f','lavfi','-i',`color=c=${i?'0xffffd0':'0xd0f0ff'}:s=1024x1536:d=1`,'-vf',`drawbox=x=${i?300:100}:y=600:w=350:h=350:color=0xff9900:t=fill`,'-frames:v','1',file]);images.push({id:'image-'+i,file,sha256:hash(readFileSync(file)),synthetic:true,model:'fixture',prompt:'encoder fixture, not AI output'});}
 const v={id:'synthetic-image-test',synthetic:true,contentType:'A',genre:'Science',captionStyle:'clean',segments:['Why is the sky blue?','Light meets small particles.','Here is a schematic.','Light changes direction.','This is an illustrative image.','Look at the sky again.'].map((text,i)=>({text,role:i?'body':'hook',sourceIds:['s1'],visualType:i%2?'diagram':'mixed',visualQuery:'bright sky',effect:'zoom',overlay:i?'Light and particles':'Why blue?',...(i%2?{diagramSpec:{type:'process',labels:['Light','Particles','Scattering'],sourceIds:['s1']}}:{})}))};
 let calls=0;const ai={key:'encoder-fixture',speech:async(text,file)=>{await run('ffmpeg',['-y','-f','lavfi','-i',`sine=frequency=500:sample_rate=24000:duration=${calls++?4.1:1.85}`,'-c:a','pcm_s16le','-f','wav',file]);}};
 const result=await renderVideo(v,{directory,ai,generatedImages:images,englishTest:true});assert.equal(result.manifest.generatedImageCount,2);assert.equal(result.scenePlan[0].imageId,'image-0');assert(result.manifest.cover.meanLuma>=85);assert(result.manifest.diagramCount>0);assert.equal(result.manifest.musicEvidence.mode,'licensed');assert.equal(result.manifest.musicEvidence.sha256,FREE_TRACK.sha256);assert(result.manifest.mechanicalQa.passed);
});
