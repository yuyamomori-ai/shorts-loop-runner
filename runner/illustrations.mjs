// Original editorial illustrations. Labels come from the verified sentence or
// diagram; decorative shapes are never measurements, anatomy, or study footage.
export function illustrationKind(scene) {
 const labels=scene.diagramSpec?.labels||scene.labels||[],context=(scene.sentence||'')+(scene.overlay||'')+labels.join('');
 if(scene.hook&&/記憶|覚え|思い出/.test(context))return 'memory-question';
 if(/実験室|実験条件/.test(context)&&!scene.diagramSpec)return 'study-limit';
 if(/回数|考え方|年齢/.test(context)&&!scene.diagramSpec)return 'factors';
 if(scene.diagramSpec?.type==='process'&&/映像|誤情報|記憶/.test(labels.join('')))return 'experiment';
 if(scene.diagramSpec?.type==='concept'&&/再活性|元情報/.test(context))return 'information';
 if(labels.includes('警告')&&labels.includes('誤情報')&&!scene.diagramSpec)return 'warning';
 return null;
}

export function illustrationEvents(scene,{event,vector,rect,circle,wrapLabel}) {
 const kind=illustrationKind(scene);if(!kind)return null;
 const a=scene.start,b=scene.end,ink='382718',muted='BFB29D',paper='FFFFFF',blue='EAB653',red='5562F3',gold='58D9FF';
 let out='';
 const draw=(path,color,delay=0,motion='',layer=1)=>{out+=event(a+Math.min(delay,(b-a)*.5),b,'Label',vector(path,color,'00',motion),layer);};
 const text=(str,x,y,size=56,color=ink,delay=0,width=780)=>{out+=event(a+Math.min(delay,(b-a)*.5),b,'Label',`{\\pos(${x},${y})\\fs${size}\\bord0\\1c&H${color}&\\fad(100,80)}${wrapLabel(str,Math.max(3,Math.floor(width/size)))}`,4);};
 const box=(x,y,w,h,color,delay=0)=>{draw(rect(x+10,y+14,w,h),muted,delay);draw(rect(x,y,w,h),color,delay);};
 const ring=(x,y,r,color,delay=0)=>draw(circle(x,y,r),color,delay,'\\1a&HFF&\\3c&H'+color+'&\\bord6');
 const label=(str,x,y,size=54,color=ink,width=700)=>text(str,x,y,size,color,0,width);
 const film=(x,y,w,h,delay=0)=>{box(x,y,w,h,ink,delay);draw(rect(x+12,y+18,w-24,h-36),blue,delay);draw(circle(x+w*.33,y+h*.43,h*.14),paper,delay);draw(`m ${x+w*.16} ${y+h*.79} l ${x+w*.5} ${y+h*.35} ${x+w*.84} ${y+h*.79}`,paper,delay);};
 const warning=(x,y,r,delay=0)=>{draw(`m ${x} ${y-r} l ${x+r} ${y+r*.76} ${x-r} ${y+r*.76}`,gold,delay);draw(rect(x-7,y-r*.4,14,r*.64),'382718',delay);draw(circle(x,y+r*.5,8),'382718',delay);};
 const sheet=(x,y,w,h,color,delay=0)=>{box(x,y,w,h,paper,delay);draw(rect(x,y,w,16),color,delay);for(let i=0;i<3;i++)draw(rect(x+26,y+65+i*48,w-52-i*18,8),muted,delay);};
 const arrow=(x,y,delay=0)=>draw(`m ${x-12} ${y-32} l ${x+12} ${y-32} ${x+12} ${y} ${x+36} ${y} ${x} ${y+40} ${x-36} ${y} ${x-12} ${y}`,blue,delay);
 label('説明用のイメージ',526,438,27,ink);
 if(kind==='memory-question') {
  // Two animated poses and an incoming question create an immediate visual hook.
  draw(circle(310,860,258),blue,0,'\\fscx92\\fscy92\\t(0,800,\\fscx100\\fscy100)',0);
  draw(circle(310,775,138),gold);
  draw('m 135 1110 b 122 945 498 945 486 1110',ink);
  draw(circle(265,755,13),ink);draw(circle(352,755,13),ink);
  draw(rect(242,710,48,10),ink);draw(rect(330,710,49,10),ink);
  draw(circle(310,820,23),ink,.4);
  box(615,618,252,444,ink);draw(rect(632,651,218,359),paper);
  film(655,700,166,110);
  draw(rect(654,843,173,20),muted);draw(rect(654,885,130,20),muted);
  draw(circle(810,623,71),red,.35,'\\fscx80\\fscy80\\t(0,250,\\fscx100\\fscy100)');text('?',810,626,99,'FFFFFF',.35);
  out+=event(a+.65,b,'Label',`{\\move(550,594,515,555,0,500)\\fs120\\bord4\\3c&HFFFFFF&\\1c&H${red}&\\fad(80,80)}?`,5);
  draw('m 554 773 l 590 739 601 754 567 788',red,.55);
  draw('m 523 817 l 577 803 582 823 529 837',red,.65);
 }else if(kind==='warning') {
  box(242,513,566,688,ink);draw(rect(262,548,526,615),paper);
  sheet(300,628,445,245,red);label('誤情報',522,910,78,red);
  draw(rect(206,520,652,119),gold,.28,'\\move(0,-70,0,0,0,300)');
  warning(285,577,35,.28);text('警告',551,579,74,'382718',.28);
  ring(522,951,208,blue,.7);
 }else if(kind==='experiment') {
  const labels=scene.diagramSpec.labels,n=labels.length;
  const step=(scene.activeStep??0)%n;
  if(scene.layout==='focus') {
   const str=labels[step];
   if(/映像|動画/.test(str))film(284,565,486,315);
   else if(/誤|警告/.test(str))warning(526,721,168);
   else {sheet(302,546,406,360,blue);ring(526,714,109,red);draw('m 604 795 l 694 885 672 907 582 817',red);}
   label(str,526,982,86);
   labels.forEach((str,i)=>{const x=182+i*338;draw(rect(x-104,1104,264,90),i===step?blue:paper);text(str,x+28,1150,34,ink,.1,247);});
  }else labels.forEach((str,i)=>{
   const y=566+i*(n===3?239:366),delay=i*.16;
   draw(rect(122,y-48,48,98),i===step?red:blue,delay);text(String(i+1),146,y,49,'FFFFFF',delay);
   box(210,y-75,688,160,i===step?paper:'E6DFCF',delay);
   if(/映像|動画/.test(str))film(232,y-44,126,94,delay);
   else if(/誤|警告/.test(str))warning(296,y,53,delay);
   else{ring(283,y-9,42,blue,delay);draw('m 310 '+(y+21)+' l 343 '+(y+55)+' 331 '+(y+67)+' 299 '+(y+32),blue,delay);}
   text(str,624,y,63,ink,delay,480);if(i<n-1)arrow(543,y+(n===3?140:213),delay+.1);
  });
 }else if(kind==='information') {
  const labels=scene.diagramSpec.labels,info=labels.filter(x=>!/^警告$/.test(x));
  warning(526,574,60);label(labels.find(x=>/^警告$/.test(x))||labels[0],526,693,68);
  info.forEach((str,i)=>{
   const x=i?586:137,color=i?red:blue;sheet(x,787,322,315,color,i*.2);
   if(i===0)film(x+73,845,176,102,.3);else warning(x+161,902,65,.3);
   text(str,x+161,1159,47,ink,.15,335);
  });
 }else if(kind==='factors') {
  const labels=scene.labels;
  labels.slice(0,3).forEach((str,i)=>{
   const x=282+i*253,y=609+i%2*172;
   if(/回数|繰り返し/.test(str)){sheet(x-89,y,161,184,blue);sheet(x-119,y+46,161,184,red,.18);sheet(x-149,y+92,161,184,gold,.36);}
   else if(/考|信念/.test(str)){draw(circle(x,y+124,105),blue);draw(`m ${x-64} ${y+199} l ${x-100} ${y+248} ${x-15} ${y+215}`,blue);text('?',x,y+125,135,'FFFFFF',.1);}
   else{for(let j=0;j<3;j++){const xx=x-86+j*67,yy=y+112+Math.abs(j-1)*25;draw(circle(xx,yy,27),j===1?red:blue,j*.1);draw(rect(xx-24,yy+36,48,84),j===1?red:blue,j*.1);}}
   text(str,x,y+375,62,ink,.2,226);
  });
 }else if(kind==='study-limit') {
  sheet(227,621,522,476,blue);
  film(280,682,193,120);
  ring(650,928,173,red);draw('m 759 1060 l 876 1176 846 1206 730 1088',red);
  warning(794,670,67,.25);
  text('?',650,928,166,red,.4);
 }
 if(scene.diagramSpec?.caption&&!scene.hook)label(scene.diagramSpec.caption,526,1260,30,ink,900);
 return out;
}
