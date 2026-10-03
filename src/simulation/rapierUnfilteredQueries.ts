import type RAPIER from '@dimforge/rapier3d-compat';
/* Physics queries without a filter stay inside the WASM.
 *
 * Rapier's JS API hands every query (castRay, castShape, projectPoint, the character controller's sweeps, the ray-cast
 * vehicle) its collider filter through ColliderSet.castClosure, which wraps even a missing filter in a closure that
 * answers nothing. Rapier then calls that closure back across the WASM boundary for every candidate collider: six times
 * a walking ped's sweep, once a ray, each call boxing its arguments (about 8 MB of garbage every 10 s from the peds'
 * sweeps alone, which a phone's collector pays for in frames). Given no function, the WASM side applies no filter and
 * calls nothing, with the same results. A filter or callback that is given is wrapped as before. */
let installed=false;
/** Makes ColliderSet.castClosure pass a missing filter through as none (once per page). */
export function installRapierUnfilteredQueries(rapier:typeof RAPIER){
 if(installed)return;installed=true;
 const set=rapier.ColliderSet.prototype as unknown as {castClosure(filter?:(collider:RAPIER.Collider)=>unknown):((handle:number)=>unknown)|undefined;get(handle:number):RAPIER.Collider|null};
 set.castClosure=function(this:typeof set,filter){return filter?handle=>filter(this.get(handle)!):undefined;};
}
