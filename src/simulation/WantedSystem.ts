import type {Vec3} from '../core/math';
import {CRIME,NativeWanted} from './nativeWanted';
export {CRIME};
/** Player wanted state: native CWanted chaos, crime queue, witnesses and decay, plus the browser officers' last-known
 * position search. `arrested` is PEDSTATE_ARRESTED: CPlayerInfo::ArrestPlayer keeps the wanted level, which sets the
 * busted fee, until RestorePlayerStuffDuringResurrection clears it.
 */
export class WantedSystem {
 readonly native=new NativeWanted();
 unseen=0;arrested=false;lastKnown?:Vec3;
 private sighted=false;
 onArrest?:()=>void;
 /** CWanted::WorkOutPolicePresence around the player: living cops and active law vehicles within `radius`. */
 presence:(radius:number)=>number=()=>0;
 /** Where the player committed the crime. */
 position:()=>Vec3=()=>({x:0,y:0,z:0});
 get level(){return this.native.level;}
 /** CCrime::ReportCrime by the player. */
 /* CWanted::m_bEverybodyBackOff: while the law is told to leave the player alone, a crime raises nothing. */
 crime(type:number,victim:string|undefined,dontCare=false){if(this.arrested||this.native.everybodyBackOff)return;const before=this.level;this.native.reportCrime(type,victim,r=>this.presence(r),dontCare);if(this.level>before){this.unseen=0;this.lastKnown=this.position();}}
 /** CEventDamage::ReportCriminalEvent: queued without a witness check. */
 registerCrime(type:number,victim:string,dontCare=false){if(!this.arrested&&!this.native.everybodyBackOff)this.native.registerCrime(type,victim,dontCare);}
 see(position:Vec3){if(this.level){this.sighted=true;this.lastKnown={...position};}}
 /** CWanted::Update. `elusive`: default/desert weather region or interior; `elusiveVehicle`: law vehicle, helicopter or plane. */
 tick(dt:number,alive=true,elusive=false,elusiveVehicle=false){
  if(!alive){this.clear();return;}
  const before=this.level;this.native.update(dt,this.presence(18)>0,elusive,elusiveVehicle);
  if(this.level>before){this.unseen=0;this.lastKnown=this.position();}
  if(this.level)this.unseen=this.sighted?0:this.unseen+dt;
  else{this.unseen=0;this.lastKnown=undefined;}
  this.sighted=false;
 }
 arrest(){if(!this.level||this.arrested)return;this.arrested=true;this.onArrest?.();}
 /** CWanted::SetWantedLevel, as bribes (level − 1) use it. */
 setLevel(level:number){this.native.setWantedLevel(level);if(!this.level){this.unseen=0;this.lastKnown=undefined;}}
 /** CWanted::SetWantedLevelNoDrop: only ever raises the level; a rise is a fresh sighting. */
 setLevelNoDrop(level:number){if(level<=this.level)return;this.setLevel(level);this.unseen=0;this.lastKnown=this.position();}
 clear(){this.native.setWantedLevel(0);this.unseen=0;this.sighted=false;this.lastKnown=undefined;this.arrested=false;}
 snapshot(){return {level:this.level,chaos:this.native.chaos,searching:this.level>0&&this.unseen>2,unseen:this.unseen,arrested:this.arrested,maxCops:this.native.maxCopsInPursuit,maxCopCars:this.native.maxCopCarsInPursuit,roadBlockChance:this.native.chanceOnRoadBlock};}
}
