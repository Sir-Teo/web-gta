import {requireAsset} from '../assets/binary';
/* CCheat's flag table, pinned gta-reversed ead3051 (`Cheat.h`: `m_aCheatsActive`, and the inline `IsActive`,
 * `IsAnyActive`, `Toggle` and `Disable`, all reversed; `eCheats` in `Enums/eCheats.h`). The script turns two of
 * these on and off itself and asks whether any of three driving cheats is on; the rest belong to the cheat
 * strings a player types, which is a host's business. What is kept here is the one table they all share, rather
 * than a separate flag per command. */
/** eCheats, up to TOTAL_CHEATS. Only the entries the script and the engine reach by name are given; the table
 * itself is the full ninety-two. */
export const CHEAT_PERFECT_HANDLING=29,CHEAT_CARS_ON_WATER=35,CHEAT_BOATS_FLY=36,
 CHEAT_PROSTITUTES_PAY_YOU=90,CHEAT_ALL_TAXIS_NITRO=91,TOTAL_CHEATS=92;
/** The three the script asks about together, in AreAnyCarCheatsActivated's own order. */
export const CAR_CHEATS=[CHEAT_PERFECT_HANDLING,CHEAT_CARS_ON_WATER,CHEAT_BOATS_FLY] as const;
export class ScmCheats {
 private readonly active=new Uint8Array(TOTAL_CHEATS);
 private check(cheat:number){
  requireAsset(Number.isInteger(cheat)&&cheat>=0&&cheat<TOTAL_CHEATS,'Cheat out of range.');return cheat;
 }
 /** CCheat::IsActive. */
 isActive(cheat:number){return this.active[this.check(cheat)]===1;}
 /** CCheat::IsAnyActive. */
 isAnyActive(cheats:readonly number[]){return cheats.some(cheat=>this.isActive(cheat));}
 /** CCheat::Toggle. */
 toggle(cheat:number){this.active[this.check(cheat)]^=1;}
 /** CCheat::Disable. */
 disable(cheat:number){this.active[this.check(cheat)]=0;}
 /** What ApplyCheat comes to for a cheat with no function of its own, which is a toggle; the two the script
  * switches have none, and it switches them by name rather than by toggling. */
 set(cheat:number,on:boolean){this.active[this.check(cheat)]=on?1:0;}
 /** AreAnyCarCheatsActivated (`Scripts/Commands/GameCommands.cpp`). */
 get anyCarCheatsActivated(){return this.isAnyActive(CAR_CHEATS);}
 get count(){return this.active.reduce((total,flag)=>total+flag,0);}
}
