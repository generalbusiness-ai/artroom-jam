import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGINAL_TUNES, RHYTHM, THEME } from '../src/phrases.ts';
import { CLIP_SINGS } from '../src/clip.ts';
import { captionUpdater } from '../page/captions.ts';

test('live/clip demo defaults use the exact application-owned symbolic fixtures and a newly authored onset pattern', () => {
  const retained = JSON.parse(readFileSync(new URL('../spikes/j2/themes.json', import.meta.url), 'utf8'));
  assert.deepEqual(ORIGINAL_TUNES.map(tune => ({ id: tune.id, notes: tune.notes })), retained.map((tune: {id: string; notes: unknown}) => ({ id: tune.id, notes: tune.notes })));
  assert.notDeepEqual(ORIGINAL_TUNES[0].notes, ORIGINAL_TUNES[1].notes);
  assert.equal(THEME, ORIGINAL_TUNES[0].notes);
  assert.equal(CLIP_SINGS[0].phrase.kind === 'tune' && CLIP_SINGS[0].phrase.notes, THEME);
  assert.equal(CLIP_SINGS[1].phrase.kind === 'rhythm' && CLIP_SINGS[1].phrase.onsets, RHYTHM);
  assert.deepEqual(RHYTHM, [{time:0,cls:'low'},{time:0.25,cls:'high'},{time:0.5,cls:'high'},{time:0.75,cls:'low'},{time:1,cls:'high'},{time:1.25,cls:'low'},{time:1.5,cls:'high'},{time:1.75,cls:'high'}]);
  const html=readFileSync(new URL('../page/index.html',import.meta.url),'utf8');
  for(const tune of ORIGINAL_TUNES) assert.ok(html.includes(`value="${tune.id}"`));
  assert.ok(html.includes('No microphone or model is used'));
});

test('caption rendering changes only for displayed content, preserving author/order and copying the observed value', () => {
  const renders: {by:string;text:string}[][]=[];
  const update=captionUpdater(captions=>renders.push(captions.map(c=>({...c}))));
  update([]);
  const first=[{by:'synth',text:'First'},{by:'lead',text:'Second'}];
  update(first);update(first.map(c=>({...c})));
  assert.equal(renders.length,1);
  first[0].text='Changed';update(first);
  assert.equal(renders.length,2);
  update([...first].reverse());assert.equal(renders.length,3);
  assert.deepEqual(renders[2], [{by:'lead',text:'Second'},{by:'synth',text:'Changed'}]);
  update([]);update([]);assert.equal(renders.length,4);
});
