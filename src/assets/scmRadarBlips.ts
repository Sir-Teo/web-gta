import {requireAsset} from './binary';
import {readScmHeader,decodeScmInstructions,type ScmParameter} from './scm';

/** A sprite blip the INITIAL mission leaves on the radar. Native world x, y, z. */
export interface ScmRadarBlip {x:number;y:number;z:number;sprite:number;shortRange:boolean}

/** CRadar's sprite names (RadarBlipSpriteFilenames, Radar.cpp), by eRadarSprite. */
export const RADAR_SPRITE_NAMES:readonly (string|undefined)[]=[undefined,undefined,'radar_centre',undefined,'radar_north','radar_airYard',
 'radar_ammugun','radar_barbers','radar_BIGSMOKE','radar_boatyard','radar_burgerShot','radar_bulldozer','radar_CATALINAPINK','radar_CESARVIAPANDO',
 'radar_chicken','radar_CJ',undefined,'radar_diner','radar_emmetGun','radar_enemyAttack','radar_fire','radar_girlfriend','radar_hostpital',
 'radar_LocoSyndicate','radar_MADDOG','radar_mafiaCasino','radar_MCSTRAP','radar_modGarage','radar_OGLOC','radar_pizza','radar_police',
 'radar_propertyG','radar_propertyR','radar_race','radar_RYDER','radar_saveGame','radar_school','radar_qmark','radar_SWEET','radar_tattoo',
 'radar_THETRUTH','radar_waypoint','radar_TorenoRanch','radar_triads','radar_triadsCasino','radar_tshirt','radar_WOOZIE','radar_ZERO',
 'radar_dateDisco','radar_dateDrink','radar_dateFood','radar_truck','radar_cash','radar_flag','radar_gym','radar_impound','radar_light',
 'radar_runway','radar_gangB','radar_gangP','radar_gangY','radar_gangN','radar_gangG','radar_spray'];

const LITERAL=new Set([1,4,5,6]);
const BLIP_COMMANDS:Readonly<Record<string,{shortRange:boolean}>>={
 ADD_SPRITE_BLIP_FOR_COORD:{shortRange:false},ADD_SHORT_RANGE_SPRITE_BLIP_FOR_COORD:{shortRange:true},
 ADD_SPRITE_BLIP_FOR_CONTACT_POINT:{shortRange:false},ADD_SHORT_RANGE_SPRITE_BLIP_FOR_CONTACT_POINT:{shortRange:true}};
/** BLIP_DISPLAY_BOTH and BLIP_DISPLAY_BLIPONLY draw on the radar (CRadar::DrawCoordBlip). */
const SHOWN_DISPLAYS=new Set([2,3]);

/** The sprite blips the INITIAL mission creates, read without running the script: its global assignments give the
 * coordinates, and CHANGE_BLIP_DISPLAY and REMOVE_BLIP on the same handle are followed in order. INITIAL's blip section
 * runs straight through on a new game. */
export function readInitialRadarBlips(bytes:Uint8Array){
 const header=readScmHeader(bytes),mission=header.missions[0];requireAsset(mission,'Missing initialization mission.');
 const code=decodeScmInstructions(bytes,mission.start,mission.end);
 requireAsset(code[0]?.name==='SCRIPT_NAME'&&code[0]?.parameters[0]?.value==='INITIAL','Unexpected initialization mission name.');
 const globals=new Map<number,number>(),blips=new Map<number,ScmRadarBlip&{display:number}>();
 const read=(p:ScmParameter|undefined)=>{
  if(!p||typeof p.value!=='number')return undefined;
  if(LITERAL.has(p.type))return p.value;
  if(p.type===2)return globals.get(p.value);
  return undefined;
 };
 for(const instruction of code){
  const [a,b,c,d,e]=instruction.parameters;
  if(instruction.name==='SET_VAR_INT'||instruction.name==='SET_VAR_FLOAT'){if(a?.type===2&&typeof a.value==='number'){const v=read(b);if(v!==undefined)globals.set(a.value,v);}continue;}
  const kind=BLIP_COMMANDS[instruction.name];
  if(kind){
   const x=read(a),y=read(b),z=read(c),sprite=read(d);
   if(x===undefined||y===undefined||z===undefined||sprite===undefined||e?.type!==2||typeof e.value!=='number')continue;
   // ADD_*_SPRITE_BLIP_* start at BLIP_DISPLAY_BLIPONLY.
   blips.set(e.value,{x,y,z,sprite,shortRange:kind.shortRange,display:2});continue;
  }
  if(instruction.name==='CHANGE_BLIP_DISPLAY'&&a?.type===2&&typeof a.value==='number'){const blip=blips.get(a.value),v=read(b);if(blip&&v!==undefined)blip.display=v;continue;}
  if(instruction.name==='REMOVE_BLIP'&&a?.type===2&&typeof a.value==='number')blips.delete(a.value);
 }
 return [...blips.values()].filter(b=>SHOWN_DISPLAYS.has(b.display)).map(({display,...blip})=>blip) as ScmRadarBlip[];
}
