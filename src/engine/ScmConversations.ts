import {requireAsset} from '../assets/binary';
/* CConversations' script-facing half, pinned gta-reversed ead3051 (`Conversations/Conversations.h` for the three
 * table sizes, and `Conversations.cpp`'s `StartSettingUpConversation` 0x43A840, `SetUpConversationNode`,
 * `IsConversationAtNode`, `EnableConversation` 0x43AA40, `RemoveConversationForPed`, `IsConversationGoingOn`
 * 0x43AAC0 and `Clear`, all reversed; the command layer in `ConversationCommands.cpp` is reversed too).
 *
 * What is not reversed is `DoneSettingUpConversation` (0x43ADB0), which moves the temporary nodes into the
 * permanent table and turns each yes and no name into the index of another node. So the names are kept as names
 * here rather than resolved into indices that are not known, which costs nothing: the one question the script
 * asks, whether a conversation sits at a named node, compares names anyway.
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
 /** The three speech ids, negative for scripted speech. */
 speech:number;speechYes:number;speechNo:number;
}
export interface ScmConversationForPed {
 /** m_pPed: nothing once CConversationForPed::Clear has freed the slot. */
 ped:number|undefined;enabled:boolean;status:number;
 /** The node the conversation sits at, or nothing before it has reached one. */
 currentNode?:string;
 nodes:ScmConversationNode[];
 suppressSubtitles:boolean;
 /** m_LastChange: when the status last moved, ms. */
 lastChange?:number;
 /** The node the player's answer leads to, while he says it. */
 chosen?:string;
 /** An ended conversation starts again only once the player has stepped out of position. */
 finished?:boolean;
}
/** What CConversationForPed::Update asks of the world. */
export interface ScmConversationWorld {
 /** IsPlayerInPositionForConversation for the ped. */
 inPosition(ped:number):boolean;
 /** The ped says a node's line: its GXT key, as a subtitle when the conversation has them. */
 pedSays(ped:number,node:ScmConversationNode,subtitles:boolean):void;
 /** The player answers yes or no to the node. */
 playerSays(ped:number,answer:'yes'|'no',node:ScmConversationNode):void;
}
/** How long a ped's line and the player's answer last (AUTHORED: the original waits for the speech sample, which is not
 * published, to finish). */
