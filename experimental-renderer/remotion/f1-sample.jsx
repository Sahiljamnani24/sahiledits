import React from 'react';
import {AbsoluteFill, Audio, Composition, Img, OffthreadVideo, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame} from 'remotion';

// Hand-edited sample, not a general-purpose template or a claim about AI quality.
const fps = 30;
const clips = [[26.78,30.7],[32.3,35.85],[37.2,39.15],[40.45,41.7],[44.25,50.18],[62.22,64.38]];
const plan = clips.map(([start,end]) => ({start, frames: Math.round((end-start)*fps)}));
const length = plan.reduce((s,c) => s+c.frames,0);
const sec = (n) => Math.round(n*fps);
const words = [
 [0.00,'A FORMULA'],[.76,'DRIVER CAN'],[1.60,'FACE UP TO'],[2.14,'5G OF FORCE'],
 [3.18,"THAT'S"],[4.68,'ALMOST 5 TIMES'],[6.86,'THE'],[8.68,'BODY WEIGHT'],
 [9.34,'PUSHING'],[9.85,'AGAINST THEM'],[10.67,'AND THE BRAKE'],[12.00,'CAN REACH'],
 [12.76,'UP TO A'],[13.00,'TEMPERATURE OF'],[13.76,'1,000'],[15.62,'DEGREES CELSIUS'],
 [16.60,"THEY'RE NOT"],[16.98,'SLOWING DOWN'],[17.80,"THEY'RE FIGHTING"],[18.34,'PHYSICS.']
];

function Caption() {
 const frame=useCurrentFrame(), time=frame/fps;
 const idx=words.findLastIndex(([at])=>at<=time);
 if(idx<0 || (idx+1<words.length && words[idx+1][0]-words[idx][0]>1.15 && time>words[idx][0]+1.05)) return null;
 const [at,text]=words[idx];
 const pop=interpolate(time-at,[0,.13],[.9,1],{extrapolateRight:'clamp'});
 return <div style={{position:'absolute',left:35,right:35,top:910,textAlign:'center',fontFamily:'Arial, sans-serif',fontWeight:900,fontSize:55,lineHeight:1.04,color:'white',textShadow:'-3px -3px #111,3px -3px #111,-3px 3px #111,3px 3px #111,0 6px 16px #000',transform:`scale(${pop})`,zIndex:9}}>{text}</div>
}

function Stat({from,to,large,small}) {
 const frame=useCurrentFrame(); if(frame<sec(from)||frame>=sec(to)) return null;
 const enter=interpolate(frame,[sec(from),sec(from+.2)],[0,1],{extrapolateRight:'clamp'});
 const leave=interpolate(frame,[sec(to-.15),sec(to)],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 return <div style={{position:'absolute',left:42,top:135,opacity:Math.min(enter,leave),transform:`translateX(${(1-enter)*-80}px)`,fontFamily:'Arial, sans-serif',zIndex:6}}>
  <div style={{background:'#ed242b',color:'white',fontSize:23,fontWeight:900,letterSpacing:3,display:'inline-block',padding:'9px 14px'}}>{small}</div>
  <div style={{color:'white',fontSize:132,fontWeight:1000,lineHeight:1,letterSpacing:-8,textShadow:'0 7px 25px #000, 3px 3px #000'}}>{large}</div>
  <div style={{height:7,width:280*enter,background:'#ed242b'}}/>
 </div>
}

function RacingInsert({start,end,type}) {
 const f=useCurrentFrame(); if(f<sec(start)||f>=sec(end))return null;
 const local=f-sec(start), opacity=interpolate(local,[0,7],[0,1],{extrapolateRight:'clamp'});
 const exit=interpolate(f,[sec(end)-6,sec(end)],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const scale=interpolate(local,[0,sec(end-start)],[1,1.12],{extrapolateRight:'clamp'});
 const isRace=type==='race';
 return <AbsoluteFill style={{zIndex:3,opacity:Math.min(opacity,exit),backgroundColor:'#0b0e15',overflow:'hidden'}}>
  {isRace ? <OffthreadVideo muted src={staticFile('race.ogv')} trimBefore={0} style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${scale})`}}/> : <Img src={staticFile('brakes.jpg')} style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${scale})`}}/>}
  <AbsoluteFill style={{background:'linear-gradient(0deg,rgba(6,8,13,.83) 0%,transparent 55%,rgba(6,8,13,.25) 100%)'}}/>
  <div style={{position:'absolute',top:40,left:35,color:'#fff',font:'bold 18px Arial',letterSpacing:3,background:'#e5262b',padding:'9px 12px'}}>{isRace?'F1 • AUSTRALIA 2011':'RACE CAR BRAKES • LE MANS 2018'}</div>
  <div style={{position:'absolute',bottom:115,left:28,right:28,font:'18px Arial',color:'#eee',textShadow:'0 1px 4px #000'}}>{isRace?'Takashi / Wikimedia Commons · CC BY 2.0 · cropped':'Osajus / Wikimedia Commons · CC BY 2.0 · cropped'}</div>
 </AbsoluteFill>
}

function Reel() {
 const frame=useCurrentFrame(); let cursor=0;
 const zoom=1+0.025*Math.sin(frame/fps*1.5);
 return <AbsoluteFill style={{background:'#080a10',overflow:'hidden'}}>
  {plan.map((clip,i)=>{const at=cursor;cursor+=clip.frames;return <Sequence key={i} from={at} durationInFrames={clip.frames}><OffthreadVideo src={staticFile('source.mp4')} trimBefore={sec(clip.start)} durationInFrames={clip.frames} style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${zoom})`}}/></Sequence>})}
  <RacingInsert start={0.18} end={2.0} type="race"/>
  <RacingInsert start={13.45} end={15.65} type="brakes"/>
  <Stat from={2.08} to={3.18} large="5G" small="FORCE UNDER BRAKING"/>
  <Stat from={13.75} to={15.5} large="1,000°" small="BRAKE TEMPERATURE"/>
  <Caption/>
  <Audio src={staticFile('music.wav')} volume={0.15}/>
 </AbsoluteFill>
}

registerRoot(()=><Composition id="F1Sample" component={Reel} fps={fps} width={720} height={1280} durationInFrames={length}/>);
