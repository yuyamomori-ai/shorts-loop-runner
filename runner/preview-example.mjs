import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {initialState,plan} from '../lib/core.mjs';
import {renderVideo} from './render.mjs';
const s=initialState();plan(s.live,1,()=>.2);const v=s.live.videos[0];v.id='preview-example';
const directory=resolve(process.argv[2]||'work/preview');mkdirSync(directory,{recursive:true});
const result=await renderVideo(v,{directory,preview:true});
writeFileSync(resolve(directory,'preview-result.json'),JSON.stringify({videoFile:result.videoFile,manifest:result.manifest},null,2));
console.log(JSON.stringify({videoFile:result.videoFile,duration:result.duration,preview:true}));
