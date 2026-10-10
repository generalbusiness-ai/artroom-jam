/** Whether a real replay report covers the exact native prefix Jam would play.
 * A pure predicate creates neither a report nor admission authority. */
import {TRUSTS} from '@generalbusiness/artroom-replay';
import type {FactRef,Head,Report,ScopeRef} from '@generalbusiness/artroom-contract';
const sameScope=(a:ScopeRef,b:ScopeRef)=>a.scope===b.scope&&a.inc===b.inc&&a.kind===b.kind;
export function replayCovers(report:Report,scope:ScopeRef,head:Head):boolean {
 const target:FactRef=report.target;
 const ranges=report.coverage.filter(row=>sameScope(row.scope,scope));
 return report.mode==='replay'&&report.result==='consistent'
  &&sameScope(target.at,scope)&&target.seq===head.seq&&target.hash===head.hash
  &&ranges.length===1&&ranges[0]!.from===0&&ranges[0]!.through===head.seq
  &&!report.trusts.some(t=>[TRUSTS.authority,TRUSTS.head,TRUSTS.anchors,TRUSTS.judgments,TRUSTS.facts].some(unsafe=>t===unsafe))
  &&report.anchors.length===0&&report.dependencies.anchored===0&&report.dependencies.missing.length===0;
}
