import {requireAsset} from '../assets/binary';
/* CAnimManager's animation blocks as a script holds them, pinned gta-reversed ead3051 (`AnimManager.cpp`:
 * `GetAnimationBlock` 0x4D3940 by name, `AddAnimBlockRef` 0x4D3FC0 and `RemoveAnimBlockRef` 0x4D3FD0, all
 * reversed, over the CAnimBlock record's name, loaded flag and reference count). This is the block table the script
 * asks after. CStreaming brings a requested block in on its next pass, which `service` stands for; the host reads
 * the IFP itself when a task first plays one of its clips. */
export interface ScmAnimBlock {name:string;loaded:boolean;references:number}
export class ScmAnimBlocks {
 private blocks:ScmAnimBlock[]=[];
 /** CAnimManager::GetAnimationBlock(name): blocks are matched without regard to case. */
 find(name:string){const wanted=name.toLowerCase();return this.blocks.find(block=>block.name.toLowerCase()===wanted);}
 /** REQUEST_ANIMATION: the block gains a reference and the streamer is asked for it. */
 request(name:string){
  requireAsset(!!name,'An animation block needs a name.');
  const block=this.find(name)??this.add(name);
  block.references++;return block;
 }
 private add(name:string){const block:ScmAnimBlock={name,loaded:false,references:0};this.blocks.push(block);return block;}
 /** CStreaming::Update's pass: every block still held and not in yet comes in. REQUEST_ANIMATION is answered on
  * the frame after, as a request is serviced after the scripts have run; LOAD_ALL_MODELS_NOW
  * (CStreaming::LoadAllRequestedModels) calls this at once. No block ever came in before this, so a script waiting
  * on HAS_ANIMATION_LOADED (INTRO1 after the ride, for MISC) waited for ever. */
 service(){for(const block of this.blocks)if(block.references>0)block.loaded=true;}
 /** What a host calls once the file is in memory. */
 load(name:string){const block=this.find(name)??this.add(name);block.loaded=true;}
 /** HAS_ANIMATION_LOADED: the block is known and its animations are there. */
 hasLoaded(name:string){return !!this.find(name)?.loaded;}
 /** REMOVE_ANIMATION: one reference goes. The reference count never falls below nothing here, where the
  * source simply decrements; a block nothing holds any more is the streamer's to reclaim. */
 remove(name:string){
  const block=this.find(name);
  if(!block)return;
  block.references=Math.max(0,block.references-1);
  if(block.references===0)block.loaded=false;
 }
 references(name:string){return this.find(name)?.references??0;}
 get count(){return this.blocks.length;}
}
