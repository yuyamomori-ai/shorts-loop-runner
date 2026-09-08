import {existsSync,lstatSync,readdirSync,realpathSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';

function ownedDirectory(directory,id) {
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))return null;
  const root=resolve(directory),media=join(root,'media'),dir=join(media,id);
  if(!existsSync(dir))return null;
  // Only this renderer's folders are eligible. Never follow a linked directory.
  if([root,media,dir].some(p=>lstatSync(p).isSymbolicLink()))return null;
  if(realpathSync(dir)!==join(realpathSync(root),'media',id))return null;
  return dir;
}

export function cleanRenderIntermediates(directory,id) {
  const dir=ownedDirectory(directory,id);if(!dir)return;
  for(const name of readdirSync(dir)) {
    if(!/^(speech-\d+\.(wav|json)(\.tmp)?|scene-\d+\.mp4|music\.wav|background\.mp4|scenes\.txt|video-rendering\.mp4)$/.test(name))continue;
    const file=join(dir,name);if(lstatSync(file).isFile())rmSync(file);
  }
}

function directoryBytes(dir) {
  return readdirSync(dir).reduce((sum,name)=>{
    const p=join(dir,name),s=lstatSync(p);
    return sum+(s.isFile()?s.size:s.isDirectory()?directoryBytes(p):0);
  },0);
}

export function collectGeneratedMedia(directory,videos,{
  retentionHours=Number(process.env.MEDIA_RETENTION_HOURS||0),
  budgetMB=Number(process.env.MEDIA_BUDGET_MB||0),
  now=Date.now()
}={}) {
  if(!(retentionHours>0||budgetMB>0))return [];
  const files=videos.map(video=>({video,dir:ownedDirectory(directory,video.id)}))
    .filter(x=>x.dir).map(x=>({...x,bytes:directoryBytes(x.dir)}));
  let total=files.reduce((n,x)=>n+x.bytes,0);
  const eligible=files.filter(({video:v,dir})=>
    v.youtubeId&&v.status==='published'&&v.actualPrivacy==='public'&&
    !v.uploadSession&&v.uploadedAt&&v.mediaManifest?.preview===false&&
    v.videoFile&&resolve(v.videoFile)===join(dir,'video.mp4')&&
    existsSync(v.videoFile)&&lstatSync(v.videoFile).isFile()
  ).sort((a,b)=>Date.parse(a.video.uploadedAt)-Date.parse(b.video.uploadedAt));
  const purged=[];
  for(const {video,dir,bytes} of eligible) {
    const expired=retentionHours>0&&now-Date.parse(video.uploadedAt)>retentionHours*3600000;
    if(!expired&&!(budgetMB>0&&total>budgetMB*1024*1024))continue;
    rmSync(dir,{recursive:true});total-=bytes;purged.push(video.id);
  }
  return purged;
}
