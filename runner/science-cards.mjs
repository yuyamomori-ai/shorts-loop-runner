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

// Functional icons represent the checked label, never an anatomical or statistical claim.
function symbol(label,x,y,r,color) {
 let path='';
 if(/映像|動画|見る|光|画面/.test(label))path=rect(x-r,y-r*.65,r*2,r*1.3)+` m ${x-r*.22} ${y-r*.38} l ${x+r*.48} ${y} ${x-r*.22} ${y+r*.38}`;
 else if(/警告|注意|誤|混|錯/.test(label))path=`m ${x} ${y-r} l ${x+r} ${y+r*.75} ${x-r} ${y+r*.75} m ${x-5} ${y-r*.35} l ${x+5} ${y-r*.35} ${x+5} ${y+r*.2} ${x-5} ${y+r*.2} `+circle(x,y+r*.48,6);
 else if(/検査|テスト|確認|想起|思い出/.test(label))path=circle(x-r*.15,y-r*.15,r*.63)+rect(x+r*.27,y+r*.34,r*.55,r*.18);
 else if(/人|参加|年齢|行動/.test(label))path=circle(x,y-r*.5,r*.37)+` m ${x-r*.75} ${y+r} b ${x-r*.7} ${y-r*.05} ${x+r*.7} ${y-r*.05} ${x+r*.75} ${y+r}`;
 else if(/液体|水|泡|気体|分子/.test(label))path=circle(x-r*.47,y+r*.27,r*.36)+circle(x+r*.44,y+r*.21,r*.3)+circle(x,y-r*.48,r*.4);
 else path=rect(x-r*.64,y-r,r*1.28,r*2)+rect(x-r*.38,y-r*.45,r*.76,7)+rect(x-r*.38,y-r*.05,r*.76,7)+rect(x-r*.38,y+r*.35,r*.5,7);
 return vector(path,color,'00','\\fad(100,0)\\1a&HFF&\\3c&H'+color+'&').replace('\\bord0','\\bord5');
}
const palettes=[{panel:'F7EFE7',ink:'3E2815',accent:'4045ED',soft:'DFD0C1'},{panel:'48361E',ink:'FFFFFF',accent:'60D8FF',soft:'6A5135'},{panel:'E0F4F9',ink:'342A19',accent:'9A5835',soft:'B9DEEA'}];
export function scienceCardEvents(scene) {
 const {start:a,end:b,diagramSpec:d}=scene,p=palettes[(scene.variant||0)%3],labels=d?.labels||scene.labels||[],n=labels.length,type=d?.type||'concept';
 const active=Math.max(0,(scene.activeStep??scene.segmentIndex??0)%Math.max(1,n));
 const layout=scene.layout||['overview','focus','timeline'][(scene.variant||0)%3];
 let out=event(a,b,'Label',vector(rect(72,420,908,812),p.panel),0);
 out+=event(a,b,'Meta',`{\\an7\\pos(108,452)\\fs27\\bord0\\1c&H${p.ink}&}${type==='process'?'順序を見てみる':type==='comparison'?'違いを比べる':'ポイントを図解'}`);
 const text=(str,x,y,size=48,color=p.ink,from=a,width=720)=>event(from,b,'Label',`{\\pos(${x},${y})\\fs${size}\\bord0\\1c&H${color}&\\fad(90,0)}${wrapLabel(str,Math.max(3,Math.floor(width/size)))}`);
 const shape=(path,color=p.accent,from=a)=>event(from,b,'Label',vector(path,color),0);
 const icon=(str,x,y,r,from=a)=>event(from,b,'Label',symbol(str,x,y,r,p.accent),1);
 const arrow=(x,y,vertical=false)=>shape(vertical?`m ${x-7} ${y-23} l ${x+7} ${y-23} ${x+7} ${y+3} ${x+21} ${y+3} ${x} ${y+28} ${x-21} ${y+3} ${x-7} ${y+3}`:`m ${x-25} ${y-7} l ${x+4} ${y-7} ${x+4} ${y-22} ${x+30} ${y} ${x+4} ${y+22} ${x+4} ${y+7} ${x-25} ${y+7}`);
 if(scene.hook&&/記憶|誤情報|心理|覚|思い出|警告/.test(scene.overlay+labels.join(''))) {
  // A generic person and phone are illustrative icons, not a depiction of study participants.
  out+=shape(circle(337,686,98),p.accent);
  out+=shape('m 153 1064 b 156 820 516 820 521 1064',p.accent);
  out+=shape(circle(303,676,8),p.panel)+shape(circle(368,676,8),p.panel);
  out+=shape(circle(337,734,20),p.panel);
  out+=shape(rect(600,669,202,369),p.ink)+shape(rect(613,696,176,291),p.panel);
  out+=text('?',702,825,138,p.accent,a+.12);
  out+=text('人物・画面はイメージ',530,1150,30);
 }else if(layout==='focus'&&!scene.hook) {
  // A close-up keeps the complete relationship visible in a small context strip.
  out+=shape(circle(530,732,137),p.soft)+icon(labels[active],530,710,72);
  out+=text(labels[active],530,950,66);
  const w=800/Math.max(1,n);
  labels.forEach((label,i)=>{
   const x=130+w*(i+.5);out+=shape(rect(x-w/2+8,1072,w-16,85),i===active?p.accent:p.soft);
   out+=text(label,x,1115,n===3?27:33,i===active?((scene.variant||0)%3===1?'342A19':'FFFFFF'):p.ink,a,w-30);
   if(type==='process'&&i<n-1)out+=arrow(x+w/2,1040);
  });
 }else if(type==='process'&&layout==='overview') {
  const w=800/n;
  labels.forEach((label,i)=>{
   const x=130+w*(i+.5),t=a+i*.13;
   out+=shape(circle(x,725,n===3?90:122),i===active?p.soft:p.panel,t)+icon(label,x,715,n===3?50:65,t);
   out+=text(label,x,945,n===3?43:54,p.ink,t,w-30);
   out+=text(String(i+1),x,570,33,p.accent);
   if(i<n-1)out+=arrow(x+w/2,725);
  });
 }else if(type==='process') {
  labels.forEach((label,i)=>{
   const y=590+i*(n===2?350:237),t=a+i*.12;
   out+=shape(rect(120,y-60,810,134),i===active?p.soft:p.panel,t);
   out+=icon(label,208,y,40,t)+text(label,588,y,51,p.ink,t);
   if(i<n-1)out+=arrow(530,y+(n===2?175:120),true);
  });
 }else if(type==='comparison') {
  const w=808/n;
  labels.forEach((label,i)=>{
   const x=128+i*w,c=labelColor(label,i%2?'BA7845':p.accent);
   out+=shape(rect(x,566,w-16,533),i%2?p.soft:p.panel);
   out+=shape(rect(x,566,w-16,10),c)+icon(label,x+(w-16)/2,735,62);
   out+=text(label,x+(w-16)/2,949,n===3?40:55,p.ink,a,w-35);
  });
 }else{
  // Spatial association only. No arrows or invented numeric axes for concepts.
  const positions=n===1?[[530,775]]:layout==='timeline'?(n===2?[[325,660],[702,984]]:[[294,640],[744,817],[345,1048]]):(n===2?[[320,815],[732,815]]:[[530,640],[295,1010],[759,1010]]);
  labels.forEach((label,i)=>{
   const [x,y]=positions[i]||[530,800],t=a+i*.12;
   out+=shape(circle(x,y-28,n===1?155:105),p.soft,t)+icon(label,x,y-45,n===1?82:50,t);
   out+=text(label,x,y+126,n===1?64:45,p.ink,t,n===1?650:320);
  });
 }
 if(d?.caption)out+=text(d.caption,530,1194,27);
 // A visible progressive reveal and small pan keep motion inside the safe card area.
 if(scene.effect==='pan')out=out.replace(/\\pos\(([-\d.]+),([-\d.]+)\)/g,(_,x,y)=>Number(x)>0?`\\move(${Number(x)-10},${y},${Number(x)+10},${y})`:`\\pos(${x},${y})`);
 return out;
}
export function sceneOverlayEvents(scene) {
 const {start:a,end:b}=scene;
 let out=scene.assetId?'':scienceCardEvents(scene);
 // Owner preference: large red headline with a white outline, separate from captions.
 if(scene.overlay)out+=event(a,b,'Label',`{\\an8\\pos(522,206)\\fs${scene.hook?104:72}\\1c&H3333EB&\\3c&HFFFFFF&\\bord${scene.hook?6:4}\\shad2\\fscx96\\fscy96\\t(0,180,\\fscx100\\fscy100)\\fad(0,50)}${wrapLabel(scene.overlay,scene.hook?11:13)}`,3);
 if(scene.assetId)out+=event(a,b,'Meta',`{\\an7\\pos(96,408)\\fs28}参考映像`,3);
 if(['slow','replay'].includes(scene.effect)&&scene.assetId)out+=event(a,b,'Meta',`{\\an7\\pos(96,455)}${scene.effect==='slow'?'SLOW ×0.72':'REPLAY'}`,3);
 if(scene.callout)out+=event(a+.25,Math.min(b,a+2.8),'Label',`{\\an8\\move(525,1280,525,1258,0,180)\\fs39\\1c&H60D8FF&\\bord3\\fad(80,80)}${wrapLabel(scene.callout,18)}`,3);
 return out;
}
export function captionChunks(text) {
 const chars=Array.from(assSafe(text)),cards=[];
 while(chars.length){let end=Math.min(26,chars.length);if(chars.length>26){for(let i=end-1;i>=11;i--)if(/[。！？、：]/.test(chars[i])){end=i+1;break;}if(chars.length-end<6)end=chars.length-6;}cards.push(chars.splice(0,end).join(''));}
 return cards;
}
export function captionEvents(segments,{size=52}={}) {
 let out='',minSeconds=Infinity,totalChars=0;const timeline=[];
 for(const s of segments) {
  const duration=s.end-s.start,cards=captionChunks(s.text);
  for(let i=0;i<cards.length;i++) {
   const a=s.start+duration*i/cards.length,b=s.start+duration*(i+1)/cards.length;
   if(b-a<.95||Array.from(cards[i]).length/(b-a)>16)throw Error('字幕を読む時間が不足しています。台本を短くしてください。');
   minSeconds=Math.min(minSeconds,b-a);totalChars+=Array.from(cards[i]).length;
   timeline.push({start:a,end:b,text:cards[i]});
   let text=wrapLabel(cards[i],13);
   const keyword=s.overlay&&Array.from(s.overlay).length<=8?assSafe(s.overlay):null;
   if(keyword&&text.includes(keyword))text=text.replace(keyword,`{\\1c&H7AE6AA&}${keyword}{\\1c&HFFFFFF&}`);
   out+=event(a,b,'Caption',`{\\an2\\pos(522,1490)\\fs${size}\\fad(55,55)}${text}`,5);
  }
 }
 return {events:out,minSeconds,totalChars,size,maxLines:2,bottom:1490,timeline};
}
