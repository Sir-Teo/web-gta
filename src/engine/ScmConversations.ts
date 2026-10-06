import {requireAsset} from '../assets/binary';
/* CConversations' script-facing half, pinned gta-reversed ead3051 (`Conversations/Conversations.h` for the three
 * table sizes, and `Conversations.cpp`'s `StartSettingUpConversation` 0x43A840, `SetUpConversationNode`,
 * `IsConversationAtNode`, `EnableConversation` 0x43AA40, `RemoveConversationForPed`, `IsConversationGoingOn`
 * 0x43AAC0, `Clear` and `Update` 0x43C590, all reversed; the command layer in `ConversationCommands.cpp` is reversed
 * too). `DoneSettingUpConversation` (0x43ADB0) and `CConversationForPed::Update` (0x43C190) are unreversed there and
 * follow the iOS executable's (0x1001a5b50 and 0x1001a541c).
 *
 * The nodes are kept with each conversation rather than in the shared table of fifty (whose slots only matter once
 * they run out); DoneSettingUpConversation's work on them is kept: each yes and no name becomes the index of the
 * node of that name (the last one, when two share it), or none.
 *
 * Two details the source carries: a node name is cut to six characters and raised to upper case as it is
 * stored, and the scripted-speech forms of the node commands negate their three speech ids, which is how the
 * engine tells scripted speech from ordinary. */
export const MAX_NUM_CONVERSATIONS=14,MAX_NUM_CONVERSATION_NODES=50,MAX_NUM_TEMP_CONVERSATION_NODES=12;
/** CConversationForPed::eStatus. */
export const CONVERSATION_INACTIVE=0,CONVERSATION_PLAYER_SPEAKING=1,CONVERSATION_PED_SPEAKING=2,CONVERSATION_WAITING_FOR_INPUT=3;
export interface ScmConversationNode {
 /** The node's own name, and the names of the nodes a yes and a no lead to. */
 name:string;yes?:string;no?:string;
 /** DoneSettingUpConversation: the nodes a yes and a no lead to, by index, or -1. */
 yesIndex:number;noIndex:number;
 /** The three speech ids, negative for scripted speech. */
 speech:number;speechYes:number;speechNo:number;
}
export interface ScmConversationForPed {
 /** m_pPed: nothing once CConversationForPed::Clear has freed the slot. */
 ped:number|undefined;enabled:boolean;status:number;
 /** m_CurrentNode: the node the conversation sits at, by index and by name. */
 current:number;currentNode?:string;
 nodes:ScmConversationNode[];
 suppressSubtitles:boolean;
 /** m_LastChange: when the status last moved, ms. */
 lastChange:number;
 /** m_LastTimeWeWereCloseEnough: the last update with the player in position, ms (0 when set up). */
 lastCloseEnough:number;
 /** Whether the last update found the player in position (the browser's, for the touch screen's Yes and No). */
 inPosition?:boolean;
}
/** What CConversationForPed::Update asks of the world. */
export interface ScmConversationWorld {
 /** IsPlayerInPositionForConversation(false) for the ped. */
 inPosition(ped:number):boolean;
 /** CMessages::ClearSmallMessagesOnly. */
 clearSmallMessages():void;
 /** A GXT key for CONVERSATION_LINE_MS: AddMessageJumpQ (`instant`) or AddMessage, queued, with the message flag. */
 message(key:string,flag:number,instant:boolean):void;
 /** CPed::Say(context) for the ped, or for the player when `ped` is undefined. */
 say(ped:number|undefined,context:number):void;
 /** CConversations::AwkwardSay's mission audio slot 0 (the script's slot 1): the sample is preloaded and attached to
  * the ped (the player when undefined), then played once loaded; Update waits until it has finished. A host without
  * mission audio leaves it out, and the line is passed over. */
  awkward?:{preload(sample:number,ped:number|undefined):void;loaded():boolean;play():void;finished():boolean};
}
/** CConversationForPed::Update's times (iOS 0x1001a541c): a line stands 4000 ms (the subtitle's time, and the ped's
 * turn before it waits; the player's before the ped goes on), an answer is taken 400 ms after the last change at the
 * soonest, and a player out of position for 10000 ms is greeted again with the line the conversation is at. */
