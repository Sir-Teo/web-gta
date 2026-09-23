import {worldZoneAt,type WorldZone,type WorldZones} from '../assets/worldZones';
import {zoneText} from './nativeZoneText';

/** CPlaceName::Process (0x571F20) and Display (0x571E60), which CPlayerInfo::Process runs every frame: the smallest
 * zone at the player (his vehicle's position when in one) is the place, and its translated name goes to
 * CHud::SetZoneName without `displayImmediately`, so the HUD takes a new name only once the last has faded. A place
 * whose text label matches the last one's counts as the same place. Inside an interior the original measures from the
 * entrance outside (CEntryExitManager::GetPositionRelativeToOutsideWorld); this browser keeps the last outside place
 * instead. m_nAdditionalTimer is counted down by the original and read by nothing it reverses, so it is left out. */
export class NativePlaceName {
 zone?:WorldZone;
 /** One frame: `position` in native axes (x east, y north, z up); `interior` true inside an area other than 0. */
 process(zones:WorldZones|undefined,position:readonly [number,number,number],interior:boolean){
  if(zones&&!interior){
   const smallest=worldZoneAt(zones,[position[0],position[1],position[2]]);
   if(!this.zone||smallest.textLabel!==this.zone.textLabel)this.zone=smallest;
  }
  return this.zone?zoneText(this.zone.textLabel):undefined;
 }
}
