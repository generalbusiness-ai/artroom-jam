import test from 'node:test';
import assert from 'node:assert/strict';
import type {ScopeRef,Head,Report} from '@generalbusiness/artroom-contract';
import {replayCovers} from '../src/replay-report.ts';
test('a report permits cues only for exact complete replay coverage without anchors or missing dependencies (pure predicate, no native authority)',()=>{
 const scope:ScopeRef={scope:'sha256:'+'1'.repeat(64),inc:'i0',kind:'lane'};
 const head:Head={seq:3,hash:'sha256:'+'2'.repeat(64)};
 const report:Report={mode:'replay',target:{at:scope,...head},coverage:[{scope,from:0,through:3}],anchors:[],dependencies:{verified:1,anchored:0,missing:[]},trusts:['service clock'],redacted:[],result:'consistent'};
 assert.equal(replayCovers(report,scope,head),true);
 assert.equal(replayCovers({...report,mode:'integrity'},scope,head),false);
 for(const result of ['mismatch','missing-dependency','unsupported-definition','incomplete'] as const)assert.equal(replayCovers({...report,result},scope,head),false);
 assert.equal(replayCovers({...report,target:{...report.target,hash:'sha256:'+'3'.repeat(64)}},scope,head),false);
 assert.equal(replayCovers({...report,target:{...report.target,at:{...scope,inc:'another'}}},scope,head),false);
 assert.equal(replayCovers({...report,coverage:[{scope,from:1,through:3}]},scope,head),false);
 assert.equal(replayCovers({...report,coverage:[{scope,from:0,through:2}]},scope,head),false);
 assert.equal(replayCovers({...report,anchors:[report.target]},scope,head),false);
 assert.equal(replayCovers({...report,dependencies:{verified:0,anchored:1,missing:[]}},scope,head),false);
 assert.equal(replayCovers({...report,dependencies:{verified:0,anchored:0,missing:[report.target]}},scope,head),false);
});
