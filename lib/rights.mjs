import {assert,uid,now} from './core.mjs';
export const LICENSES=['owned','permission','CC0','public-domain','CC-BY-4.0','pexels','ai-generated'];
export function registerAsset(data,p){
 assert(typeof p.title==='string'&&p.title.trim(),'素材名が必要です。');assert(LICENSES.includes(p.license),'商用利用・改変可能な対応ライセンスを選択してください。');
 assert(p.commercialAllowed===true&&p.modificationAllowed===true,'商用利用・改変の許諾を確認できない素材は登録できません。');
 assert(p.attested===true&&typeof p.evidence==='string'&&p.evidence.trim().length>=10,'権利者・利用許諾の根拠を具体的に記録してください。');
 if(['permission','public-domain','CC-BY-4.0'].includes(p.license))assert(p.sourceUrl&&/^https:\/\//.test(p.sourceUrl),'許諾またはライセンスを確認できるURLが必要です。');
 const creditRequired=p.license==='CC-BY-4.0'||!!p.creditRequired;assert(!creditRequired||p.creditText?.trim(),'必要なクレジットを記録してください。');
 const asset={id:uid(),title:p.title.trim(),sourceUrl:p.sourceUrl||'',provider:p.provider||'user',license:p.license,commercialAllowed:true,modificationAllowed:true,creditRequired,creditText:p.creditText||'',evidence:p.evidence,acquiredAt:now(),rightsCheckedAt:now(),rightsStatus:'attested',file:null,sha256:null,context:p.context||'',containsPeople:!!p.containsPeople,consentConfirmed:!!p.consentConfirmed};
 if(asset.containsPeople&&!asset.consentConfirmed)asset.rightsStatus='review';data.assets.push(asset);return asset;
}
export function assetReady(a){return !!(a?.file&&a.sha256&&['attested','provider_verified'].includes(a.rightsStatus)&&a.commercialAllowed&&a.modificationAllowed&&(!a.creditRequired||a.creditText)&&(!a.containsPeople||a.consentConfirmed));}
export function originalityPass(q){return q&&q.confidence>=.85&&q.originality>=70&&q.commentary>=65&&q.editing>=60&&(q.educational>=60||q.entertainment>=65)&&q.copyrightRisk<=15&&q.reusedRisk<=25;}
