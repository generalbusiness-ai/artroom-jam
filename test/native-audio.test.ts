import test from 'node:test';
import assert from 'node:assert/strict';
import type {FactRef,Head,Report,ScopeRef} from '@generalbusiness/artroom-contract';
import {digestBytes,newIncarnation,scopeIdOf} from '@generalbusiness/artroom-bytes';
import {nativeBar,type NativeHistory} from '../src/native-audio.ts';
import {renderNote} from '../src/render.ts';
import {encodeEvent,decodePattern,type ScoreEvent} from '../src/patterns-v2.ts';
import {encodeContribution,type ScoreInterpretation} from '../src/contributions-v2.ts';
import {recordedSchedule,type RecordedInput} from '../src/recorded-v2.ts';
import type {NoteEvent} from '../src/record.ts';

// Structural input to the audio window, not native admission or a real replay.
function fixture(bars:number,events:ScoreEvent[]):NativeHistory {
 const pin=digestBytes(new Uint8Array([1]));
 const scope:ScopeRef={scope:scopeIdOf({v:1,kind:'lane',definition:pin,creator:null,cause:pin,ordinal:0}),inc:newIncarnation(new Uint8Array(16)),kind:'lane'};
 const fact=(seq:number):FactRef=>({at:scope,seq,hash:digestBytes(new Uint8Array([seq+2]))});
 const interpretation:ScoreInterpretation={kind:'tune',tempoMilliBpm:120000,tempoClear:true,key:{tonic:9,mode:'minor'},theme:[],themeBars:1,rhythm:[],rhythmBars:0};
 const mapped:RecordedInput<FactRef>[]=[
  {seq:0,timeMs:0,fact:fact(0),act:{kind:'establish',lookaheadMs:1}},
  {seq:1,timeMs:1,fact:fact(1),act:{kind:'music',name:'take',fields:{part:'lead'},actor:'structural-player',target:null}},
  {seq:2,timeMs:2,fact:fact(2),act:{kind:'sing',contribution:encodeContribution({kind:'tune',notes:[{start:0,duration:1,pitch:60,velocity:80}]})}},
  {seq:3,timeMs:3,fact:fact(3),act:{kind:'interpret',sing:2,interpretation}},
  {seq:4,timeMs:4,fact:fact(4),act:{kind:'music',name:'pattern',fields:{instrument:1,follows:{...fact(3)},bars,events:events.map(e=>({...e}))},actor:'structural-player',target:null}},
 ];
 const head:Head={seq:4,hash:fact(4).hash};
 const report:Report={mode:'replay',target:fact(4),coverage:[{scope,from:0,through:4}],anchors:[],dependencies:{verified:1,anchored:0,missing:[]},trusts:[],redacted:[],result:'consistent'};
 return {scope,pin,head,entries:[],provenance:{genesis:fact(0),source:fact(0),send:0},mapped,schedule:recordedSchedule(mapped),replay:{status:'reported',usable:true,report,why:null,display:'Structural fixture only'}};
}
function mix(target:Float32Array,note:NoteEvent,at:number,step:number,rate:number):void {
 const waveform=renderNote(note,step,rate),offset=Math.round(at*rate);
 for(let i=0;i<waveform.length&&offset+i<target.length;i++)target[offset+i]=target[offset+i]!+waveform[i]!;
}
function frames(history:NativeHistory,from:number,count:number,rate:number):Float32Array {
 const bars=Array.from({length:count},(_,i)=>nativeBar(history,from+i,rate));
 assert.ok(bars.every(b=>b!==null));
 const result=new Float32Array(bars.reduce((n,b)=>n+b!.samples.length,0));let at=0;
 for(const b of bars){assert.ok(b!.samples.every(Number.isFinite));result.set(b!.samples,at);at+=b!.samples.length;}
 return result;
}
test('native audio windows preserve cross-bar duration, loop release tails and delayed onsets without restarting note state (structural audio fixture)',()=>{
 const rate=8000,step=0.125;
 const crossing:NoteEvent={step:14,length:8,pitch:69,velocity:100,voice:'lead',from:45,glide:8,tone:'warm'};
 const tail:NoteEvent={step:30,length:2,pitch:60,velocity:80,voice:'hum'};
 const history=fixture(2,[encodeEvent(crossing),encodeEvent(tail)]);
 assert.equal(history.schedule!.cues[4]!.effectBar,2);
 const expected=new Float32Array(8*rate);
 // Two complete occurrences across four frames; the hum release crosses the
 // two-bar loop edge. Reference waveforms retain their original onset state.
 for(const onset of [1.75,5.75])mix(expected,crossing,onset,step,rate);
 for(const onset of [3.75,7.75])mix(expected,tail,onset,step,rate);
 const joined=frames(history,2,4,rate);assert.equal(joined.length,expected.length);
 assert.ok(joined.every((sample,i)=>sample===expected[i]),'Adjacent frames retain the complete original glide and loop-edge release');
 assert.ok(expected.subarray(2*rate,3*rate).some(x=>x!==0));
 assert.ok(expected.subarray(4*rate,4.1*rate).some(x=>x!==0));
 const late:NoteEvent={step:15.5,length:0.5,pitch:72,velocity:100,voice:'lead',from:48,glide:2,late:1};
 const delayed=fixture(1,[encodeEvent(late)]),lateExpected=new Float32Array(4*rate);
 mix(lateExpected,late,2.0625,step,rate);
 const lateFrames=frames(delayed,2,2,rate);assert.equal(lateFrames.length,lateExpected.length);
 assert.ok(lateFrames.every((sample,i)=>sample===lateExpected[i]),'A delayed last-step onset plays in the following frame');
 assert.equal(lateExpected.subarray(0,2.0625*rate).some(x=>x!==0),false);
 assert.ok(lateExpected.subarray(2.0625*rate).some(x=>x!==0));
 assert.equal(nativeBar({...history,replay:{status:'not-configured',usable:false,why:'Fixture has no replay'}},2,rate),null);
 assert.throws(()=>decodePattern(1,[encodeEvent(crossing)]));
 assert.throws(()=>decodePattern(1,[{...encodeEvent(late),lateUnits:1000001}]));
});