export const CONVERSATION_PED_LINE_MS=2500,CONVERSATION_PLAYER_LINE_MS=1200;
/** The six-character upper-case name a node is stored under. */
export const conversationNodeName=(name:string)=>name.slice(0,6).toUpperCase();
export class ScmConversations {
 private readonly conversations:ScmConversationForPed[]=[];
 /** m_aTempNodes and the ped the script is setting up for. */
 private temp:ScmConversationNode[]=[];
 private settingUpFor?:number;
 get settingUp(){return this.settingUpFor!==undefined;}
 /** The slots a ped holds. */
 get count(){return this.conversations.filter(conversation=>conversation.ped!==undefined).length;}
 get all():readonly ScmConversationForPed[]{return this.conversations;}
 /** CConversations::FindConversationForPed. */
 forPed(ped:number){return this.conversations.find(conversation=>conversation.ped===ped);}
 /** The ped's slot, else a freed one, else a new one of the fourteen. */
 private ensure(ped:number){
  const found=this.forPed(ped)??this.conversations.find(conversation=>conversation.ped===undefined);
  if(found){found.ped=ped;return found;}
  requireAsset(this.conversations.length<MAX_NUM_CONVERSATIONS,'CConversations holds fourteen conversations.');
  const conversation:ScmConversationForPed={ped,enabled:true,status:CONVERSATION_INACTIVE,nodes:[],suppressSubtitles:false};
  this.conversations.push(conversation);return conversation;
 }
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
 /** FINISH_SETTING_UP_CONVERSATION and its no-subtitles twin: the nodes become the ped's conversation. What
  * DoneSettingUpConversation does beyond that is not reversed: the conversation is put at its first node, so a script
  * can ask for it, and its status is left to CConversationForPed::Update, which is not reversed either. */
 finishSettingUp(suppressSubtitles:boolean){
  requireAsset(this.settingUpFor!==undefined,'A conversation was finished with none started.');
  const conversation=this.ensure(this.settingUpFor);
  requireAsset(this.temp.length<=MAX_NUM_CONVERSATION_NODES,'Too many conversation nodes.');
  conversation.nodes=this.temp;conversation.suppressSubtitles=suppressSubtitles;
  conversation.currentNode=this.temp[0]?.name;
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
 /** What a host moves as the conversation runs. */
 setCurrentNode(ped:number,name:string|undefined){const conversation=this.forPed(ped);if(conversation)conversation.currentNode=name&&conversationNodeName(name);}
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
 clearAll(){this.conversations.length=0;this.temp=[];this.settingUpFor=undefined;}
 /** CConversations::IsConversationGoingOn, which GET_CONVERSATION_STATUS reads. */
 get goingOn(){return this.conversations.some(conversation=>conversation.status!==CONVERSATION_INACTIVE);}
 /** A conversation waits for the player's yes or no. */
 get waitingForInput(){return this.conversations.some(conversation=>conversation.ped!==undefined&&conversation.status===CONVERSATION_WAITING_FOR_INPUT);}
 private pendingAnswer?:'yes'|'no';
 /** CPad::ConversationYesJustDown or ConversationNoJustDown: taken by the conversation waiting for one, at its next
  * update. Whether one was waiting (the button then says nothing to the street). */
 answer(kind:'yes'|'no'){if(!this.waitingForInput)return false;this.pendingAnswer=kind;return true;}
 private node(conversation:ScmConversationForPed,name:string|undefined){return name===undefined?undefined:conversation.nodes.find(node=>node.name===name);}
 private speak(conversation:ScmConversationForPed,node:ScmConversationNode,nowMs:number,world:ScmConversationWorld){
  conversation.currentNode=node.name;conversation.status=CONVERSATION_PED_SPEAKING;conversation.lastChange=nowMs;
  world.pedSays(conversation.ped!,node,!conversation.suppressSubtitles);
 }
 private end(conversation:ScmConversationForPed){conversation.status=CONVERSATION_INACTIVE;conversation.finished=true;}
 /** CConversations::Update, each conversation's CConversationForPed::Update (0x43C190, unreversed; AUTHORED after the
  * retail game): an enabled conversation starts when the player comes into position and no other is going on, the ped
  * saying its first node; a node with answers then waits for the player's yes or no, which he says before the ped
  * goes on with the node it leads to; a node with none ends the conversation there, where IS_CONVERSATION_AT_NODE finds
  * it, until the player steps away. Walking off while the ped waits for an answer drops the conversation back to its
  * start. */
 update(nowMs:number,world:ScmConversationWorld){
  for(const conversation of this.conversations){
   const ped=conversation.ped;if(ped===undefined)continue;
   const inPosition=world.inPosition(ped);
   switch(conversation.status){
    case CONVERSATION_INACTIVE:
     if(!inPosition){conversation.finished=false;break;}
     if(!conversation.enabled||conversation.finished||!conversation.nodes.length)break;
     if(this.conversations.some(other=>other!==conversation&&other.ped!==undefined&&other.status!==CONVERSATION_INACTIVE))break;
     this.speak(conversation,conversation.nodes[0],nowMs,world);break;
    case CONVERSATION_PED_SPEAKING:{
     if(nowMs-(conversation.lastChange??nowMs)<CONVERSATION_PED_LINE_MS)break;
     const node=this.node(conversation,conversation.currentNode);
     if(node&&(node.yes||node.no)){conversation.status=CONVERSATION_WAITING_FOR_INPUT;conversation.lastChange=nowMs;}
     else this.end(conversation);
     break;
    }
    case CONVERSATION_WAITING_FOR_INPUT:{
     if(!inPosition||!conversation.enabled){conversation.status=CONVERSATION_INACTIVE;conversation.currentNode=conversation.nodes[0]?.name;break;}
     const kind=this.pendingAnswer;if(!kind)break;
     this.pendingAnswer=undefined;
     const node=this.node(conversation,conversation.currentNode),next=kind==='yes'?node?.yes:node?.no;
     if(!node||!next)break;
     conversation.chosen=next;conversation.status=CONVERSATION_PLAYER_SPEAKING;conversation.lastChange=nowMs;
     world.playerSays(ped,kind,node);break;
    }
    case CONVERSATION_PLAYER_SPEAKING:{
     if(nowMs-(conversation.lastChange??nowMs)<CONVERSATION_PLAYER_LINE_MS)break;
     const next=this.node(conversation,conversation.chosen);conversation.chosen=undefined;
     if(next)this.speak(conversation,next,nowMs,world);
     else{conversation.currentNode=undefined;this.end(conversation);}
     break;
    }
   }
  }
  this.pendingAnswer=undefined;
 }
}
