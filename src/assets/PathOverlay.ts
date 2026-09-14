import {BufferGeometry,Float32BufferAttribute,Group,LineBasicMaterial,LineSegments} from 'three';
import type {RegionPaths} from './regionPaths';
/** Inspection-only x-ray lines. Native heights remain unchanged. */
export function pathOverlay(paths:RegionPaths){
 const root=new Group(),owners:{geometry:BufferGeometry;material:LineBasicMaterial}[]=[];
 try{
  for(const [kind,color] of [['land',0x00ffff],['pedestrian',0xffff00],['water',0x4287ff]] as const){
   const positions=paths[kind];if(positions.length%6||positions.length>600000||!positions.every(Number.isFinite))throw new Error('Invalid native path overlay.');
   const geometry=new BufferGeometry(),material=new LineBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false});owners.push({geometry,material});
   geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
   const lines=new LineSegments(geometry,material);lines.name=`Native ${kind} paths`;lines.renderOrder=11000;root.add(lines);
  }
 }catch(error){owners.forEach(o=>{o.geometry.dispose();o.material.dispose();});throw error;}
 return {root,dispose:()=>owners.forEach(o=>{o.geometry.dispose();o.material.dispose();})};
}
