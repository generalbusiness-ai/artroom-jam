import test from 'node:test';
import assert from 'node:assert/strict';
import {musicianResponse} from '../src/musician-response.ts';

test('musician responses distinguish admission refusal from uncertain forwarding and preserve replies (scripted boundary, no native/provider authority)',async()=>{
 let forwards=0;
 const refused=await musicianResponse(async()=>{throw new Error('scripted admission refusal');},async()=>{forwards++;return new Response('unexpected');});
 assert.equal(refused.status,403);
 assert.equal(await refused.text(),'Exact native musician request unavailable; no provider dispatch');
 assert.equal(forwards,0);
 // This marker is a scripted accepted value, not a native receipt or grant.
 const original=Object.freeze({id:'scripted-original'});
 const unknown=await musicianResponse(async()=>original,async value=>{assert.equal(value,original);forwards++;throw new Error('scripted reply loss');});
 assert.equal(unknown.status,503);
 assert.equal(await unknown.text(),'Original model outcome unknown; check the same original request');
 assert.equal(forwards,1);
 const reply=new Response('scripted reply',{status:202});
 const returned=await musicianResponse(async()=>original,async value=>{assert.equal(value,original);forwards++;return reply;});
 assert.equal(returned,reply);
 assert.equal(returned.status,202);
 assert.equal(await returned.text(),'scripted reply');
 assert.equal(forwards,2);
});
