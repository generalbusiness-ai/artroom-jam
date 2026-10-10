import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGINAL_TUNES,RHYTHM} from '../src/phrases.ts';
import {interpretTune,interpretRhythm} from '../src/interpret.ts';
import {encodeContribution,decodeContribution,encodeInterpretation,decodeInterpretation} from '../src/contributions-v2.ts';
import {recordedSchedule} from '../src/recorded-v2.ts';
import {encodeEvent,decodeEvent,decodePattern} from '../src/patterns-v2.ts';
test('version two keeps original musical values and native-only positions, with derived key labels and stable recorded boundaries (pure model)',()=>{
 const before=JSON.stringify(ORIGINAL_TUNES);
 for(const tune of ORIGINAL_TUNES){const phrase={kind:'tune' as const,notes:tune.notes};assert.deepEqual(decodeContribution(encodeContribution(phrase)),phrase);const i=interpretTune(tune.notes),encoded=encodeInterpretation(i);assert.deepEqual(Object.keys(encoded.key).sort(),['mode','tonic']);assert.deepEqual(decodeInterpretation(encoded),i);assert.throws(()=>decodeInterpretation({...encoded,key:{...encoded.key,name:'fake'}} as never));}
 const tune=ORIGINAL_TUNES[0]!.notes,i=interpretTune(tune),wire=encodeInterpretation(i);
 const rows=[{seq:0,timeMs:0,fact:'native genesis',act:{kind:'establish' as const,lookaheadMs:1000}},{seq:1,timeMs:1,fact:'native confirmation',act:{kind:'native-only' as const}},{seq:2,timeMs:2,fact:'native sing',act:{kind:'sing' as const,contribution:encodeContribution({kind:'tune',notes:tune})}},{seq:3,timeMs:3,fact:'native interpretation',act:{kind:'interpret' as const,sing:2,interpretation:wire}}];
 const prefix=recordedSchedule(rows);assert.equal(prefix.origin,'native interpretation');assert.deepEqual(prefix.cues.map(c=>[c.seq,c.effectBar]),[[0,null],[1,null],[2,null],[3,1]]);
 const extended=recordedSchedule([...rows,{seq:4,timeMs:4,fact:'rules',act:{kind:'set-lookahead',lookaheadMs:1}}]);assert.deepEqual(extended.cues.slice(0,4),prefix.cues);assert.throws(()=>recordedSchedule(rows.filter(r=>r.seq!==1)));assert.deepEqual(decodeContribution(encodeContribution({kind:'rhythm',onsets:RHYTHM})),{kind:'rhythm',onsets:RHYTHM});assert.equal(encodeInterpretation(interpretRhythm(RHYTHM,i)).key.tonic,i.key.tonic);
 const event={step:0,length:0.5,pitch:60,velocity:80,voice:'stab',filter:0.5,late:0.25};assert.deepEqual(decodeEvent(encodeEvent(event)),event);assert.throws(()=>encodeEvent({...event,step:1/3}));assert.throws(()=>decodePattern(1,[{...encodeEvent(event),stepUnits:16000000}]));assert.equal(JSON.stringify(ORIGINAL_TUNES),before);
});
