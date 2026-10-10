/** Audio renders the native cue projection; it creates no musical facts. */
import {renderNote} from './render.ts';
import {decodePattern,type ScoreEvent} from './patterns-v2.ts';
import type {nativeHistory} from './native.ts';
export type NativeHistory=Awaited<ReturnType<typeof nativeHistory>>;
const number=(x:{numerator:string;denominator:string})=>Number(BigInt(x.numerator))/Number(BigInt(x.denominator));
export function nativeBar(history:NativeHistory,bar:number,sampleRate:number) {
 if(!Number.isSafeInteger(bar)||bar<1||!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('Invalid audio frame');
 const segment=history.schedule.segments.filter(s=>s.bar<=bar).at(-1);if(!segment)return null;
 const seconds=240000/segment.tempoMilliBpm,startSeconds=(number(segment.startUs)+(bar-segment.bar)*seconds*1000000)/1000000;
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
  const relative=((bar-pattern.start)%pattern.bars)*16;
  // Patterns loop until their next native pattern/release, never one-shot by accident.
  // A recorded lead solo lowers the accompaniment while preserving its events.
  const gain=solo&&solo.instrument!==instrument ? 0.35:1;
  for(const event of decodePattern(pattern.bars,pattern.events)) {
   if(event.step<relative||event.step>=relative+16)continue;
   const rendered=renderNote(event,seconds/16,sampleRate),at=Math.round((event.step-relative+(event.late ?? 0))*seconds/16*sampleRate);
   for(let i=0;i<rendered.length&&at+i<samples.length;i++)if(at+i>=0)samples[at+i]=samples[at+i]!+rendered[i]!*gain;
  }
 }
 return {startSeconds,seconds,samples,solo:solo!==undefined,mood,say};
}
