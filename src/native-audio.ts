/** Audio renders the native cue projection; it creates no musical facts. */
import {replayCovers} from './replay-report.ts';
import {renderNote,TAIL} from './render.ts';
import {decodePattern,type ScoreEvent} from './patterns-v2.ts';
import type {nativeHistory} from './native.ts';
export type NativeHistory=Awaited<ReturnType<typeof nativeHistory>>;
const number=(x:{numerator:string;denominator:string})=>Number(BigInt(x.numerator))/Number(BigInt(x.denominator));
export function nativeBar(history:NativeHistory,bar:number,sampleRate:number) {
 if(!history.mapped||!history.schedule||history.replay.status!=='reported'||!history.replay.usable||!replayCovers(history.replay.report,history.scope,history.head))return null;
 if(!Number.isSafeInteger(bar)||bar<1||!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('Invalid audio frame');
 const segments=history.schedule.segments.map(s=>({...s,seconds:240000/s.tempoMilliBpm}));
 const timing=(at:number)=>{const s=segments.filter(s=>s.bar<=at).at(-1);return s?{seconds:s.seconds,startSeconds:(number(s.startUs)+(at-s.bar)*s.seconds*1000000)/1000000}:null;};
 const frame=timing(bar);if(!frame)return null;
 const {seconds,startSeconds}=frame;
 const shortestBar=Math.min(...segments.map(s=>s.seconds)),longestStep=Math.max(...segments.map(s=>s.seconds/16));
 const samples=new Float32Array(Math.ceil(seconds*sampleRate));
 const interpretation=history.mapped.filter(e=>e.act.kind==='interpret'&&(history.schedule.cues[e.seq]?.effectBar ?? Infinity)<=bar).at(-1);
 const instruments=new Map<number,string>(),patterns=new Map<number,{seq:number;start:number;bars:number;events:ScoreEvent[]}>();
 let solo:{item:number;instrument:number;until:number}|undefined,mood:string|undefined,say:string|undefined;
 for(const row of history.mapped) {
  const cue=history.schedule.cues[row.seq],act=row.act;
  if(act.kind!=='music'||!cue||(cue.effectBar!==null&&cue.effectBar>bar))continue;
  // Native takes before transport starts remain held at bar one.
  const start=cue.effectBar ?? 1,fields=act.fields;
  switch(act.name) {
   case 'take':instruments.set(row.seq,String(fields['part']));break;
   case 'release':if(act.target!==null){instruments.delete(act.target);patterns.delete(act.target);if(solo?.instrument===act.target)solo=undefined;}break;
   case 'solo':solo={item:row.seq,instrument:fields['instrument'] as number,until:start+(fields['bars'] as number)};break;
   case 'end-solo':if(solo?.item===act.target)solo=undefined;break;
   case 'mood':mood=fields['text'] as string;break;
   case 'say':say=fields['text'] as string;break;
   case 'pattern': {
    const follows=fields['follows'] as {seq:number};
    if(interpretation&&follows.seq===interpretation.seq)patterns.set(fields['instrument'] as number,{seq:row.seq,start,bars:fields['bars'] as number,events:fields['events'] as unknown as ScoreEvent[]});
    break;
   }
  }
 }
 if(solo&&bar>=solo.until)solo=undefined;
 for(const[instrument,pattern]of patterns) {
  if(!instruments.has(instrument)||bar<pattern.start)continue;
  const loop=Math.floor((bar-pattern.start)/pattern.bars);
  // Patterns loop until their next native pattern/release. A prior occurrence
  // may still overlap this frame, including its release/echo or delayed onset.
  const gain=solo&&solo.instrument!==instrument ? 0.35:1;
  for(const event of decodePattern(pattern.bars,pattern.events)) {
   // Valid schedules have 60–180 BPM; patterns have at most256 steps. This
   // bounds earlier occurrences even when the tempo changes between frames.
   const reach=Math.ceil((event.length*longestStep+TAIL+(event.late ?? 0)*longestStep)/shortestBar)+1;
   const firstLoop=Math.max(0,loop-Math.ceil(reach/pattern.bars));
   for(let occurrence=firstLoop;occurrence<=loop;occurrence++) {
    const noteBar=pattern.start+occurrence*pattern.bars+Math.floor(event.step/16);
    if(noteBar>bar)continue;
    const onset=timing(noteBar);if(!onset)continue;
    const stepSeconds=onset.seconds/16,start=onset.startSeconds+(event.step%16+(event.late ?? 0))*stepSeconds;
    const at=Math.round(start*sampleRate)-Math.round(startSeconds*sampleRate);
    const length=Math.ceil((event.length*stepSeconds+TAIL)*sampleRate);
    if(at>=samples.length||at+length<=0)continue;
    // Render from the original onset, then slice. Starting an oscillator at
    // the frame edge would restart its envelope, glide, filter and echo.
    const rendered=renderNote(event,stepSeconds,sampleRate);
    for(let i=Math.max(0,-at),end=Math.min(rendered.length,samples.length-at);i<end;i++)samples[at+i]=samples[at+i]!+rendered[i]!*gain;
   }
  }
 }
 return {startSeconds,seconds,samples,solo:solo!==undefined,mood,say};
}
