import {Mesh,Vector3,type Material,type Object3D} from 'three';
import {requireAsset} from '../assets/binary';
import {NativeBoatFlap,type BoatFlapMotion} from '../simulation/nativeBoatFlap';
/** CBoat::PreRender (PC 0x6F1180, selected iOS 0x10045b230). */
export const BOAT_PROP_TURN=Math.fround(2*Math.PI),BOAT_PROP_DIVISOR=Math.fround(Math.PI/8);
export function boatPropellerStep(angle:number,engineSpeed:number,timeStep:number){
 requireAsset([angle,engineSpeed,timeStep].every(Number.isFinite)&&angle>=0&&angle<=BOAT_PROP_TURN&&engineSpeed>=0&&timeStep>=0,'Invalid boat propeller state.');
 const speed=Math.fround(engineSpeed),fraction=Math.min(1,Math.fround(Math.fround(speed+speed)/BOAT_PROP_DIVISOR));
 const staticAlpha=Math.trunc(Math.fround(Math.fround(1-fraction)*255));
 let nextAngle=Math.fround(Math.fround(angle)+Math.fround(speed*Math.fround(timeStep)));
 while(nextAngle>BOAT_PROP_TURN)nextAngle=Math.fround(nextAngle-BOAT_PROP_TURN);
 return {angle:nextAngle,staticAlpha:staticAlpha&255,movingAlpha:Math.max(0,150-staticAlpha)&255};
}
/** Names from the pinned executable's boat descriptor table, matching eBoatNodes. */
export const BOAT_COMPONENT_NAMES={moving:'boat_moving_hi',rudder:'boat_rudder_hi',rearLeft:'boat_rearflap_left',rearRight:'boat_rearflap_right',staticProp:'static_prop',movingProp:'moving_prop',staticProp2:'static_prop2',movingProp2:'moving_prop2',flap:'boat_flap_left'} as const;
function rotate(node:Object3D|undefined,axis:'y'|'z',angle:number){
 if(!node)return;const e=node.matrix.elements,x=e[12],y=e[13],z=e[14],s=Math.fround(Math.sin(angle)),c=Math.fround(Math.cos(angle));
 // SetRotate*Only replaces the basis and preserves current translation, including scripted offsets.
 if(axis==='y')node.matrix.set(c,0,s,x,0,1,0,y,-s,0,c,z,0,0,0,1);
 else node.matrix.set(c,-s,0,x,s,c,0,y,0,0,1,z,0,0,0,1);
 node.matrixWorldNeedsUpdate=true;
}
function atomicMaterials(node:Object3D|undefined):Material[]{
 // GetCurrentAtomicObjectCB selects the last drawn atomic attached to this frame, without visiting child frames.
 const mesh=node?.children.filter(o=>o instanceof Mesh&&o.userData.nativeAtomic!==undefined).at(-1) as Mesh|undefined;
 return mesh?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[];
}
export function bindNativeBoatComponents(root:Object3D,model:number){
 const nodes=Object.fromEntries(Object.entries(BOAT_COMPONENT_NAMES).map(([role,name])=>[role,root.getObjectByName(name)])) as Record<keyof typeof BOAT_COMPONENT_NAMES,Object3D|undefined>;
 const props=[['staticProp',2,false],['movingProp',-1,true],['staticProp2',-2,false],['movingProp2',1,true]] as const;
 const materials=props.map(([role])=>atomicMaterials(nodes[role])),opacity=new WeakMap<Material,number>();
 // SetComponentAtomicAlpha enables rpGEOMETRYMODULATEMATERIALCOLOR: use the stored native RGB even if
 // the source geometry originally ignored it. Source records and unrelated materials remain untouched.
 for(const group of materials)for(const material of group){const rgb=material.userData.nativeFadeColor,color=(material as Material&{color?:{setRGB(r:number,g:number,b:number):void}}).color;if(rgb&&color)color.setRGB(rgb[0],rgb[1],rgb[2]);}
 const point=new Vector3();
 let angle=0,scan=0;const radar=model===430||model===453||model===454;
 const flap=model===484&&nodes.flap?new NativeBoatFlap():undefined;
 return {
  needsMotion:!!flap,
  opacity:(material:Material)=>opacity.get(material),
  propellerPositions:()=>{root.updateWorldMatrix(true,true,true);return [nodes.staticProp,nodes.staticProp2].map(node=>{if(!node)return undefined;point.setFromMatrixPosition(node.matrixWorld);return {x:point.x,y:point.y,z:point.z};});},
  snapshot:()=>({angle,scan,flap:flap?{angle:flap.angle,angVel:flap.angVel,state:flap.state}:undefined,nodes:Object.fromEntries(Object.entries(nodes).map(([role,node])=>[role,!!node])),propMaterials:materials.map(m=>m.length)}),
  update(engineSpeed:number,steerAngle:number,seconds:number,motion?:BoatFlapMotion){
   const state=boatPropellerStep(angle,engineSpeed,Math.fround(seconds*50));angle=state.angle;
   for(const role of ['rudder','rearLeft','rearRight'] as const)rotate(nodes[role],'z',Math.fround(-steerAngle));
   props.forEach(([role,multiplier,blurred],i)=>{rotate(nodes[role],'y',Math.fround(angle*multiplier));for(const material of materials[i])opacity.set(material,(blurred?state.movingAlpha:state.staticAlpha)/255);});
   if(radar){rotate(nodes.moving,'z',scan);scan=Math.fround(scan+Math.fround(seconds));}
   if(flap&&motion){const e=nodes.flap!.matrix.elements;flap.step([e[12],e[13],e[14]],motion,Math.fround(seconds*50));rotate(nodes.flap,'z',flap.angle);}
  },
 };
}
