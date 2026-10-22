/** TASK_CHAT_WITH_CHAR constructs PartnerChat, whose unavailable-conversation branch uses timed gestures.
 * Native iOS: NextSubTask 0x10041f988, approach points 0x10042012c, sequence 0x100421468.
 * Conversation audio, secondary retreat tasks and general Partner task variants are outside this controller. */
export interface ChatPoint{x:number;y:number;z:number} // Native axes.
export type PartnerChatAction={kind:'stand';ms:number}|{kind:'goto';point:ChatPoint}|{kind:'turn'}|{kind:'sequence'}|{kind:'done'};
export interface PartnerChatState{
 lead:boolean;phase:number;first:number;directions:number;point:ChatPoint;partnerPoint:ChatPoint;
 action:PartnerChatAction;remaining:number;goFrames:number;sequence?:{kind:'turn'|'chat'|'stand';ms?:number}[];at:number;
}
export function createPartnerChat(lead:boolean):PartnerChatState{return{lead,phase:1,first:-1,directions:4,point:{x:0,y:0,z:0},partnerPoint:{x:0,y:0,z:0},action:{kind:'stand',ms:50},remaining:.05,goFrames:0,at:0};}
export function partnerChatPoints(a:ChatPoint,b:ChatPoint){
 const f=Math.fround,dx=f(f(b.x)-f(a.x)),dy=f(f(b.y)-f(a.y)),dz=f(f(b.z)-f(a.z)),length2=f(f(f(dx*dx)+f(dy*dy))+f(dz*dz));
 const inverse=length2>0?f(1/f(Math.sqrt(length2))):0,n={x:length2>0?f(dx*inverse):1,y:length2>0?f(dy*inverse):dy,z:length2>0?f(dz*inverse):dz};
 const midpoint={x:f(f(a.x)+f(.5*dx)),y:f(f(a.y)+f(.5*dy)),z:f(f(a.z)+f(.5*dz))};
 return{a:{x:f(midpoint.x-f(n.x*.5)),y:f(midpoint.y-f(n.y*.5)),z:f(midpoint.z-f(n.z*.5))},b:{x:f(midpoint.x+f(n.x*.5)),y:f(midpoint.y+f(n.y*.5)),z:f(midpoint.z+f(n.z*.5))}};
}
export function partnerChatSequence(point:ChatPoint,directions:number,lead:boolean){
 const f=Math.fround,seed=Math.trunc(f(f(f(f(point.x)+f(directions*16))+f(point.y))+f(point.z)))&127,t=f(seed*.0078125);
 const first=Math.trunc(f(f(t*3000)+3500)),second=Math.trunc(f(f(f(1-t)*3000)+3500));
 return[{kind:'turn' as const},{kind:lead?'chat' as const:'stand' as const,ms:first},{kind:lead?'stand' as const:'chat' as const,ms:second}];
}
/** The caller supplies only a reciprocal partner task, as the native task-manager query requires. */
export function nextPartnerChat(s:PartnerChatState,other:PartnerChatState|undefined,subtype:number,a:ChatPoint,b:ChatPoint):PartnerChatAction{
 const stand=():PartnerChatAction=>({kind:'stand',ms:50}),done:PartnerChatAction={kind:'done'};
 if(!other)return done;
 switch(s.phase){
  case 1:
   if(subtype!==203)return done;
   if(s.lead){const p=partnerChatPoints(a,b);s.point=p.a;s.partnerPoint=p.b;other.point={...p.b};}
   s.phase=2;return stand();
  case 2:
   if(subtype!==203)return done;
   if(s.point.x===0&&s.point.y===0)return stand();
   s.phase=3;s.goFrames=0;return{kind:'goto',point:{...s.point}};
  case 3:
   if(subtype===903)return{kind:'turn'};
   if(subtype!==920)return done;
   s.phase=4;return stand();
  case 4:
   if(other.phase===4||other.phase===5){if(s.first===-1)s.first=0;if(other.first===-1)other.first=1;s.phase=5;}
   else{if(s.first===-1)s.first=1;if(other.first===-1)other.first=0;other.point={...s.partnerPoint};}
   return stand();
  case 5:if(other.phase>=5)s.phase=6;return stand();
  case 6:if(s.directions===0)return done;s.directions--;return{kind:'sequence'};
  default:return done;
 }
}
export type PartnerChatControl={kind:'hold'|'chat'|'turn'|'move'|'done';point?:ChatPoint};
/** Run the captured first stand/handshake and fallback sequence using the host's actual movement and heading. */
export function stepPartnerChat(s:PartnerChatState,other:PartnerChatState|undefined,position:ChatPoint,partner:ChatPoint|undefined,heading:number,speed:number,dt:number):PartnerChatControl{
 if(!partner||s.phase>1&&!other)return{kind:'done'};
 const facing=Math.atan2(partner.x-position.x,position.y-partner.y),turned=Math.abs(Math.atan2(Math.sin(heading-facing),Math.cos(heading-facing)))<=.2;
 const next=(subtype:number):PartnerChatControl=>{
  s.action=nextPartnerChat(s,other,subtype,position,partner);s.remaining=s.action.kind==='stand'?s.action.ms/1000:0;
  if(s.action.kind==='sequence'){s.sequence=partnerChatSequence(s.point,s.directions,s.lead);s.at=0;}
  return{kind:s.action.kind==='done'?'done':'hold'};
 };
 switch(s.action.kind){
  case 'done':return{kind:'done'};
  case 'stand':s.remaining-=dt;return s.remaining<=0?next(203):{kind:'hold'};
  case 'goto':{
   if(++s.goFrames>=151)return{kind:'done'};
   const p=s.action.point,d=Math.hypot(p.x-position.x,p.y-position.y);
   if(d<=Math.max(.1,speed*dt)&&Math.abs(p.z-position.z)<1)return next(903);
   return{kind:'move',point:p};
  }
  case 'turn':return turned?next(920):{kind:'turn',point:partner};
  case 'sequence':{
   const part=s.sequence![s.at];
   if(part.kind==='turn'){if(turned){s.at++;s.remaining=s.sequence![s.at].ms!/1000;}return{kind:'turn',point:partner};}
   s.remaining-=dt;
   if(s.remaining<=0){if(++s.at>=s.sequence!.length)return next(0);s.remaining=s.sequence![s.at].ms!/1000;}
   return{kind:s.sequence![s.at]?.kind==='chat'?'chat':'hold'};
  }
 }
}
