import {existsSync,lstatSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';

// An owner-configured, expiring GET credential can inspect one production video.
// It cannot read the database, credentials, other videos, or invoke any action.
export function reviewVideoId(videos,env=process.env){
 if(/^[a-zA-Z0-9-]{1,80}$/.test(env.SHORTSLOOP_REVIEW_VIDEO_ID||''))return env.SHORTSLOOP_REVIEW_VIDEO_ID;
 const request=env.SHORTSLOOP_REVIEW_REQUEST_ID;
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(request||''))return null;
 // Pin to the first video of exactly one owner-authorized production request.
 // Ambiguous selection fails closed; never expose 'latest video' or the whole queue.
 const matches=videos.filter(v=>v.initialPublicRequestId===request);
 return matches.length===1?matches[0].id:null;
}
export function reviewTarget(pathname,configuredId) {
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(configuredId||''))return null;
 const m=pathname.match(/^\/api\/review\/([a-zA-Z0-9-]{1,80})\/(plan\.json|manifest\.json|video\.mp4|cover\.jpg|frame-\d{1,3}\.jpg)$/);
 return m&&m[1]===configuredId?{id:m[1],name:m[2]}:null;
}
export function reviewFile(directory,target) {
 if(!target||target.name==='plan.json'||!reviewTarget(`/api/review/${target.id}/${target.name}`,target.id))return null;
 const root=resolve(directory,'media'),dir=resolve(root,target.id),file=resolve(dir,target.name);
 if(![root,dir,file].every(p=>existsSync(p)&&!lstatSync(p).isSymbolicLink()))return null;
 return lstatSync(file).isFile()&&realpathSync(file)===resolve(realpathSync(root),target.id,target.name)?file:null;
}
export function reviewPlan(v) {
 if(!v)return null;
 return Object.fromEntries(['id','title','description','genre','contentType','segments','sources','qa','visualQa','originality','musicChoice','error','captionStyle','narrationSpeed','sceneSeconds','visualVersion','scenePlan','status','privacy','plannedAt','publishAt','initialPublicRequestId','youtubeId','actualPrivacy','publicVerifiedAt','publicationCheck','thumbnail'].map(k=>[k,k==='segments'?(v.segments||[]).map(({audio,...s})=>s):v[k]]));
}
