import {requireAsset} from '../assets/binary';
import {ADHESION_GROUPS,type SurfaceInfoRecord} from '../assets/surfaceInfo';
import {NATIVE_WHEELBASE_SURFACE} from '../assets/surfaceIds';
import {surfaceAdhesiveLimit,type AdhesionRow} from '../assets/surfaceAdhesion';
import type {WheelSurfaceInput} from './nativeWheelParameters';
const f=(n:number)=>{const value=Math.fround(n);requireAsset(Number.isFinite(value),'Nonfinite surface wetness.');return value;};
/** Runtime GetWetMultiplier on an already prepared signed byte. This deliberately
 * does not guess SURFINFO.DAT's disputed float-to-byte conversion. */
export function nativeWetMultiplier(wetGripByte:number,wetRoads:number){
  requireAsset(Number.isInteger(wetGripByte)&&wetGripByte>=-128&&wetGripByte<=127,'Wet grip requires a prepared signed byte.');
  const wet=f(wetRoads);requireAsset(wet>=0&&wet<=1,'Invalid wet roads amount.');
  return f(f(f(wetGripByte*f(.01))*wet)+1);
}
/** Resolve wheelbase-to-road adhesion, runtime wetness and group-based off-road
 * eligibility. Record IDs and prepared wet bytes remain separate provenance. */
export function nativeSurfaceGrip(materialId:number,records:ReadonlyMap<number,SurfaceInfoRecord>,rows:readonly AdhesionRow[],wetGripByte:number,wetRoads:number,damage:{burst:boolean;burstNoise?:number}):WheelSurfaceInput{
  requireAsset(Number.isInteger(materialId)&&materialId>=0&&materialId<=178,'Invalid regular road surface ID.');
  const road=records.get(materialId),wheel=records.get(NATIVE_WHEELBASE_SURFACE);
  requireAsset(road&&wheel,'Missing road or wheelbase material record.');
  const adhesiveLimit=surfaceAdhesiveLimit(rows,wheel,road),wetMultiplier=nativeWetMultiplier(wetGripByte,wetRoads);
  requireAsset(wetMultiplier>=0,'Negative wet traction is outside the supported tire domain.');
  const group=(ADHESION_GROUPS as readonly string[]).indexOf(road.adhesionGroup);
  return {adhesiveLimit,wetMultiplier,offRoad:group>2,burst:damage.burst,burstNoise:damage.burstNoise};
}
