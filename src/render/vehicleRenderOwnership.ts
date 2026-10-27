import type {Object3D} from 'three';

const ownerOf=new WeakMap<Object3D,Object3D>();
const occupantsOf=new WeakMap<Object3D,Set<Object3D>>();
/** Seated peds are drawn through their vehicle by RenderOneNonRoad, not the
 * independent pedestrian pass. Retain that ownership for the host's scene roots. */
export function setVehicleRenderOwner(occupant:Object3D,vehicle?:Object3D){
 const previous=ownerOf.get(occupant);if(previous===vehicle)return;
 if(previous){const roots=occupantsOf.get(previous);roots?.delete(occupant);if(!roots?.size)occupantsOf.delete(previous);ownerOf.delete(occupant);}
 if(vehicle){let roots=occupantsOf.get(vehicle);if(!roots){roots=new Set();occupantsOf.set(vehicle,roots);}roots.add(occupant);ownerOf.set(occupant,vehicle);}
}
/** SetupEntityVisibility culls the forward first-person vehicle; its driving
 * occupants consequently receive no vehicle draw. Visibility changes only for
 * this draw, preserving pose, hit queries and subsequent camera passes. */
export function withHiddenVehicle<T>(vehicle:Object3D,draw:()=>T):T{
 const saved=[vehicle,...(occupantsOf.get(vehicle)??[])].map(root=>({root,visible:root.visible}));
 for(const {root} of saved)root.visible=false;
 try{return draw();}finally{for(const {root,visible} of saved)root.visible=visible;}
}
