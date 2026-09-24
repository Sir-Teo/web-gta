import {SOUND,type NativeAudioEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
import {NativeTwinLoopSound} from './NativeTwinLoopSound';
import {AE} from './NativeVehicleAudio';
import {audioLog10,clamp,lerp,piecewiseLinear,randomFloat,resolveProbability,stepTo,type AudioRandom} from './nativeAudioUtility';
const EVENT={thunder:1,thunderRollOff:2,cityNoise:3,windLeft:4,windRight:5} as const;
const DEFAULT_POS:NativeVec={x:-.906,y:0,z:.423};
/** A city-noise probe hit: the point, the hit entity's physical term (zero for buildings) and the entity itself. */
export interface CityNoiseLos {point:NativeVec;physical:NativeVec;entity:unknown}
export interface NativeWeatherAudioInput {
  /** CWeather::Rain, WindClipped and LightningDuration. */
  rain:number;windClipped:number;lightningDuration:number;
  /** CCullZones::PlayerNoRain/CamNoRain. */
  noRain:boolean;
  /** CGame::CanSeeOutSideFromCurrArea. */
  outside:boolean;
  cameraZ:number;
  /** City-noise whoosh inputs (CAEWeatherAudioEntity::UpdateParameters CITY_NOISE). */
  city?:{camPos:NativeVec;camRight:NativeVec;camForward:NativeVec;playerPos:NativeVec;inVehicle:boolean;moveSpeed:NativeVec;los:(origin:NativeVec,target:NativeVec)=>CityNoiseLos|undefined};
}
/** CAEWeatherAudioEntity (gta-reversed 0076f901; AddAudioEvent from PR #1225): rain loops and drops, thunder, wind and city noise. */
export class NativeWeatherAudio implements NativeAudioEntity {
 /** m_sfRainVolume (0x8CC30C). */
 rainVolume=-100;
 private rainL:NativeTwinLoopSound;private rainR:NativeTwinLoopSound;private lastRainDrop=2;
  private thunderVariation=0;private windGust=false;private windOffset=0;private windFreq=0;private oldFreq=1;
  private lastL?:unknown;private lastR?:unknown;
 private input:NativeWeatherAudioInput={rain:0,windClipped:0,lightningDuration:0,noRain:false,outside:true,cameraZ:0};
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private random:AudioRandom,private defaultVolume:(event:number)=>number){
  this.rainL=new NativeTwinLoopSound(manager,random);this.rainR=new NativeTwinLoopSound(manager,random);
 }
 private ensureLoaded(bank:number,slot:number){if(this.bank.isSoundBankLoaded(bank,slot))return true;this.bank.loadSoundBank(bank,slot);return false;}
 /** AddAudioEvent(AE_THUNDER) (0x506800): near and rolled-off distant cracks on both sides, the left two semitones lower. */
 thunder(){
  const input=this.input;
  if(!input.outside||input.noRain||!this.ensureLoaded(BANK.explosions,SLOT.explosions))return;
  this.thunderVariation=(this.thunderVariation+1)%3;
  const variation=[1.15,1,.85][this.thunderVariation],right=variation*.4,left=right*.8908987181403393,flags=SOUND.frontEnd|SOUND.uncancellable|SOUND.requestUpdates;
  const posLeft={x:-.906,y:.423,z:0},posRight={x:.906,y:.423,z:0};
  this.manager.playSound({slot:SLOT.explosions,sound:4,entity:this,position:posLeft,volume:-100,speed:left,flags,event:EVENT.thunder});
  this.manager.playSound({slot:SLOT.explosions,sound:4,entity:this,position:posRight,volume:-100,speed:right,flags,event:EVENT.thunder});
  const volume=this.defaultVolume(AE.thunder)+Math.log10(input.lightningDuration*.0375)*20;
  this.manager.playSound({slot:SLOT.explosions,sound:1,entity:this,position:posLeft,volume,speed:left,flags:flags|SOUND.rolledOff,event:EVENT.thunderRollOff});
  this.manager.playSound({slot:SLOT.explosions,sound:1,entity:this,position:posRight,volume,speed:right,flags:flags|SOUND.rolledOff,event:EVENT.thunderRollOff});
 }
 /** UpdateParameters (0x505A00). */
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition<=0)return;
  const input=this.input;
  const fadeOut=()=>{if(sound.volume<=-50)sound.stopSoundAndForget();else sound.volume=Math.max(-50,sound.volume-.6);};
  if(sound.event===EVENT.thunder){
   const duration=input.lightningDuration,requested=audioLog10(duration*.0375+.25)*20+this.defaultVolume(AE.thunder),position=600-500*Math.trunc(duration/20);
   if(playPosition>position){
    if(playPosition>position+200||requested<=0)sound.volume=Math.min(0,requested);
    else{const v=10**(requested/20);sound.volume=audioLog10((playPosition-position)*(1-v)/200+v)*20;}
   }else sound.volume=audioLog10(playPosition/position)*20+requested;
  }else if(sound.event===EVENT.windLeft||sound.event===EVENT.windRight){
    const z=clamp(input.cameraZ/500,0,1);
    const ratio=lerp(piecewiseLinear([[0,0],[.3,.4],[1,.5]],z),piecewiseLinear([[0,.5],[.3,1],[1,1]],z),clamp(input.windClipped,0,1));
    if(resolveProbability(this.random,.07))this.windGust=!this.windGust;
    // The decompiled gust writes land on the flag; the offsets and a frequency stepping toward the gust (never below 1) are reconstructed.
    this.windOffset=this.windGust?21*ratio:0;this.windFreq=this.windGust?1.2*ratio:0;
    if(!input.outside){fadeOut();return;}
    sound.volume=stepTo(sound.volume,this.windOffset-33,.6);
    this.oldFreq=Math.max(1,stepTo(this.oldFreq,this.windFreq,.1));sound.speed=this.oldFreq;
   }else if(sound.event===EVENT.cityNoise){
    if(!input.outside){fadeOut();return;}
    const city=input.city;
    if(!city){this.updateCitySound(sound,1,0);return;}
    const right=sound.currPos.x===DEFAULT_POS.x&&sound.currPos.y===DEFAULT_POS.y&&sound.currPos.z===DEFAULT_POS.z;
    const pov={...city.camPos};if(city.playerPos)pov.z=city.playerPos.z;
    if(right)this.processCitySide(sound,pov,{x:pov.x+city.camRight.x*4,y:pov.y+city.camRight.y*4,z:pov.z+city.camRight.z*4},{x:pov.x+city.camRight.x,y:pov.y+city.camRight.y,z:pov.z+city.camRight.z},city,true);
    else this.processCitySide(sound,pov,{x:pov.x-city.camRight.x*4,y:pov.y-city.camRight.y*4,z:pov.z-city.camRight.z*4},{x:pov.x-city.camRight.x,y:pov.y-city.camRight.y,z:pov.z-city.camRight.z},city,false);
   }
  }
  /** UpdateSound (0x505F56): the ramp toward default + volume adds `volume` each step, so a whoosh jumps straight to its
   * level and a far one drops at once. The boost residue is never set, so its branch is skipped. */
  private updateCitySound(sound:NativeSound,speed:number,volume:number){
   const target=volume+this.defaultVolume(AE.cityNoise);
   if(sound.volume<target)sound.volume=Math.min(volume+sound.volume+.3,target);
   else if(sound.volume>target)sound.volume=Math.max(volume+sound.volume-.3,target);
   sound.speed=speed;
  }
  private processCitySide(sound:NativeSound,pov:NativeVec,origin:NativeVec,target:NativeVec,city:NonNullable<NativeWeatherAudioInput['city']>,right:boolean){
   const hit=city.los(origin,target);
   const last=right?this.lastR:this.lastL;
   // Only the first frame an entity turns up in the probe answers; lastEntity changes only then.
   if(hit&&hit.entity!==last&&Math.abs(city.camPos.z-pov.z)<6){
    const vel=city.inVehicle?city.moveSpeed:{x:0,y:0,z:0};
    const fwdLength=Math.hypot(city.camForward.x,city.camForward.y,city.camForward.z)||1;
    const fwd={x:city.camForward.x/fwdLength,y:city.camForward.y/fwdLength,z:city.camForward.z/fwdLength};
    const force=Math.abs((vel.x*fwd.x+vel.y*fwd.y+vel.z*fwd.z)-(hit.physical.x*fwd.x+hit.physical.y*fwd.y+hit.physical.z*fwd.z));
    if(force>.35){
     const speed=(force-.35)/.95;
     const dist=Math.hypot(pov.x+city.camRight.x*(right?1:-1)-hit.point.x,pov.y+city.camRight.y*(right?1:-1)-hit.point.y,pov.z+city.camRight.z*(right?1:-1)-hit.point.z);
     this.updateCitySound(sound,speed*1.75+1.75,audioLog10((1-dist/.6)*speed)*20+30);
    }
    if(right)this.lastR=hit.entity;else this.lastL=hit.entity;
   }else this.updateCitySound(sound,1,0);
  }
 /** Service (0x5052F0), once per frame from CWeather::Update. */
  service(input:NativeWeatherAudioInput){
   this.input=input;
   if(input.outside&&this.ensureLoaded(BANK.frontendGame,SLOT.frontendGame)){
    const flags=SOUND.forcedFront|SOUND.startPercentage|SOUND.requestUpdates|SOUND.frontEnd;
    for(const [sfx,event,playTime] of [[29,EVENT.windLeft,0],[30,EVENT.windRight,50]] as const)
     if(!this.manager.areSoundsOfThisEventPlayingForThisEntity(event,this))this.manager.playSound({slot:SLOT.frontendGame,sound:sfx,entity:this,position:DEFAULT_POS,volume:-50,flags,playTime,event});
    // City noise is one event played twice at half-loop offset (stereo bed); check once so the second start is not blocked.
    if(!this.manager.areSoundsOfThisEventPlayingForThisEntity(EVENT.cityNoise,this))
     for(const playTime of [0,50] as const)this.manager.playSound({slot:SLOT.frontendGame,sound:0,entity:this,position:DEFAULT_POS,volume:-50,flags,playTime,event:EVENT.cityNoise});
   }
  if(input.rain<=0||input.noRain||!input.outside)this.updateRainSounds(-100);
  else{this.rainVolume=Math.max(this.rainVolume,-50);this.updateRainSounds(this.defaultVolume(AE.rain)+audioLog10(Math.max(input.rain-.2,0)/.8)*20);}
 }
 private updateRainSounds(target:number){
  this.rainVolume=stepTo(this.rainVolume,target,.5);
  if(target===-100&&this.rainVolume<=-50){this.rainVolume=-100;if(this.rainL.active)this.rainL.stopSoundAndForget();if(this.rainR.active)this.rainR.stopSoundAndForget();return;}
  for(const [loop,x] of [[this.rainL,-.906],[this.rainR,.906]] as const){
   if(loop.active){
    loop.updateTwinLoopSound({x,y:0,z:.423},this.rainVolume,1);
    if(loop.doSoundsSwitchThisFrame()){
     this.lastRainDrop=this.lastRainDrop+1<=11?this.lastRainDrop+1:2;
     this.manager.playSound({slot:SLOT.weather,sound:this.lastRainDrop,position:{x,y:resolveProbability(this.random,.5)?.423:-.423,z:0},volume:randomFloat(this.random,-6,6)+this.rainVolume-15,flags:SOUND.uncancellable|SOUND.frontEnd});
    }
   }else if(this.ensureLoaded(BANK.rain,SLOT.weather)){
    loop.initialise(SLOT.weather,1,0,65,350);
    loop.playTwinLoopSound({x,y:.423,z:0},this.rainVolume,1,1,1,SOUND.startPercentage|SOUND.uncancellable|SOUND.frontEnd);
   }
  }
 }
 snapshot(){return {rainVolume:+this.rainVolume.toFixed(2),rainLoops:+this.rainL.active+ +this.rainR.active,wind:this.windGust};}
}
