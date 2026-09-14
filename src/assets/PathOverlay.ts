import {nativeTrafficLights,TRAFFIC_LIGHT} from '../world/nativeTrafficLights';
import {BufferGeometry,Float32BufferAttribute,Group,LineBasicMaterial,LineSegments,Points,PointsMaterial,Material} from 'three';
import type {RegionPaths} from './regionPaths';
/** Inspection-only x-ray lines. Native heights remain unchanged. */
export function pathOverlay(paths:RegionPaths){
  if(paths.signals.length!==paths.signalGroups.length*3||paths.signalGroups.length>100000||!paths.signals.every(Number.isFinite)||!paths.signalGroups.every(n=>n===1||n===2))throw new Error('Invalid path signal overlay.');
 const colors=new Float32BufferAttribute(new Float32Array(paths.signalGroups.length*3),3);
 const setTime=(milliseconds:number)=>{
  const states=nativeTrafficLights(milliseconds).visualCars;
  paths.signalGroups.forEach((group,i)=>{const state=states[group-1],rgb=state===TRAFFIC_LIGHT.green?[0,1,0]:state===TRAFFIC_LIGHT.yellow?[1,1,0]:[1,0,0];colors.setXYZ(i,...rgb as [number,number,number]);});colors.needsUpdate=true;
 };
 const root=new Group(),owners:{geometry:BufferGeometry;material:Material}[]=[];
 try{
  const signalGeometry=new BufferGeometry(),signalMaterial=new PointsMaterial({size:8,sizeAttenuation:false,vertexColors:true,depthTest:false,depthWrite:false,toneMapped:false});owners.push({geometry:signalGeometry,material:signalMaterial});
  signalGeometry.setAttribute('position',new Float32BufferAttribute(paths.signals,3));signalGeometry.setAttribute('color',colors);const markers=new Points(signalGeometry,signalMaterial);markers.name='Native signal phase at path anchors';markers.renderOrder=11001;root.add(markers);setTime(0);
  for(const [kind,color] of [['land',0x00ffff],['pedestrian',0xffff00],['water',0x4287ff],['oneWay',0xffffff]] as const){
   const positions=paths[kind];if(positions.length%6||positions.length>600000||!positions.every(Number.isFinite))throw new Error('Invalid native path overlay.');
   const geometry=new BufferGeometry(),material=new LineBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false});owners.push({geometry,material});
   geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
   const lines=new LineSegments(geometry,material);lines.name=`Native ${kind} paths`;lines.renderOrder=11000;root.add(lines);
  }
 }catch(error){owners.forEach(o=>{o.geometry.dispose();o.material.dispose();});throw error;}
 return {root,setTime,dispose:()=>owners.forEach(o=>{o.geometry.dispose();o.material.dispose();})};
}
