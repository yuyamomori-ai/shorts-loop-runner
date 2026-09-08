// ASS vector drawings use libass already installed with FFmpeg: no browser/canvas dependency.
export const assTime=x=>`${Math.floor(x/3600)}:${String(Math.floor(x/60)%60).padStart(2,'0')}:${(x%60).toFixed(2).padStart(5,'0')}`;
export const assSafe=x=>String(x??'').replace(/[{}\\\r\n\u0000-\u001f]/g,' ');
export function wrapLabel(text,n=12) {const c=Array.from(assSafe(text)),r=[];const width=Math.ceil(c.length/Math.max(1,Math.ceil(c.length/n)));while(c.length)r.push(c.splice(0,width).join(''));return r.join('\\N');}
export function assHeader(font='Noto Sans CJK JP',captionSize=52) {
 return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,${assSafe(font)},${captionSize},&H00FFFFFF,&H00FFFFFF,&H00221409,&H90000000,-1,0,0,0,100,100,0,0,1,3,1,2,120,150,410,1\nStyle: Label,${assSafe(font)},58,&H00FFFFFF,&H00FFFFFF,&H00221409,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1\nStyle: Meta,${assSafe(font)},30,&H00DEE9EC,&H00FFFFFF,&H00221409,&H00000000,0,0,0,0,100,100,0,0,1,1,0,5,80,80,0,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
}
export const event=(a,b,style,text,layer=1)=>`Dialogue: ${layer},${assTime(a)},${assTime(b)},${style},,0,0,0,,${text}\n`;
const rect=(x,y,w,h)=>`m ${x} ${y} l ${x+w} ${y} ${x+w} ${y+h} ${x} ${y+h}`;
const circle=(x,y,r)=>`m ${x-r} ${y} b ${x-r} ${y-r*.552} ${x-r*.552} ${y-r} ${x} ${y-r} b ${x+r*.552} ${y-r} ${x+r} ${y-r*.552} ${x+r} ${y} b ${x+r} ${y+r*.552} ${x+r*.552} ${y+r} ${x} ${y+r} b ${x-r*.552} ${y+r} ${x-r} ${y+r*.552} ${x-r} ${y}`;
const labelColor=(label,fallback)=>/青|blue/i.test(label)?'F7B74E':/赤|red\b/i.test(label)?'6575F5':fallback;
const vector=(path,color,alpha='00',motion='')=>`{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&H${color}&\\alpha&H${alpha}&${motion}}${path}{\\p0}`;

