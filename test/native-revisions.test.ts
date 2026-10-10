import test from 'node:test';
import assert from 'node:assert/strict';
import type {DeclaredDefinition,FieldValue,Item} from '@generalbusiness/artroom-contract';
import declaration from '../definitions/jam-native-v2.json' with {type:'json'};
import {nativeRevisions} from '../src/native-revisions.ts';
test('every signable Jam act captures only its declared subject revisions from the current snapshot (pure proposal)',()=>{
 const d=declaration as DeclaredDefinition;
 const item=(id:number,type:string,revision:number):Item=>({id,type,revision,state:'held',opened:null,parties:{},refs:{},values:{},attributed:[]});
 const snapshot={items:[item(11,'configuration',7),item(20,'contribution',3),item(55,'instrument',4),item(80,'solo',2)]};
 const before=JSON.stringify(snapshot);
 const cases:Record<string,{on:number|null;fields:Record<string,FieldValue>;expected:Record<string,number>}>={
  sing:{on:null,fields:{},expected:{}},
  interpret:{on:20,fields:{},expected:{on:3,configuration:7}},
  'set-lookahead':{on:11,fields:{},expected:{on:7}},
  take:{on:null,fields:{},expected:{configuration:7}},
  release:{on:55,fields:{},expected:{on:4}},
  pattern:{on:null,fields:{instrument:55},expected:{configuration:7,instrument:4}},
  solo:{on:null,fields:{instrument:55},expected:{configuration:7,instrument:4}},
  'end-solo':{on:80,fields:{},expected:{on:2}},
  mood:{on:null,fields:{},expected:{}},
  say:{on:null,fields:{},expected:{}},
  'set-order':{on:11,fields:{},expected:{on:7}},
  'musician-request':{on:null,fields:{instrument:55},expected:{configuration:7,instrument:4}},
 };
 assert.deepEqual(Object.keys(cases).sort(),Object.keys(d.acts).filter(k=>k!==d.genesis).sort());
 for(const[k,c]of Object.entries(cases))assert.deepEqual(nativeRevisions(d,k,c.on,c.fields,snapshot),c.expected,k);
 const moved={items:snapshot.items.map(i=>({...i,revision:i.revision+1}))};
 assert.deepEqual(nativeRevisions(d,'pattern',null,{instrument:55},moved),{configuration:8,instrument:5});
 assert.throws(()=>nativeRevisions(d,'pattern',null,{instrument:55},{items:snapshot.items.filter(i=>i.id!==55)}));
 assert.throws(()=>nativeRevisions(d,'take',null,{}, {items:[...snapshot.items,item(12,'configuration',8)]}));
 assert.throws(()=>nativeRevisions(d,'release',20,{},snapshot));
 assert.throws(()=>nativeRevisions(d,'sing',20,{},snapshot));
 assert.throws(()=>nativeRevisions(d,d.genesis,null,{},snapshot));
 assert.equal(JSON.stringify(snapshot),before);
});
