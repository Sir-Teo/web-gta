/** The iOS executable's own checks of script names, beside the PC behaviour. iOS SCRIPT_NAME (0x1001da55c) lowercases
 * A to Z of the label and these strcmp against lowercase literals; the port keeps the label as written, so they compare
 * case-blind. Most read the head of CTheScripts::pActiveScripts, the most recently started script still running. */
const lower=(name:string|undefined)=>name?.toLowerCase();

/** CCutsceneMgr::IsCutsceneSkipButtonBeingPressed (0x10013f840): nothing skips (a cutscene, a SKIP_CUTSCENE_START
 * block or IS_SKIP_CUTSCENE_BUTTON_PRESSED) while cat3, cat4, zero1, la1fin1 or bcrash1 heads the list. */
export function iosCutsceneSkipBlocked(head:string|undefined){
 const n=lower(head);return n==='cat3'||n==='cat4'||n==='zero1'||n==='la1fin1'||n==='bcrash1';
}

/** CFireManager::ExtinguishPointWithWater (0x10023d83c): the water cannon and the extinguisher put fires out 24 times
 * as fast while firetru (the firefighter side mission) is the head of the list or the script after it. */
export function iosWaterExtinguishMultiplier(head:string|undefined,second:string|undefined){
 return lower(head)==='firetru'||lower(second)==='firetru'?24:1;
}

/** CGame::Process (0x10023ebc8): from the first frame cprace or heist4 heads the list while the player is on a mission,
 * CCarCtrl::CarDensityMultiplier is forced every frame (cprace 0.75, heist4 1.0, heist4 winning when both have been
 * seen) until he is off it, over whatever SET_CAR_DENSITY_MULTIPLIER set. */
export class IosMissionCarDensity {
 private cprace=false;private heist4=false;
 /** The multiplier to force this frame, or undefined. */
 update(onMission:boolean,head:string|undefined){
  if(!onMission){this.cprace=this.heist4=false;return undefined;}
  const n=lower(head);if(n==='cprace')this.cprace=true;if(n==='heist4')this.heist4=true;
  return this.heist4?1:this.cprace?.75:undefined;
 }
}

/** PRINT (0x1001cf5c4): printing WUZ1_DA or GAR2_10 has the next pad 0 update clear DisablePlayerControls. */
export function iosPrintReleasesPlayerControls(key:string){return key==='WUZ1_DA'||key==='GAR2_10';}
