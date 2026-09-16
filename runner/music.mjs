// Original synthesized accompaniment. No sampled songs or third-party recordings.
const presets={curious:{bpm:104,notes:[0,7,12,4,7,16,12,7]},playful:{bpm:116,notes:[0,4,7,12,9,7,4,2]},calm:{bpm:92,notes:[0,7,4,11,7,12,4,7]}};
export function composeMusic(seconds,sceneStarts=[],seed='',requestedStyle) {
 if(!Number.isFinite(seconds)||seconds<1||seconds>60)throw Error('BGMの尺が不正です。');
 let state=2166136261;for(const c of String(seed))state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
 const style=Object.hasOwn(presets,requestedStyle)?requestedStyle:Object.keys(presets)[state%3],p=presets[style],root=[196,220,246.94][(state>>>4)%3];
 const rate=24000,n=Math.ceil(seconds*rate),bytes=Buffer.alloc(44+n*2),beat=60/p.bpm;
 bytes.write('RIFF');bytes.writeUInt32LE(36+n*2,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(n*2,40);
 const starts=sceneStarts.filter(x=>Number.isFinite(x)&&x>=0&&x<seconds);
 for(let i=0;i<n;i++){
  const t=i/rate,step=Math.floor(t/(beat/2)),phase=t%(beat/2),beatPhase=t%beat,bar=Math.floor(t/(beat*4));
  const frequency=root*2**((p.notes[(step+bar)%p.notes.length]+[0,-5,-3,-5][bar%4])/12);
  const fade=Math.max(0,Math.min(1,t/.12,(seconds-t)/.65));
  state=(Math.imul(state,1664525)+1013904223)>>>0;const noise=state/2147483648-1;
  const pluck=Math.sin(2*Math.PI*frequency*t)*Math.exp(-phase*13)*.016;
  const kick=Math.sin(2*Math.PI*(53*beatPhase+3*(1-Math.exp(-beatPhase*30))))*Math.exp(-beatPhase*28)*.025;
  const hat=noise*Math.exp(-phase*110)*.003;
  const bass=Math.sin(2*Math.PI*root/2*t)*Math.exp(-beatPhase*7)*.007;
  let y=(pluck+kick+hat+bass)*fade;
  for(const start of starts){const dt=t-start;if(dt>=0&&dt<.09)y+=Math.sin(2*Math.PI*(740*dt+900*dt*dt))*.012*(1-dt/.09);}
  bytes.writeInt16LE(Math.round(Math.max(-.12,Math.min(.12,y))*32767),44+i*2);
 }
 return {bytes,metadata:{provider:'ShortLOOP original synthesis',version:1,style,bpm:p.bpm,externalSamples:false,trendVerified:false,commercialAllowed:true,modificationAllowed:true}};
}
