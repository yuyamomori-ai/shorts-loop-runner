import {resolve} from 'node:path';
import {existsSync,readFileSync,realpathSync,lstatSync} from 'node:fs';

// Deliberately limited to NEW isolated acceptance outputs. Never exposes production state.
export function validationFile(directory,path) {
 const m=/^\/api\/validation\/([a-zA-Z0-9-]{1,80})\/(report\.json|science|knowledge)(?:\/(video\.mp4|manifest\.json|frame-\d{1,3}\.jpg))?$/.exec(path);
 if(!m)return null;
 const root=resolve(directory,'validation',m[1]),reportFile=resolve(root,'report.json');
 if(!existsSync(reportFile)||lstatSync(root).isSymbolicLink()||lstatSync(resolve(directory,'validation')).isSymbolicLink())return null;
 let file=reportFile;
 if(m[2]!=='report.json') {
  if(!m[3])return null;
  const report=JSON.parse(readFileSync(reportFile));
  const test=report.tests?.find(t=>t.name===m[2]);
  if(!test||!/^[-a-zA-Z0-9]{1,80}$/.test(test.videoId||''))return null;
  file=resolve(root,'media',test.videoId,m[3]);
 }
 if(!existsSync(file)||!lstatSync(file).isFile()||!realpathSync(file).startsWith(realpathSync(root)+'/'))return null;
 return file;
}
