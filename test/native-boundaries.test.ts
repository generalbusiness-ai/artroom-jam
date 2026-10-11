import test from 'node:test';
import assert from 'node:assert/strict';
import type {DeclaredDefinition,Entry,ScopeApi,ScopeRef,Seed,Summary} from '@generalbusiness/artroom-contract';
import {PROPOSED_BOUNDS,HISTORY_PAGE_ENTRIES} from '@generalbusiness/artroom-contract';
import {canonicalize,definitionDigest,entryHash,factRefOf,newIncarnation,scopeIdOf,signIntent} from '@generalbusiness/artroom-bytes';
import {ScopeHandle} from '@generalbusiness/artroom-client';
import {prepareRules,validateDefinition} from '@generalbusiness/artroom-derive';
import {evaluateRules,RULE_PROFILES} from '@generalbusiness/artroom-derive/rule';
import {Scope,keys,directory,d,forged,T0} from '@generalbusiness/artroom-derive/testing';
import declaration from '../definitions/jam-native-v2.json' with {type:'json'};
import {nativeHistory,NativeHistoryError,type NativeRoom} from '../src/native.ts';

test('solo admission uses the real prepared also.configuration subject and refuses above its configured limit (in-memory SDK judge, no deployed authority)',async()=>{
 const checked=validateDefinition(declaration,PROPOSED_BOUNDS,RULE_PROFILES);
 assert.equal(checked.ok,true);
 if(!checked.ok)throw new Error('Jam declaration is unsupported');
 // The staged SDK's public fixture entry labels its genesis and grants as test authority.
 // All instrument acts and solo judgments below use the genuine SDK judge.
 const room=new Scope(checked.definition);
 room.did(keys.rita,'take',{fields:{part:'synth'},expected:{configuration:room.item(0).revision}});
 room.did(keys.una,'take',{fields:{part:'percussion'},expected:{configuration:room.item(0).revision}});
 const lead=room.did(keys.vic,'take',{fields:{part:'lead'},expected:{configuration:room.item(0).revision}});
 const configured=room.item(0).values['soloMaxBars'];
 assert.equal(configured,8);
 const expected={configuration:room.item(0).revision,instrument:room.item(lead.seq).revision};
 const within=room.intent(keys.vic,'solo',{fields:{instrument:lead.seq,bars:8},expected});
 const asked=prepareRules(room.state,checked.definition,{act:within,context:room.context()});
 assert.deepEqual(asked.map(r=>r.rule),['solo-length']);
 const input=asked[0]!.input as {subjects:Record<string,{values:Record<string,unknown>}>};
 assert.equal(Object.hasOwn(input.subjects,'configuration'),false);
 assert.equal(input.subjects['also.configuration']!.values['soloMaxBars'],configured);
 const prepared=await evaluateRules(asked);
 assert.equal(prepared[0]!.result,true);
 assert.equal(room.judge(within,{prepared}).result,'write');
 // Do not record the permitted solo: the above-limit judgment must reach its
 // configured length guard, rather than refuse because another solo is held.
 const above=room.intent(keys.vic,'solo',{fields:{instrument:lead.seq,bars:9},expected});
 const abovePrepared=await evaluateRules(prepareRules(room.state,checked.definition,{act:above,context:room.context()}));
 assert.equal(abovePrepared[0]!.result,false);
 const refused=room.judge(above,{prepared:abovePrepared});
 assert.equal(refused.result,'refused');
 if(refused.result!=='refused')throw new Error('Above-limit solo was not refused');
 assert.equal(refused.reason,'guard-failed');
 assert.equal(refused.name,'solo-too-long');
 assert.equal(refused.detail,'guards.4');
 assert.equal(room.entries.length,5);
});

