import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {validationFile} from '../runner/validation-files.mjs';
test('validation exports are restricted to isolated named artifacts and reject traversal or symlinks',t=>{
 const dir=mkdtempSync(join(tmpdir(),'validation-access-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const root=join(dir,'validation','test-run'),media=join(root,'media','test-video');mkdirSync(media,{recursive:true});
 writeFileSync(join(root,'report.json'),JSON.stringify({tests:[{name:'science',videoId:'test-video'}]}));writeFileSync(join(media,'video.mp4'),'fixture');
 assert.equal(validationFile(dir,'/api/validation/test-run/science/video.mp4'),join(media,'video.mp4'));
 for(const p of ['/api/validation/../report.json','/api/validation/test-run/science/../../connections.json','/api/validation/test-run/knowledge/video.mp4','/api/validation/test-run/science/speech-0.wav'])assert.equal(validationFile(dir,p),null);
 writeFileSync(join(dir,'private.json'),'unrelated');symlinkSync(join(dir,'private.json'),join(media,'manifest.json'));assert.equal(validationFile(dir,'/api/validation/test-run/science/manifest.json'),null);
});