export function scienceCardEvents(scene) {
 const {start:a,end:b,variant=0,diagramSpec:d}=scene;
 const colors=['7AE6AA','FFC960','81A9FF'],accent=colors[variant%3];
 let out=event(a,b,'Label',vector(rect(78,408,894,814),'392715'),0);
 out+=event(a,b,'Label',vector(rect(78,408,8,814),accent),0);
 out+=event(a,b,'Meta',`{\\an7\\pos(120,440)\\1c&H${accent}&}説明図 / 模式的な表現`);
 const labels=d?.labels||scene.labels||[],type=d?.type||'concept';
 if(type==='process') {
  const ys=labels.length===2?[650,1010]:[625,855,1085];
  labels.forEach((label,i)=>{
   const reveal=a+Math.min(.25*i,scene.duration*.1),y=ys[i];
   out+=event(reveal,b,'Label',vector(rect(150,y-65,750,130),i===(scene.activeStep??0)?'88603C':'513824','00','\\fad(80,0)'));
   out+=event(reveal,b,'Meta',`{\\pos(194,${y})\\1c&H${accent}&}${i+1}`);
   out+=event(reveal,b,'Label',`{\\pos(548,${y})\\fs50\\fad(80,0)}${wrapLabel(label,14)}`);
   if(i<labels.length-1){const top=y+82,bottom=ys[i+1]-83;out+=event(reveal+.1,b,'Label',vector(`m 531 ${top} l 549 ${top} 549 ${bottom-20} 570 ${bottom-20} 540 ${bottom+10} 510 ${bottom-20} 531 ${bottom-20}`,accent,'00','\\fad(100,0)'));}
  });
 } else if(type==='comparison') {
  const n=labels.length,w=792/n;
  labels.forEach((label,i)=>{
   const x=144+i*w,c=labelColor(label,colors[i%3]);
   out+=event(a,b,'Label',vector(rect(x,590,w-18,466),i%2?'523723':'4E3625'));
   out+=event(a,b,'Label',vector(circle(x+(w-18)/2,698,54),c));
   out+=event(a,b,'Label',`{\\pos(${x+(w-18)/2},698)\\fs38\\1c&H271808&}${String.fromCharCode(65+i)}`);
   out+=event(a+.12*i,b,'Label',`{\\pos(${x+(w-18)/2},870)\\fs44\\fad(100,0)}${wrapLabel(label,n===2?8:5)}`);
  });
 } else {
  // Labeled concept circles have no arrows: co-occurrence never asserts causality.
  const ys=labels.length===1?[810]:labels.length===2?[660,990]:[610,835,1060];
  labels.forEach((label,i)=>{
   const y=ys[i],x=variant===1?560:520;
   out+=event(a,b,'Label',vector(circle(x,y,labels.length===1?150:96),'634228'));
   out+=event(a,b,'Label',vector(circle(x-140,y,10),colors[i%3],'00',`\\move(0,0,${variant===1?18:-18},12)`));
   out+=event(a+.08*i,b,'Label',`{\\pos(${x},${y})\\fs52\\fad(80,0)}${wrapLabel(label,12)}`);
  });
 }
 if(d?.caption)out+=event(a,b,'Meta',`{\\pos(540,1178)\\fs29}${wrapLabel(d.caption,28)}`);
 // Gentle motion also applies to card scenes, with positions kept inside safe margins.
 if(scene.effect==='pan')out=out.replace(/\\pos\(([-\d.]+),([-\d.]+)\)/g,(_,x,y)=>`\\move(${Number(x)-10},${y},${Number(x)+10},${y})`);
 if(scene.effect==='zoom')out=out.replace(/\\bord0/g,`\\fscx99\\fscy99\\t(0,${Math.round(scene.duration*1000)},\\fscx101\\fscy101)\\bord0`);
 return out;
}
export function sceneOverlayEvents(scene) {
 const {start:a,end:b}=scene;
 let out=scene.assetId?'':scienceCardEvents(scene);
 if(scene.overlay)out+=event(a,b,'Label',`{\\an8\\pos(522,246)\\fs${scene.hook?65:53}\\bord3\\fad(60,60)}${wrapLabel(scene.overlay,14)}`,3);
 if(scene.assetId)out+=event(a,b,'Meta',`{\\an7\\pos(96,408)\\fs28}参考映像`,3);
 if(['slow','replay'].includes(scene.effect)&&scene.assetId)out+=event(a,b,'Meta',`{\\an7\\pos(96,455)}${scene.effect==='slow'?'SLOW ×0.72':'REPLAY'}`,3);
 if(scene.callout)out+=event(a+Math.min(.2,scene.duration*.1),Math.min(b,a+2.5),'Label',`{\\an8\\move(525,1120,525,1098,0,180)\\fs37\\1c&H7AE6AA&\\bord3\\fad(80,80)}${wrapLabel(scene.callout,18)}`,3);
 return out;
}
export function captionEvents(segments,{size=52}={}) {
 let out='',minSeconds=Infinity,totalChars=0;
 for(const s of segments) {
  const chars=Array.from(assSafe(s.text)),duration=s.end-s.start;
  const n=Math.ceil(chars.length/26),length=Math.ceil(chars.length/n);
  const cards=[];while(chars.length)cards.push(chars.splice(0,length).join(''));
  for(let i=0;i<cards.length;i++) {
   const a=s.start+duration*i/cards.length,b=s.start+duration*(i+1)/cards.length;
   if(b-a<.95||Array.from(cards[i]).length/(b-a)>16)throw Error('字幕を読む時間が不足しています。台本を短くしてください。');
   minSeconds=Math.min(minSeconds,b-a);totalChars+=Array.from(cards[i]).length;
   let text=wrapLabel(cards[i],13);
   const keyword=s.overlay&&Array.from(s.overlay).length<=8?assSafe(s.overlay):null;
   if(keyword&&text.includes(keyword))text=text.replace(keyword,`{\\1c&H7AE6AA&}${keyword}{\\1c&HFFFFFF&}`);
   out+=event(a,b,'Caption',`{\\an2\\pos(522,1490)\\fs${size}\\fad(55,55)}${text}`,5);
  }
 }
 return {events:out,minSeconds,totalChars,size,maxLines:2,bottom:1490};
}
