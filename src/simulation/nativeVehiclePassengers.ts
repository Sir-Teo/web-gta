/* CVehicleModelInfo::GetMaximumNumberOfPassengersFromNumberOfDoors (gta-reversed 0x4C89B0, reversed), which
 * CVehicle::SetModelIndex keeps in m_nMaxPassengers. The door count is m_nNumDoors: PreprocessHierarchy counts the
 * door frames the model carries. */
const MODEL_FIRETRUK=407,MODEL_JOURNEY=508,MODEL_HUNTER=425,MODEL_RCBANDIT=441,MODEL_RCTIGER=564,MODEL_COACH=437,MODEL_BUS=431;
/** The car component table's door frames (the ones flagged bIsDoor). */
export const CAR_DOOR_FRAMES:ReadonlySet<string>=new Set(['door_rf_dummy','door_rr_dummy','door_lf_dummy','door_lr_dummy']);

export interface PassengerModel {
 modelId:number;
 /** The IDE type: car, mtruck, quad, heli, plane, trailer, bike, bmx, boat, train and the like. */
 type:string;
 /** The door frames the model carries. */
 doors:number;
 /** Handling's m_bTandemSeats. */
 tandemSeats:boolean;
 /** Whether the model has its rear seat dummy (DUMMY_SEAT_REAR). */
 rearSeat:boolean;
}

export function maximumPassengersFromDoors(m:PassengerModel){
 if(m.type==='boat'||m.type==='trailer')return 0;
 let doors:number;
 if(m.modelId===MODEL_FIRETRUK||m.modelId===MODEL_JOURNEY)doors=2;
 else if(m.modelId===MODEL_HUNTER)doors=1;
 else {
  doors=m.doors;
  if(!doors){
   if(m.type==='bike'||m.type==='bmx'||m.type==='quad'||m.tandemSeats)return m.rearSeat?1:0;
   return m.modelId===MODEL_RCBANDIT||m.modelId===MODEL_RCTIGER?0:1;
  }
 }
 if(m.tandemSeats)return Math.max(0,Math.trunc((doors-2)/2));
 if(m.modelId===MODEL_COACH||m.modelId===MODEL_BUS)return 8;
 return doors-1;
}
