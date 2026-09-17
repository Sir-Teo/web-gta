import type {DffModel} from './dff';
import {requireAsset} from './binary';
/** Native wheel dummies per axle: single front/rear wheels on bikes, car-style pairs on the quad. */
export interface BikeWheelFrames {front:number[];rear:number[];}
export function resolveBikeWheelFrames(model:Pick<DffModel,'frames'>):BikeWheelFrames{
 const find=(name:string)=>{
  const matches:number[]=[];
  model.frames.forEach((frame,index)=>{if(frame.name===name)matches.push(index);});
  return matches;
 };
 const single=(name:string)=>{
  const matches=find(name);
  requireAsset(matches.length===1,`${modelName(model)} requires exactly one ${name} frame; found ${matches.length}.`);
  requireAsset(model.frames[matches[0]].parent>=0,'Bike wheel dummy cannot be a clump root.');
  return matches;
 };
 const carStyle={frontLeft:find('wheel_lf_dummy'),frontRight:find('wheel_rf_dummy'),rearLeft:find('wheel_lb_dummy'),rearRight:find('wheel_rb_dummy')};
 if(Object.values(carStyle).every(matches=>matches.length===1)){
  const frames=[...carStyle.frontLeft,...carStyle.frontRight,...carStyle.rearLeft,...carStyle.rearRight];
  requireAsset(frames.every(i=>model.frames[i].parent>=0),'Bike wheel dummy cannot be a clump root.');
  return {front:[...carStyle.frontLeft,...carStyle.frontRight],rear:[...carStyle.rearLeft,...carStyle.rearRight]};
 }
 return {front:single('wheel_front'),rear:single('wheel_rear')};
}
function modelName(model:Pick<DffModel,'frames'>){return model.frames[0]?.name?`Bike ${model.frames[0].name}`:'Bike';}
