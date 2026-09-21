/* CAcquaintance: how one ped regards each of the thirty-two ped types.
 *
 * Five bitmasks over ePedType — respect, like, ignore, dislike and hate — of which the original uses four.
 * ped.dat fills the table for every type; SET_CHAR_RELATIONSHIP and its clearing forms change one ped's own
 * copy. The rule that makes it a table rather than five independent sets is CAcquaintance::SetAsAcquaintance:
 * putting a type in one list takes it out of the other four, so a ped cannot both like and hate the same type. */
export const ACQUAINTANCE_RESPECT=0,ACQUAINTANCE_LIKE=1,ACQUAINTANCE_IGNORE=2,ACQUAINTANCE_DISLIKE=3,
 ACQUAINTANCE_HATE=4,ACQUAINTANCE_NUM=5;
/** ePedType by name, which is what peds.ide calls a ped's type once the PED_TYPE_ prefix is dropped. */
export const NATIVE_PED_TYPES=['PLAYER1','PLAYER2','PLAYER_NETWORK','PLAYER_UNUSED','CIVMALE','CIVFEMALE','COP',
 'GANG1','GANG2','GANG3','GANG4','GANG5','GANG6','GANG7','GANG8','GANG9','GANG10','DEALER','MEDIC','FIREMAN',
 'CRIMINAL','BUM','PROSTITUTE','SPECIAL','MISSION1','MISSION2','MISSION3','MISSION4','MISSION5','MISSION6',
 'MISSION7','MISSION8'] as const;
const BY_NAME=new Map<string,number>(NATIVE_PED_TYPES.map((name,index)=>[name as string,index]));
/** The ePedType a peds.ide type name stands for, or nothing for a name the enum does not have. */
export const nativePedType=(name:string|undefined)=>name===undefined?undefined:BY_NAME.get(name.toUpperCase());
export class NativeAcquaintance{
 /** One mask per acquaintance, each a bit per ePedType. */
 private readonly masks=new Int32Array(ACQUAINTANCE_NUM);
 get(id:number){return this.masks[id]>>>0;}
 set(id:number,value:number){this.masks[id]=value|0;}
 clear(id:number){this.masks[id]=0;}
 /** CAcquaintance::SetAsAcquaintance (0x608DA0), which takes a mask of ped types, not a type. */
 setAs(id:number,pedTypeBits:number){
  const already=this.get(id);
  if((already&pedTypeBits)!==0)return;
  this.set(id,(pedTypeBits|already)|0);
  for(let other=0;other<ACQUAINTANCE_NUM;other++)if(other!==id)this.clearAs(other,pedTypeBits);
 }
 /** CAcquaintance::ClearAsAcquaintance (0x608980). */
 clearAs(id:number,pedTypeBits:number){
  const already=this.get(id);
  if((already&pedTypeBits)!==0)this.set(id,(already&~pedTypeBits)|0);
 }
 /** The one acquaintance a ped type sits in, or nothing while it sits in none. */
 idFor(pedType:number){
  const bit=1<<pedType;
  for(let id=0;id<ACQUAINTANCE_NUM;id++)if((this.get(id)&bit)!==0)return id;
  return undefined;
 }
}
