import {requireAsset} from '../assets/binary';
import {nativeSurfaceId} from '../assets/surfaceIds';
import type {readProcObjects} from '../assets/vegetation';

/** ProcSurfaceInfo initialization without resolving model IDs or allocating
 * entities. Keep file order: multiple rules for one surface all run. */
export function prepareNativeProcRules(records:ReturnType<typeof readProcObjects>){
 requireAsset(records.length<=128,'Procedural surface rule capacity exceeds 128.');
 const f=Math.fround;
 return records.map(record=>{
  const surface=nativeSurfaceId(record.surface),v=record.values;
  requireAsset(surface>0&&surface<178&&!!record.modelName,'Unknown procedural surface or model.');
  const spacing=f(v.spacing),minimumDistance=f(Math.max(f(v.minDistance),80));
  // Nonpositive spacing cannot produce a bounded native grid traversal.
  requireAsset(spacing>0,'Procedural spacing must be positive.');
  const inverseSpacingSquared=f(1/f(spacing*spacing)),minimumDistanceSquared=f(minimumDistance*minimumDistance);
  requireAsset(Number.isFinite(inverseSpacingSquared)&&inverseSpacingSquared>0&&Number.isFinite(minimumDistanceSquared),'Procedural spacing or distance exceeds float32 limits.');
  return {surface,modelName:record.modelName.toLowerCase(),line:record.line,spacing,inverseSpacingSquared,minimumDistanceSquared,
   minimumRotation:f(f(v.minRotation)*f(Math.PI/180)),maximumRotation:f(f(v.maxRotation)*f(Math.PI/180)),
   minimumScaleXY:f(v.minScaleXY),maximumScaleXY:f(v.maxScaleXY),minimumScaleZ:f(v.minScaleZ),maximumScaleZ:f(v.maxScaleZ),
   minimumOffsetZ:f(v.minOffsetZ),maximumOffsetZ:f(v.maxOffsetZ),align:v.align!==0,useGrid:v.useGrid&255};
 });
}
export type NativeProcRule=ReturnType<typeof prepareNativeProcRules>[number];
