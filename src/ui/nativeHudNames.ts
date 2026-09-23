/* The zone and vehicle names in the bottom-right corner, pinned gta-reversed
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166: CHud::SetZoneName, DrawAreaName (0x58AA50),
 * SetVehicleName and DrawVehicleName (0x58AEA0) in Hud.cpp. A name fades in over 1 s,
 * holds until 3 s after it began and fades out over 1 s; a new name while one shows fades the old one out
 * first. The zone name and the vehicle name push each other out, and the zone name
 * steps aside for a small message or a bottom-right or white-middle big message.
 * The camera-fade pauses in DrawAreaName are not reproduced. Times are milliseconds. */

export const NAME_DONT_SHOW=0,NAME_SHOW=1,NAME_FADE_IN=2,NAME_FADE_OUT=3,NAME_SWITCH=4;
interface NameSlot {state:number;nameTimer:number;fadeTimer:number;toPrint?:string;last?:string}
const slot=():NameSlot=>({state:NAME_DONT_SHOW,nameTimer:0,fadeTimer:0});
export interface DrawnName {text:string;alpha:number}

export class NativeHudNames {
 readonly zone=slot();readonly vehicle=slot();
 private zoneName?:string;private vehicleName?:string;
 /** CHud::SetZoneName: without `immediately`, only taken while no zone name is showing. */
 setZoneName(name:string|undefined,immediately=false){if(immediately||this.zone.state===NAME_DONT_SHOW)this.zoneName=name;}
 /** CCurrentVehicle::Display: the player's vehicle name, or undefined on foot. */
 setVehicleName(name:string|undefined){this.vehicleName=name;}
 /** One frame of DrawAreaName then DrawVehicleName, as CHud::DrawAfterFade orders them. */
 /** `areaNameOff`: CHud::DrawAfterFade skips DrawAreaName, its state frozen, while the player flies a plane or a
  * helicopter or the script has turned zone names off (DISPLAY_ZONE_NAMES). */
 update(dtMs:number,o:{message?:boolean;bigMessage?:boolean;areaNameOff?:boolean}={}):{zone?:DrawnName;vehicle?:DrawnName}{
  return {zone:o.areaNameOff?undefined:this.drawAreaName(dtMs,o),vehicle:this.drawVehicleName(dtMs,!!o.message)};
 }
 /** CHud::DrawBustedWastedMessage's first frame: both names go at once. */
 clearForBigMessage(){if(this.vehicle.state)this.vehicle.state=NAME_DONT_SHOW;if(this.zone.state)this.zone.state=NAME_DONT_SHOW;}
 private drawAreaName(dt:number,o:{message?:boolean;bigMessage?:boolean}):DrawnName|undefined{
  const z=this.zone;if(!this.zoneName)return undefined;
  if(this.zoneName!==z.last){
   switch(z.state){
    case NAME_DONT_SHOW:
     z.state=NAME_FADE_IN;z.nameTimer=0;z.fadeTimer=0;z.toPrint=this.zoneName;
     if(this.vehicle.state===NAME_SHOW||this.vehicle.state===NAME_FADE_IN)this.vehicle.state=NAME_FADE_OUT;
     break;
    case NAME_SHOW:case NAME_FADE_IN:case NAME_FADE_OUT:z.state=NAME_SWITCH;z.nameTimer=0;break;
    case NAME_SWITCH:z.nameTimer=0;break;
   }
   z.last=this.zoneName;
  }
  if(!z.state)return undefined;
  let alpha=255;
  switch(z.state){
   case NAME_SHOW:z.fadeTimer=1000;if(z.nameTimer>3000){z.state=NAME_FADE_OUT;z.fadeTimer=1000;}break;
   case NAME_FADE_IN:z.fadeTimer+=dt;if(z.fadeTimer>1000){z.fadeTimer=1000;z.state=NAME_SHOW;}alpha=z.fadeTimer/1000*255;break;
   case NAME_FADE_OUT:z.fadeTimer-=dt;if(z.fadeTimer<0){z.fadeTimer=0;z.state=NAME_DONT_SHOW;}alpha=z.fadeTimer/1000*255;break;
   case NAME_SWITCH:z.fadeTimer-=dt;if(z.fadeTimer<0){z.fadeTimer=0;z.state=NAME_FADE_IN;z.toPrint=z.last;}alpha=z.fadeTimer/1000*255;break;
  }
  if(o.message||o.bigMessage){z.state=NAME_FADE_OUT;return undefined;}
  z.nameTimer+=dt;
  return z.toPrint&&alpha>0?{text:z.toPrint,alpha}:undefined;
 }
 private drawVehicleName(dt:number,message:boolean):DrawnName|undefined{
  const v=this.vehicle;
  if(!this.vehicleName){v.state=NAME_DONT_SHOW;v.nameTimer=0;v.fadeTimer=0;v.last=undefined;return undefined;}
  if(this.vehicleName!==v.last){
   switch(v.state){
    case NAME_DONT_SHOW:
     v.state=NAME_FADE_IN;v.nameTimer=0;v.fadeTimer=0;v.toPrint=this.vehicleName;
     if(this.zone.state===NAME_SHOW||this.zone.state===NAME_FADE_IN)this.zone.state=NAME_FADE_OUT;
     break;
    case NAME_SHOW:case NAME_FADE_IN:case NAME_FADE_OUT:case NAME_SWITCH:v.state=NAME_SWITCH;v.nameTimer=0;break;
   }
   v.last=this.vehicleName;
  }
  if(!v.state)return undefined;
  let alpha=0;
  switch(v.state){
   case NAME_SHOW:if(v.nameTimer>3000){v.state=NAME_FADE_OUT;v.fadeTimer=1000;}alpha=255;break;
   case NAME_FADE_IN:v.fadeTimer+=dt;if(v.fadeTimer>1000){v.fadeTimer=1000;v.state=NAME_SHOW;}alpha=v.fadeTimer/1000*255;break;
   case NAME_FADE_OUT:v.fadeTimer-=dt;if(v.fadeTimer<0){v.state=NAME_DONT_SHOW;v.fadeTimer=0;}alpha=v.fadeTimer/1000*255;break;
   case NAME_SWITCH:v.fadeTimer-=dt;if(v.fadeTimer<0){v.nameTimer=0;v.state=NAME_FADE_IN;v.fadeTimer=0;v.toPrint=v.last;}alpha=v.fadeTimer/1000*255;break;
  }
  if(message)return undefined;
  v.nameTimer+=dt;
  return v.toPrint&&alpha>0?{text:v.toPrint,alpha}:undefined;
 }
}