export const CONVERSATION_LINE_MS=4000,CONVERSATION_ANSWER_DELAY_MS=400,CONVERSATION_GREET_AGAIN_MS=10000;
/** CConversations::m_AwkwardSayStatus. */
export const AWKWARD_SAY_INACTIVE=0,AWKWARD_SAY_LOADING=1,AWKWARD_SAY_PLAYING=2;
/** The six-character upper-case name a node is stored under. */
export const conversationNodeName=(name:string)=>name.slice(0,6).toUpperCase();
export class ScmConversations {
 private readonly conversations:ScmConversationForPed[]=[];
 /** m_aTempNodes and the ped the script is setting up for. */
 private temp:Omit<ScmConversationNode,'yesIndex'|'noIndex'>[]=[];
 private settingUpFor?:number;
 /** m_AwkwardSayStatus. */
 awkwardSayStatus=AWKWARD_SAY_INACTIVE;
 get settingUp(){return this.settingUpFor!==undefined;}
 /** The slots a ped holds. */
 get count(){return this.conversations.filter(conversation=>conversation.ped!==undefined).length;}
 get all():readonly ScmConversationForPed[]{return this.conversations;}
 /** CConversations::FindConversationForPed. */
 forPed(ped:number){return this.conversations.find(conversation=>conversation.ped===ped);}
 /** START_SETTING_UP_CONVERSATION: the ped is remembered and the temporary nodes start again from none. */
 startSettingUp(ped:number){this.settingUpFor=ped;this.temp=[];}
 /** The four node commands, which differ only in whether they carry answers and whether the speech is scripted.
  * A thirteenth node would run past the temporary table, which the source does not check; this refuses it. */
 setUpNode(name:string,yes:string|undefined,no:string|undefined,speech:number,speechYes:number,speechNo:number){
  requireAsset(this.settingUpFor!==undefined,'A conversation node was set up with no conversation started.');
  requireAsset(this.temp.length<MAX_NUM_TEMP_CONVERSATION_NODES,'CConversations holds twelve temporary nodes.');
  this.temp.push({name:conversationNodeName(name),
   yes:yes===undefined?undefined:conversationNodeName(yes),
   no:no===undefined?undefined:conversationNodeName(no),
   speech,speechYes,speechNo});
 }
 /** FINISH_SETTING_UP_CONVERSATION and its no-subtitles twin: CConversations::DoneSettingUpConversation (iOS
  * 0x1001a5b50). Each yes and no name becomes the index of the last node so named, or -1; the conversation takes the
  * first slot with no ped (a second for a ped that has one already; a fifteenth crashes the original, and is refused
  * here), at its first node, enabled, inactive, last changed now and never yet in position. */
 finishSettingUp(suppressSubtitles:boolean,nowMs=0){
  requireAsset(this.settingUpFor!==undefined,'A conversation was finished with none started.');
  const temp=this.temp,last=(name:string|undefined)=>{let found=-1;if(name!==undefined)temp.forEach((node,j)=>{if(node.name===name)found=j;});return found;};
  const nodes:ScmConversationNode[]=temp.map(node=>({...node,yesIndex:last(node.yes),noIndex:last(node.no)}));
  let conversation=this.conversations.find(c=>c.ped===undefined);
  if(!conversation){
   requireAsset(this.conversations.length<MAX_NUM_CONVERSATIONS,'CConversations holds fourteen conversations.');
   conversation={ped:undefined,enabled:true,status:CONVERSATION_INACTIVE,current:0,nodes:[],suppressSubtitles:false,lastChange:0,lastCloseEnough:0};
   this.conversations.push(conversation);
  }
  Object.assign(conversation,{ped:this.settingUpFor,nodes,current:0,currentNode:nodes[0]?.name,lastChange:nowMs,lastCloseEnough:0,enabled:true,
   suppressSubtitles,status:CONVERSATION_INACTIVE,inPosition:false});
  this.temp=[];this.settingUpFor=undefined;
  return conversation;
 }
 /** IS_CONVERSATION_AT_NODE: a conversation at no node, or one where the player is speaking, is at none. The whole
  * name the script asks with is compared, without case, with the six characters stored, so a longer one never
  * matches. */
 isAtNode(ped:number,name:string){
  const conversation=this.forPed(ped);
  if(!conversation||conversation.currentNode===undefined||conversation.status===CONVERSATION_PLAYER_SPEAKING)return false;
  return conversation.currentNode===name.toUpperCase();
 }
 /** What a host or a test moves directly. */
 setCurrentNode(ped:number,name:string|undefined){
  const conversation=this.forPed(ped);if(!conversation)return;
  const key=name&&conversationNodeName(name),index=conversation.nodes.findIndex(node=>node.name===key);
  conversation.currentNode=key;if(index>=0)conversation.current=index;
 }
 setStatus(ped:number,status:number){const conversation=this.forPed(ped);if(conversation)conversation.status=status;}
 /** ENABLE_CONVERSATION: CConversations::EnableConversation sets the flag on the ped's conversation. A ped with none
  * would crash the original; here nothing happens. */
 enable(ped:number,enabled:boolean){const conversation=this.forPed(ped);if(conversation)conversation.enabled=enabled;}
 /** CLEAR_CONVERSATION_FOR_CHAR: RemoveConversationForPed's CConversationForPed::Clear(false) drops the nodes and frees
  * the slot (its ped and nodes go) but leaves its status and enabled flag as they were. */
 clearForPed(ped:number){
  for(const conversation of this.conversations)if(conversation.ped===ped){conversation.nodes=[];conversation.currentNode=undefined;conversation.ped=undefined;}
 }
 /** CPed::~CPed calls RemoveConversationForPed (Ped.cpp:334): a slot whose ped no longer exists is freed as it would
  * have been when the ped was deleted. */
 releaseGone(exists:(ped:number)=>boolean){for(const conversation of this.conversations)if(conversation.ped!==undefined&&!exists(conversation.ped))this.clearForPed(conversation.ped);}
 /** CLEAR_ALL_CONVERSATIONS. */
 clearAll(){this.conversations.length=0;this.temp=[];this.settingUpFor=undefined;this.awkwardSayStatus=AWKWARD_SAY_INACTIVE;}
 /** CConversations::IsConversationGoingOn, which GET_CONVERSATION_STATUS reads. */
 get goingOn(){return this.conversations.some(conversation=>conversation.status!==CONVERSATION_INACTIVE);}
 /** A conversation would take a yes or a no now: the player in position, not speaking, at a node with an answer. */
 get waitingForInput(){return this.conversations.some(c=>c.ped!==undefined&&c.inPosition&&c.status!==CONVERSATION_PLAYER_SPEAKING&&!!c.nodes[c.current]&&(c.nodes[c.current].yesIndex>=0||c.nodes[c.current].noIndex>=0));}
 /** CPad::ConversationYesJustPressed and ConversationNoJustPressed this frame, which every conversation's update reads. */
 private pressed={yes:false,no:false};
 /** The button reaches the conversations at their next update. Whether one would take it (the button then says
  * nothing to the street). */
 answer(kind:'yes'|'no'){this.pressed[kind]=true;return this.waitingForInput||this.goingOn;}
 /** CConversations::Update (0x43C590, reversed): while a scripted line (AwkwardSay) loads and plays, no conversation
  * updates; then each runs CConversationForPed::Update. The buttons are this frame's. */
 update(nowMs:number,world:ScmConversationWorld){
  const awkward=world.awkward;
  if(this.awkwardSayStatus===AWKWARD_SAY_LOADING){if(!awkward||awkward.loaded()){awkward?.play();this.awkwardSayStatus=AWKWARD_SAY_PLAYING;}}
  else if(this.awkwardSayStatus===AWKWARD_SAY_PLAYING){if(!awkward||awkward.finished()){this.awkwardSayStatus=AWKWARD_SAY_INACTIVE;this.updateAll(nowMs,world);}}
  else this.updateAll(nowMs,world);
  this.pressed={yes:false,no:false};
 }
 private updateAll(nowMs:number,world:ScmConversationWorld){for(const conversation of this.conversations)this.updateOne(conversation,nowMs,world);}
 /** CConversations::AwkwardSay: the scripted line goes to mission audio slot 0, attached to the speaker. */
 private awkwardSay(sample:number,ped:number|undefined,world:ScmConversationWorld){
  if(!world.awkward)return;
  world.awkward.preload(sample,ped);this.awkwardSayStatus=AWKWARD_SAY_LOADING;
 }
 private speak(ped:number|undefined,speech:number,world:ScmConversationWorld){
  if(speech>=1)world.say(ped,speech);
  if(speech<0)this.awkwardSay(-speech,ped,world);
 }
 private moveTo(conversation:ScmConversationForPed,index:number){conversation.current=index;conversation.currentNode=conversation.nodes[index]?.name;}
 /** CConversationForPed::Update (iOS 0x1001a541c). Out of position (or disabled) a conversation goes inactive and is
  * otherwise left as it is. In position, a player away for more than 10 s is greeted with the ped's line at the
  * current node; the player's own line gives way to the ped's after 4 s or at a press of either button. From 400 ms
  * after the last change, in any state but the player's speaking, a No (asked first) or a Yes the node leads on from
  * makes the player say it: the answer's subtitle is the node's name and N or Y, the ped's next line queued behind
  * it, and the conversation moves to that node. A ped's line becomes waiting for input after 4 s. A node with no
  * answers never ends anything: the conversation stays there. Each conversation runs on its own. */
 private updateOne(conversation:ScmConversationForPed,nowMs:number,world:ScmConversationWorld){
  const ped=conversation.ped;if(ped===undefined)return;
  conversation.inPosition=conversation.enabled&&world.inPosition(ped);
  if(!conversation.inPosition){conversation.status=CONVERSATION_INACTIVE;return;}
  const node=conversation.nodes[conversation.current];if(!node)return;
  const {yes,no}=this.pressed,subtitles=!conversation.suppressSubtitles;
  let pedSpeaks=nowMs>conversation.lastCloseEnough+CONVERSATION_GREET_AGAIN_MS;
  if(!pedSpeaks&&conversation.status===CONVERSATION_PLAYER_SPEAKING&&(nowMs>conversation.lastChange+CONVERSATION_LINE_MS||no||yes))pedSpeaks=true;
  if(pedSpeaks){
   if(subtitles){world.clearSmallMessages();world.message(node.name,1,true);}
   this.speak(ped,node.speech,world);
   conversation.status=CONVERSATION_PED_SPEAKING;conversation.lastChange=nowMs;
  }else if(nowMs>conversation.lastChange+CONVERSATION_ANSWER_DELAY_MS&&conversation.status!==CONVERSATION_PLAYER_SPEAKING){
   const answer=node.noIndex>=0&&no?'N':node.yesIndex>=0&&yes?'Y':undefined;
   if(answer){
    if(subtitles){world.clearSmallMessages();world.message(node.name+answer,3,true);}
    this.speak(undefined,answer==='N'?node.speechNo:node.speechYes,world);
    this.moveTo(conversation,answer==='N'?node.noIndex:node.yesIndex);conversation.lastChange=nowMs;
    const next=conversation.nodes[conversation.current];
    if(subtitles&&next)world.message(next.name,1,false);
    conversation.status=CONVERSATION_PLAYER_SPEAKING;
   }
  }
  conversation.lastCloseEnough=nowMs;
  if(conversation.status===CONVERSATION_PED_SPEAKING&&nowMs>conversation.lastChange+CONVERSATION_LINE_MS)conversation.status=CONVERSATION_WAITING_FOR_INPUT;
 }
}
