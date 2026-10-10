/** Capture this Jam declaration's existing subjects from one native snapshot.
 * These revisions are proposals; only native admission judges their currency. */
import type {DeclaredDefinition,FieldValue,Item,Summary} from '@generalbusiness/artroom-contract';
export function nativeRevisions(declaration:DeclaredDefinition,kind:string,on:number|null,fields:Readonly<Record<string,FieldValue>>,snapshot:Pick<Summary,'items'>):Record<string,number> {
 if(kind===declaration.genesis||!Object.hasOwn(declaration.acts,kind))throw new Error('Not a signable Jam act');
 const act=declaration.acts[kind]!,expected:Record<string,number>={},seen=new Set<number>();
 const bind=(name:string,item:Item|undefined,type:string)=>{
  if(!item||item.type!==type||!Number.isSafeInteger(item.id)||item.id<0||!Number.isSafeInteger(item.revision)||item.revision<0||seen.has(item.id))throw new Error('Current distinct Jam subject unavailable: '+name);
  seen.add(item.id);expected[name]=item.revision;
 };
 if(act.step==='transition') {
  if(on===null||!Number.isSafeInteger(on)||on<0||act.on===null)throw new Error('Jam transition subject required');
  bind('on',snapshot.items.find(i=>i.id===on),act.on);
 }else if(act.step!=='open'||on!==null)throw new Error('Jam opening must not name an existing primary item');
 for(const[name,rule]of Object.entries(act.also)) {
  if('one'in rule) {
   const found=snapshot.items.filter(i=>i.type===rule.item);
   if(found.length!==1)throw new Error('One current Jam subject required: '+name);
   bind(name,found[0],rule.item);
  }else if('by'in rule) {
   const id=fields[rule.by];if(typeof id!=='number'||!Number.isSafeInteger(id)||id<0)throw new Error('Jam item field required: '+rule.by);
   bind(name,snapshot.items.find(i=>i.id===id),rule.item);
  }else throw new Error('This Jam declaration uses an unsupported subject selection');
 }
 return expected;
}
