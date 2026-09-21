import {SET_PIECE,type ScmSetPiece} from '../assets/scmSetPieces';
type V2=readonly [number,number];
/** What CSetPiece::Update reads: the player's native position and speed (FindPlayerSpeed, units a frame), his wanted
 * level, whether he is in a vehicle, and CTimer::GetTimeInMS. */
export interface SetPieceWorld {player:readonly [number,number,number];playerSpeed:V2;wanted:number;inVehicle:boolean;timeMs:number}
/** A cop car to generate: TryToGenerateCopCar at `spawn` facing `target`, then the autopilot SetupCar gives it.
 * `quick` cars (SetupQuickCar) start at 2/3 units a frame along their heading with TEMPACT_GOFORWARD for 100 ms. */
export interface SetPieceCar {spawn:V2;target:V2;mission:'slowlyDriveTowardsPlayer'|'blockPlayerForwardAndBack'|'ramPlayerClose';cruise:number;timeNeeded:number;quick:boolean}
/** A request from one set piece: its cars or cops. `together` pieces keep none unless all generate. */
export type SetPieceRequest={piece:number;together:boolean}&({kind:'cars';cars:SetPieceCar[]}|{kind:'cops';cops:{spawn:V2;target:V2}[]});

/** CSetPieces and CSetPiece::Update (SetPieces.cpp, SetPiece.cpp, reversed): the INITIAL mission's 209 set pieces, an
 * eighth checked each frame, each generating cop cars or cops on foot when the player is inside its area with the
 * right wanted level, at most every 4 s. Generation is the host's: it reports back through `generated`. */
export class NativeSetPieces {
 /** m_nLastGenerationTime per set piece. */
 readonly lastGeneration:number[];
 /** Requests the host is still generating. */
 private pending=new Set<number>();
 constructor(private records:readonly ScmSetPiece[]){this.lastGeneration=records.map(()=>0);}
 get pieces():readonly ScmSetPiece[]{return this.records;}
 /* CSetPieces' table is the script's own: AddOne fills it and Init empties it. The browser read a list out of
  * the script's bytes ahead of time; this replaces it with the live one. The per-piece generation times are
  * rebuilt with it, since a piece's slot is what they are keyed by and the slots are being replaced. */
 setPieces(pieces:readonly ScmSetPiece[]){
  this.records=pieces;
  this.lastGeneration.length=0;
  for(let i=0;i<pieces.length;i++)this.lastGeneration.push(0);
  this.pending.clear();
 }
 /** CSetPieces::Update (0x49AA00) for one frame: set pieces f × n / 8 to (f + 1) × n / 8, f = frame % 8. */
 update(frame:number,world:SetPieceWorld):SetPieceRequest[]{
  const f=frame%8,n=this.pieces.length,out:SetPieceRequest[]=[];
  for(let i=Math.trunc(f*n/8);i<Math.trunc((f+1)*n/8);i++){const r=this.updateOne(i,world);if(r){this.pending.add(i);out.push(r);}}
  return out;
 }
 /** The host generated (or failed to generate) a request's entities. */
 generated(piece:number,success:boolean,timeMs:number){this.pending.delete(piece);if(success)this.lastGeneration[piece]=timeMs>>>0;}
 /** CSetPiece::Update (0x499A80). */
 private updateOne(i:number,w:SetPieceWorld):SetPieceRequest|undefined{
  const piece=this.pieces[i],last=this.lastGeneration[i];
  if(this.pending.has(i)||last!==0&&w.timeMs<=last+4000)return undefined;
  const [left,bottom,right,top]=piece.area,[x,y]=w.player;
  if(!(x>=left&&x<=right&&y>=bottom&&y<=top))return undefined;
  const car=(spawn:V2,target:V2,mission:SetPieceCar['mission'],cruise:number,timeNeeded:number,quick=false):SetPieceCar=>({spawn,target,mission,cruise,timeNeeded,quick});
  // SetupQuickCar only runs while the player moves toward its spawn point.
  const approaching=(spawn:V2)=>(x-spawn[0])*w.playerSpeed[0]+(y-spawn[1])*w.playerSpeed[1]<0;
  const quick=(spawn:V2,target:V2,mission:SetPieceCar['mission'])=>approaching(spawn)?[car(spawn,target,mission,16,10000,true)]:[];
  switch(piece.type){
   case SET_PIECE.twoCarsSlow:case SET_PIECE.twoCarsMedium:{
    if(w.wanted<1||w.inVehicle)return undefined;
    const cruise=piece.type===SET_PIECE.twoCarsSlow?4:24;
    return {piece:i,together:true,kind:'cars',cars:[car(piece.spawn1,piece.target1,'slowlyDriveTowardsPlayer',cruise,25000),car(piece.spawn2,piece.target2,'slowlyDriveTowardsPlayer',cruise,25000)]};
   }
   case SET_PIECE.oneCarQuick:{
    if(w.wanted<2||!w.inVehicle)return undefined;
    const cars=quick(piece.spawn1,piece.target1,'blockPlayerForwardAndBack');return cars.length?{piece:i,together:false,kind:'cars',cars}:undefined;
   }
   case SET_PIECE.oneCarMedium:{
    if(w.wanted<2||!w.inVehicle)return undefined;
    const cars=quick(piece.spawn1,piece.target1,'ramPlayerClose');return cars.length?{piece:i,together:false,kind:'cars',cars}:undefined;
   }
   // gta-reversed skips the cop and two-quick-car pieces only when both conditions fail (`wanted < 1 && vehicle`), which
   // would send police at a player with no stars; the one-car pieces' `||` is read for them too.
   case SET_PIECE.onePed:
    if(w.wanted<1||w.inVehicle)return undefined;
    return {piece:i,together:false,kind:'cops',cops:[{spawn:piece.spawn1,target:piece.target1}]};
   case SET_PIECE.twoPeds:
    if(w.wanted<1||w.inVehicle)return undefined;
    return {piece:i,together:true,kind:'cops',cops:[{spawn:piece.spawn1,target:piece.target1},{spawn:piece.spawn2,target:piece.target2}]};
   // These two do not check that the first car generated.
   case SET_PIECE.twoCarsQuickBeforeHit:{
    if(w.wanted<2||!w.inVehicle)return undefined;
    const cars=[...quick(piece.spawn1,piece.target1,'blockPlayerForwardAndBack'),...quick(piece.spawn2,piece.target2,'blockPlayerForwardAndBack')];
    return cars.length?{piece:i,together:false,kind:'cars',cars}:undefined;
   }
   case SET_PIECE.twoCarsQuick:{
    if(w.wanted<2||!w.inVehicle)return undefined;
    const cars=[...quick(piece.spawn1,piece.target1,'ramPlayerClose'),...quick(piece.spawn2,piece.target2,'ramPlayerClose')];
    return cars.length?{piece:i,together:false,kind:'cars',cars}:undefined;
   }
   default:return undefined;
  }
 }
}