test('native history continues a bounded page to a complete frontier and refuses an incomplete terminal or invalid cursor (scripted transport, no replay or deployed authority)',async()=>{
 const declared=declaration as DeclaredDefinition,pin=definitionDigest(declared);
 const seed:Seed={v:1,kind:'lane',definition:pin,creator:directory,cause:d('c'),ordinal:0};
 const ref:ScopeRef={scope:scopeIdOf(seed),inc:newIncarnation(new Uint8Array(16).fill(21)),kind:'lane'};
 const signed=(to:ScopeRef,kind:string,key:string)=>signIntent({v:1,to,actor:keys.rita.key,kind,on:null,expected:{},fields:{text:'own fixture cue'},idempotencyKey:key,notAfter:'2026-10-04T12:01:00Z'},keys.rita.secret);
 const create={class:'request' as const,type:'create',body:{fields:{opener:keys.rita.member,interpreter:keys.rita.member,lookaheadMs:1000}}};
 // Parent entries are explicitly scripted provenance, not native creation proof.
 const origin=forged(directory,17,{type:'act',signed:signed(directory,'create','origin'),authority:[],presented:{}},[{n:0,to:seed,message:create}]).entry;
 const source=factRefOf(origin);
 const entries:Entry[]=[];
 const append=(input:Entry['input'],effects:Entry['effects'])=>{
  const entry:Entry={v:1,at:ref,seq:entries.length,prev:entries.length?entryHash(entries.at(-1)!):null,time:T0,clamped:false,epoch:0,input,uses:[],prepared:[],effects,sends:[]};
  entries.push(entry);return entry;
 };
 const genesis=append({type:'genesis',seed,inc:ref.inc,kind:'establish',founding:null,source,n:0,message:create,decision:'applied'},[{effect:'open',item:0,type:'configuration',state:'ready'}]);
 const confirm={class:'control' as const,type:'confirm' as const,genesis:factRefOf(genesis)};
 const control=forged(directory,18,{type:'act',signed:signed(directory,'confirm','control'),authority:[],presented:{}},[{n:0,to:ref,message:confirm}]).entry;
 append({type:'delivery',from:factRefOf(control),n:0,message:confirm},[{effect:'activate'}]);
 while(entries.length<=HISTORY_PAGE_ENTRIES){
  const seq=entries.length;
  append({type:'act',signed:signed(ref,'say','cue-'+seq),authority:[],presented:{}},[{effect:'open',item:seq,type:'say',state:'recorded'},{effect:'party',item:seq,slot:'player',member:keys.rita.member},{effect:'value',item:seq,slot:'text',value:'own fixture cue'}]);
 }
 const head={seq:entries.length-1,hash:entryHash(entries.at(-1)!)},sealed=entries.map(entry=>({entry,hash:entryHash(entry)}));
 const summary:Summary={scope:ref,status:'active',definition:pin,time:T0,items:[],counts:[]};
 let terminalComplete=true,invalidCursor=false,replayCalls=0;
 const cursors:(string|undefined)[]=[],parentReads:number[]=[];
 const unused=async():Promise<never>=>{throw new Error('Unexpected mutation or read in native-history fixture');};
 const transport:ScopeApi={found:unused,submit:unused,prepare:unused,settle:unused,items:unused,outbox:unused,duty:unused,log:unused,
  async summary(scope,reader){assert.equal(scope,ref.scope);assert.equal(reader,'fixture-reader');return{ok:true,at:head,value:summary,complete:true};},
  async retained(scope,reader,kind,digest){assert.equal(scope,ref.scope);assert.equal(reader,'fixture-reader');assert.equal(kind,'definition');assert.equal(digest,pin);return{ok:true,at:head,value:{kind:'definition',digest:pin,bytes:canonicalize(declared)},complete:true};},
  async history(scope,reader,cursor){
   assert.equal(scope,ref.scope);assert.equal(reader,'fixture-reader');cursors.push(cursor);
   if(cursor===undefined)return{ok:true,at:head,value:sealed.slice(0,HISTORY_PAGE_ENTRIES),complete:false,next:invalidCursor?'':'next-page'};
   assert.equal(cursor,'next-page');return{ok:true,at:head,value:sealed.slice(HISTORY_PAGE_ENTRIES),complete:terminalComplete};
  },
  async entry(scope,reader,seq){assert.equal(scope,directory.scope);assert.equal(reader,'fixture-reader');parentReads.push(seq);const entry=seq===17?origin:seq===18?control:null;if(!entry)return{ok:false,reason:'not-found'};return{ok:true,at:{seq:18,hash:entryHash(control)},value:{entry,hash:entryHash(entry)},complete:true};},
 };
 const room:NativeRoom={ref,pin,declaration:declared,handle:new ScopeHandle(transport,ref.scope,'fixture-reader'),creator:at=>{assert.deepEqual(at,directory);return new ScopeHandle(transport,at.scope,'fixture-reader');},replay:async(at,captured)=>{assert.deepEqual(at,ref);assert.deepEqual(captured,head);replayCalls++;return{status:'not-configured',usable:false,why:'Fixture supplies no replay authority'};}};
 const read=await nativeHistory(room);
 assert.deepEqual(cursors,[undefined,'next-page']);
 assert.equal(read.entries.length,HISTORY_PAGE_ENTRIES+1);
 assert.deepEqual(read.head,head);
 assert.deepEqual(parentReads,[17,18]);
 assert.equal(replayCalls,1);
 assert.equal(read.mapped,null);
 assert.equal(read.schedule,null);
 terminalComplete=false;cursors.length=0;parentReads.length=0;
 await assert.rejects(nativeHistory(room),{name:'NativeHistoryError',message:'Incomplete retained native history'});
 assert.deepEqual(cursors,[undefined,'next-page']);
 assert.deepEqual(parentReads,[]);
 assert.equal(replayCalls,1);
 terminalComplete=true;invalidCursor=true;cursors.length=0;
 await assert.rejects(nativeHistory(room),NativeHistoryError);
 assert.deepEqual(cursors,[undefined]);
 assert.equal(replayCalls,1);
});
