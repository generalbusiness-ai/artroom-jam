/** Admission refusal and uncertain forwarding are different observations.
 * This response boundary changes no original request or Durable Object custody. */
export async function musicianResponse<T>(admit:()=>Promise<T>,forward:(value:T)=>Promise<Response>):Promise<Response> {
 let accepted:T;
 try{accepted=await admit();}
 catch{return new Response('Exact native musician request unavailable; no provider dispatch',{status:403});}
 try{return await forward(accepted);}
 catch{return new Response('Original model outcome unknown; check the same original request',{status:503});}
}
