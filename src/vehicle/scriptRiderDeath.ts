import type {NativeAnimation} from '../assets/ifp';
interface RiderDeathState {
 health:number;gone:boolean;offset?:unknown;diedInSeat?:boolean;driveBy?:unknown;
 clip?:{name:string;animation?:NativeAnimation;started:number;loop:boolean;hold:boolean;seconds:number;failed?:boolean};
}
/** A scripted die task leaves the ped allocated in its seat/attachment. Removal is a separate operation.
 * Existing seated poses handle a car corpse; an attached one needs a held death clip. */
export function scriptRiderDeath(rider:RiderDeathState,now:number,animation:(file:string,name:string)=>Promise<NativeAnimation|undefined>,name='ko_shot_front',file='PED'){
 if(rider.gone||rider.health<=0)return;
 rider.health=0;rider.diedInSeat=true;rider.driveBy=undefined;rider.clip=undefined;
 if(!rider.offset)return;
 const own:NonNullable<RiderDeathState['clip']>={name:name.toLowerCase(),started:now,loop:false,hold:true,seconds:Infinity};rider.clip=own;
 void animation(file,name).then(clip=>{if(rider.gone||rider.clip!==own)return;own.animation=clip;own.failed=!clip;}).catch(()=>{if(!rider.gone&&rider.clip===own)own.failed=true;});
}
