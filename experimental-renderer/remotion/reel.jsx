import React from 'react';
import {AbsoluteFill, Composition, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const FPS = 30;
const frames = (seconds) => Math.round(seconds * FPS);

// Convert source time to output time, keeping only words inside selected cuts.
export function prepareTimeline(timeline) {
  let cursor = 0;
  const clips = timeline.clips.map((clip) => {
    const duration = frames(clip.end - clip.start);
    const result = {...clip, from: cursor, duration};
    cursor += duration;
    return result;
  });
  const words = [];
  for (const clip of clips) {
    for (const word of timeline.words || []) {
      if (word.start < clip.start || word.start >= clip.end) continue;
      const start = clip.from + frames(word.start - clip.start);
      const duration = Math.max(5, Math.min(frames(0.85), frames(word.end - word.start), clip.from + clip.duration - start));
      words.push({text: word.word.trim(), start, end: start + duration});
    }
  }
  return {clips, words, duration: cursor};
}

const baseFont = 'Arial, Helvetica, sans-serif';

function Captions({words}) {
  const frame = useCurrentFrame();
  const current = words.findIndex((word) => frame >= word.start && frame < word.end);
  if (current < 0) return null;
  const group = Math.floor(current / 3) * 3;
  return <div style={{position:'absolute', left:28, right:28, top:840, textAlign:'center', fontFamily:baseFont, fontWeight:900, fontSize:53, lineHeight:1.12, textTransform:'uppercase', color:'white', textShadow:'0 3px 0 #111, 3px 0 0 #111, -3px 0 0 #111, 0 -3px 0 #111, 0 7px 15px #000', zIndex:5}}>
    {words.slice(group, group + 3).map((word, index) => <span key={group + index} style={{color:group+index===current?'#ffdf38':'white', display:'inline-block', padding:'0 5px', transform:group+index===current?'scale(1.08)':'scale(1)'}}>{word.text}</span>)}
  </div>;
}

function Graphic({item}) {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const start = frames(item.start), end = frames(item.end);
  if (f < start || f >= end) return null;
  const entrance = interpolate(f-start,[0,Math.round(fps*.22)],[0,1],{extrapolateRight:'clamp'});
  const exit = interpolate(f,[end-8,end],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const animatedNumber = Math.round(interpolate(entrance,[0,1],[0,100]));
  const number = item.text.replace(/[^0-9]/g,'');
  const value = number ? item.text.replace(number,String(Math.round(Number(number)*animatedNumber/100))) : item.text;
  return <div style={{position:'absolute',top:105,left:44,right:44,fontFamily:baseFont,opacity:Math.min(entrance,exit),transform:`translateY(${(1-entrance)*-25}px)`,zIndex:4}}>
    <div style={{borderLeft:'9px solid #ffcf22',background:'linear-gradient(105deg, rgba(9,12,19,.96), rgba(14,20,33,.84))',borderRadius:'0 18px 18px 0',padding:'19px 25px 22px',boxShadow:'0 14px 30px #0008'}}>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:4,color:'#ffcf22'}}>{item.kicker || 'KEY MOMENT'}</div>
      <div style={{fontSize:item.text.length>12?58:78,fontWeight:900,letterSpacing:-2,color:'white',lineHeight:1.05}}>{value}</div>
      <div style={{marginTop:10,height:5,width:`${entrance*100}%`,background:'linear-gradient(90deg,#ffcf22,#f05233)'}} />
    </div>
  </div>;
}

export function Reel({timeline}) {
  const {clips, words} = prepareTimeline(timeline);
  const frame = useCurrentFrame();
  const zoom = (timeline.zooms || []).find((z) => frame >= frames(z.start) && frame < frames(z.end));
  const scale = zoom ? interpolate(frame,[frames(zoom.start),frames(zoom.start)+7],[1,Math.min(1.12,zoom.scale||1.08)],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}) : 1;
  return <AbsoluteFill style={{backgroundColor:'#080a10', overflow:'hidden'}}>
    {clips.map((clip,i) => <Sequence key={i} from={clip.from} durationInFrames={clip.duration}>
      <OffthreadVideo src={staticFile('source.mp4')} trimBefore={frames(clip.start)} durationInFrames={clip.duration} style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${scale})`}} />
    </Sequence>)}
    {(timeline.graphics || []).map((g,i) => <Graphic key={i} item={g}/>)}
    <Captions words={words}/>
  </AbsoluteFill>;
}

export function Root() {
  const defaultProps = {timeline:{clips:[{start:0,end:1}], words:[], graphics:[], zooms:[]}};
  return <Composition id="SahilReel" component={Reel} fps={FPS} width={720} height={1280} durationInFrames={FPS}
    defaultProps={defaultProps}
    calculateMetadata={({props}) => ({durationInFrames: Math.max(1, prepareTimeline(props.timeline).duration)})} />;
}
