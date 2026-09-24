import {requireAsset} from '../assets/binary';
import {nativeUppercaseKey} from './nativeKeyGen';
import {CLOTHES_MODEL,CLOTHES_TEXTURE_TOTAL,textureDependency,type ScmClothes} from './ScmClothes';
import {WEAPON_TYPE_NAMES} from '../weapons/weaponData';
/* CShopping, pinned gta-reversed ead3051 (`Shopping.cpp`, every routine below reversed but the price modifiers,
 * whose addresses the reference does not have): shopping.dat's prices and shops, what the shop scripts read and
 * buy. The script commands that call it (LOAD_PRICES 0x075D to HAS_PLAYER_BOUGHT_ITEM 0x0942) are thin, unreversed
 * wrappers. */
/** ePriceSection. */
export const PRICE_SECTION={none:0,carMods:1,carPaintjobs:2,furniture:3,clothes:4,haircuts:5,tattoos:6,gifts:7,food:8,weapons:9,property:10} as const;
/** ms_sectionNames (0x8A61D8), matched without case. The file names every section but the paintjobs; that one's
 * string is exe data this port cannot read, and nothing in the file or the script asks for it. */
const SECTION_NAMES=['none','CarMods','CarPaintjobs','Furniture','Clothes','Haircuts','Tattoos','Gifts','Food','Weapons','Property'];
/** GetChangingStatIndex (0x49ABD0), and the stat IncrementStat (0x49BE70) moves for each. The reference's enum calls
 * the fourth STAT_RIOT_MISSION_ACCOMPLISHED; it is the one 335 that "health" names in the file. */
const CHANGING_STATS=['fat','respect','sexy','health','stamina','calories'];
const CHANGING_STAT_IDS=[21,66,80,335,22,245];
const STAT={weaponBudget:13,fashionBudget:14,foodBudget:20,tattooBudget:30,hairdressingBudget:31,carModificationBudget:55,totalShoppingBudget:62,clothesRespect:66,appearance:80,mealsEaten:200} as const;
const WEAPON_FLOWERS=14,WEAPON_ARMOUR=48;
/** gPriceMultipliers (0x8A6204) by eLevelName. Exe data the reference does not hold: a price is the same in
 * every city and the countryside, so each is taken as 1. */
const PRICE_MULTIPLIERS=[1,1,1,1];
interface ItemPrice {key:number;price:number;a:number;b:number;nameTag:string}
/** What buying reaches outside the script state. */
export interface ShoppingHost {
 /** CModelInfo::GetModelInfo by name: the model index, or -1. */
 modelIndex(name:string):number;
 /** CTheZones::m_CurrLevel. */
 level():number;
 /** CPed::GiveWeapon and SetCurrentWeapon on the player. */
 giveWeapon(type:number,ammo:number):void;
 setCurrentWeapon(type:number):void;
 /** CPed::m_fArmour for the player. */
 setArmour(value:number):void;
 /** CVehicle::AddVehicleUpgrade on the player's vehicle, and IsValidModForVehicle. */
 addVehicleUpgrade?(model:number):void;
 isValidModForVehicle?(model:number):boolean;
}
export interface ShoppingState {
 money:number;
 readonly clothes:ScmClothes;
 readonly stats:{increment(stat:number,value:number):void;decrement(stat:number,value:number):void};
 readonly playerInfo:{maxArmour:number};
 readonly wanted:{goOnParole():void};
}
/** CFileLoader::LoadLine: control characters and commas become spaces, and the line starts at its first non-blank. */
function loadLines(text:string){return text.split('\n').map(line=>line.replace(/[\x00-\x1f,]/g,' ').replace(/^[ \t]+/,''));}
class Cursor {
 private at=0;constructor(private readonly lines:readonly string[]){}
 next(){return this.at<this.lines.length?this.lines[this.at++]:undefined;}
 /** FindSection (0x49AE70): the named section at the first depth from here, the cursor left after its line. */
 findSection(name:string){
  let counter=0;
  for(let line=this.next();line!==undefined;line=this.next()){
   if(line===''||line[0]==='#')continue;
   if(line.startsWith('section')){counter++;if(counter===1&&tokens(line)[1]?.toLowerCase()===name.toLowerCase())return true;}
   else if(line.startsWith('end')&&--counter<0)break;
  }
  return false;
 }
 /** GetNextSection (0x49AF10): the next section's name, or undefined at an end. */
 nextSection(){
  for(let line=this.next();line!==undefined;line=this.next()){
   if(line===''||line[0]==='#')continue;
   if(line.startsWith('section'))return tokens(line)[1];
   if(line.startsWith('end'))return undefined;
  }
  return undefined;
 }
}
const tokens=(line:string)=>line.split(/[ \t,]+/).filter(Boolean);
/** atoi: the leading integer, 0 for none. */
const atoi=(text:string|undefined)=>{const m=/^[ \t]*([+-]?\d+)/.exec(text??'');return m?Number.parseInt(m[1],10)|0:0;};
export class ScmShopping {
 private lines?:string[];
 host?:ShoppingHost;
 /** ms_keys, ms_bHasBought and ms_statModifiers over every buyable item (LoadStats), NUM_ITEMS 560. */
 private keys:number[]=[];readonly hasBought:boolean[]=[];private statModifiers:[number,number][][]=[];
 /** ms_prices (300 slots, left as the last load wrote them), ms_numPrices and ms_priceSectionLoaded. */
 private readonly prices:ItemPrice[]=Array.from({length:300},()=>({key:0,price:0,a:0,b:0,nameTag:''}));numPrices=0;priceSectionLoaded:number=PRICE_SECTION.none;
 /** ms_priceModifiers (20 at most). */
 readonly priceModifiers:{key:number;price:number}[]=[];
 /** ms_shopLoaded, ms_shopContents and ms_numItemsInShop. */
 shopLoaded='';readonly shopContents:number[]=[];numItemsInShop=0;
 /** shopping.dat, then CShopping::Init: every buyable item's key and stat changes (LoadStats). */
 load(text:string){this.lines=loadLines(text);this.keys=[];this.hasBought.length=0;this.statModifiers=[];this.statsLoaded=false;}
 private statsLoaded=false;
 private file(){requireAsset(this.lines,'shopping.dat is not loaded.');return new Cursor(this.lines!);}
 /** LoadStats (0x49B6A0). Model keys need the model table, so the host's first shopping call runs it. */
 private ensureStats(){
  if(this.statsLoaded)return;
  const file=this.file();file.findSection('prices');
  for(let name=file.nextSection();name!==undefined;name=file.nextSection()){
   const section=this.sectionFromName(name);
   for(let line=file.next();line!==undefined;line=file.next()){
    if(line===''||line[0]==='#')continue;
    if(line.startsWith('end'))break;
    const t=tokens(line);let at=2;
    if(section===PRICE_SECTION.clothes||section===PRICE_SECTION.haircuts||section===PRICE_SECTION.tattoos)at+=2;
    else if(section===PRICE_SECTION.weapons)at+=1;
    this.keys.push(this.getKey(t[0]??'',section));this.hasBought.push(false);
    // int8 statIndex and change; a '-' is no stat (-1) and atoi's 0.
    this.statModifiers.push([0,1].map(k=>[CHANGING_STATS.indexOf(t[at+k*2]??''),(atoi(t[at+k*2+1])<<24)>>24] as [number,number]));
   }
  }
  this.statsLoaded=true;
 }
 /** GetPriceSectionFromName (0x49AAD0). */
 private sectionFromName(name:string){
  const index=SECTION_NAMES.findIndex(s=>s.toLowerCase()===name.toLowerCase());
  requireAsset(index>=0,`No price section ${name}.`);return index;
 }
 /** GetKey (0x49AB30): a clothes, haircut or tattoo texture's key, a weapon's type, the paintjob section's own number,
  * else the model's index (0xFFFFFFFF when there is none). */
 getKey(name:string,section:number){
  switch(section){
   case PRICE_SECTION.clothes:case PRICE_SECTION.haircuts:case PRICE_SECTION.tattoos:return nativeUppercaseKey(name);
   case PRICE_SECTION.weapons:{const type=WEAPON_TYPE_NAMES.findIndex(n=>n.toLowerCase()===name.toLowerCase());return type<0?0:type;}
   case PRICE_SECTION.carPaintjobs:return PRICE_SECTION.carPaintjobs;
   default:return (this.host?.modelIndex(name)??-1)>>>0;
  }
 }
 /** GetItemIndex (0x49AB10): the item's place among every buyable item, -1 where the reference cannot reach. */
 private itemIndex(key:number){this.ensureStats();return this.keys.indexOf(key>>>0);}
 /** FindItem (0x49AD20): the item's slot among the loaded prices. */
 private findItem(key:number){
  for(let i=0;i<this.numPrices;i++)if(this.prices[i].key===key>>>0)return i;
  requireAsset(false,`Item ${key>>>0} is not among the loaded prices.`);return -1;
 }
 /** LoadPrices (0x49B8D0). The count steps on every line of the section, blank and comment ones too, so those take
  * slots that keep whatever an earlier section left there. */
 loadPrices(name:string){
  const section=this.sectionFromName(name);
  if(section===this.priceSectionLoaded)return;
  this.priceSectionLoaded=section;this.numPrices=0;this.numItemsInShop=0;
  const file=this.file();
  if(file.findSection('prices'))file.findSection(name);
  for(let line=file.next();line!==undefined;line=file.next(),this.numPrices++){
   if(line===''||line[0]==='#')continue;
   if(line.startsWith('end'))break;
   requireAsset(this.numPrices<this.prices.length,'NUM_BUYABLE_ITEMS is 300.');
   const t=tokens(line),price=this.prices[this.numPrices];
   price.key=this.getKey(t[0]??'',section);price.nameTag=(t[1]??'').slice(0,8);
   let at=2;
   if(section===PRICE_SECTION.clothes||section===PRICE_SECTION.haircuts){price.a=nativeUppercaseKey(t[2]??'');price.b=atoi(t[3]);at=4;}
   else if(section===PRICE_SECTION.tattoos){price.a=(t[2]??'')[0]==='-'?-1:atoi(t[2]);price.b=nativeUppercaseKey(t[3]??'');at=4;}
   else if(section===PRICE_SECTION.weapons){price.a=atoi(t[2]);at=3;}
   price.price=atoi(t[at+4]);
   const modifier=this.priceModifiers.find(m=>m.key===price.key);if(modifier)price.price=modifier.price;
  }
 }
 /** LoadShop (0x49BBE0): "bought" lists what the player has bought of the loaded prices. */
 loadShop(name:string){
  if(name.toLowerCase()===this.shopLoaded.toLowerCase())return;
  this.shopLoaded=name;this.numItemsInShop=0;
  if(name.toLowerCase()==='bought'){
   for(let i=0;i<this.numPrices;i++){const index=this.itemIndex(this.prices[i].key);if(index>=0&&this.hasBought[index])this.shopContents[this.numItemsInShop++]=this.prices[i].key;}
   return;
  }
  const file=this.file();
  if(file.findSection('shops'))file.findSection(name);
  for(let line=file.next();line!==undefined;line=file.next()){
   if(line===''||line[0]==='#')continue;
   if(line.startsWith('end'))break;
   const t=tokens(line);
   if(t[0]==='type')this.loadPrices(t[1]??'');
   else if(t[0]==='item'){
    const key=this.getKey(t[1]??'',this.priceSectionLoaded);
    if(this.priceSectionLoaded!==PRICE_SECTION.carMods||this.host?.isValidModForVehicle?.(key))this.shopContents[this.numItemsInShop++]=key;
   }
  }
 }
 /** RemoveLoadedPrices (0x49AC90) and RemoveLoadedShop (0x49AE30). */
 removeLoadedShop(){this.shopLoaded='';this.priceSectionLoaded=PRICE_SECTION.none;}
 itemInShop(index:number){requireAsset(index>=0&&index<this.numItemsInShop,'Shop item out of range.');return this.shopContents[index];}
 /** GetPrice (0x49AD50): the price times the current level's multiplier. */
 price(key:number){return Math.trunc(this.prices[this.findItem(key)].price*(PRICE_MULTIPLIERS[this.host?.level()??0]??1));}
 /** GetExtraInfo (0x49ADE0): the item's first or second extra word. */
 extraInfo(key:number,index:number){const p=this.prices[this.findItem(key)];return index===0?p.a:index===1?p.b:0;}
 /** GetNameTag. */
 nameTag(key:number){return this.prices[this.findItem(key)].nameTag;}
 hasPlayerBought(key:number){const index=this.itemIndex(key);requireAsset(index>=0,'Item is not buyable.');return this.hasBought[index];}
 /** AddPriceModifier and RemovePriceModifier (no addresses in the reference). */
 addPriceModifier(key:number,price:number){
  const existing=this.priceModifiers.find(m=>m.key===key>>>0);if(existing){existing.price=price;return;}
  requireAsset(this.priceModifiers.length<20,'MAX_PRICE_MODIFIERS is 20.');this.priceModifiers.push({key:key>>>0,price});
 }
 removePriceModifier(key:number){const index=this.priceModifiers.findIndex(m=>m.key===key>>>0);if(index<0)return;const last=this.priceModifiers.pop()!;if(index<this.priceModifiers.length)this.priceModifiers[index]=last;}
 /** IncrementStat (0x49BE70) through IncrementStat2 (0x49AFD0): respect and appearance move ten times as far. */
 private incrementStat(state:ShoppingState,statIndex:number,change:number){
  if(statIndex<0)return;
  const stat=CHANGING_STAT_IDS[statIndex];if(stat===STAT.clothesRespect||stat===STAT.appearance)change*=10;
  modifyStat(state,stat,change);
 }
 /** UpdateStats (0x49BEF0): an item's stat changes, taken back when it comes off. */
 private updateStats(state:ShoppingState,index:number,increment:boolean){for(const [stat,change] of this.statModifiers[index]??[])this.incrementStat(state,stat,increment?change:-change);}
 /** Buy (0x49BF70). */
 buy(state:ShoppingState,key:number){
  const index=this.itemIndex(key);requireAsset(index>=0,'Item is not buyable.');
  const price=this.price(key),info=this.prices[this.findItem(key)];
  // gClothesHaveBeenStored: what comes off is read from the stored description.
  const worn=state.clothes.haveBeenStored?state.clothes.storedState?.textureKeys??state.clothes.textureKeys:state.clothes.textureKeys;
  state.money-=price;
  for(const [stat,change] of this.statModifiers[index])this.incrementStat(state,stat,change);
  modifyStat(state,STAT.totalShoppingBudget,price);
  this.hasBought[index]=true;
  const takeOff=(part:number)=>{const old=worn[part];if(old){const oldIndex=this.itemIndex(old);if(oldIndex>=0)this.updateStats(state,oldIndex,false);}};
  switch(this.priceSectionLoaded){
   case PRICE_SECTION.carMods:this.host?.addVehicleUpgrade?.(key);modifyStat(state,STAT.carModificationBudget,price);break;
   case PRICE_SECTION.carPaintjobs:modifyStat(state,STAT.carModificationBudget,price);break;
   case PRICE_SECTION.clothes:{
    modifyStat(state,STAT.fashionBudget,price);takeOff(info.b);
    state.clothes.setTextureAndModelKeys(key,info.a,info.b);
    const model=textureDependency(info.b);
    if(model===CLOTHES_MODEL.torso||model===CLOTHES_MODEL.legs||model===CLOTHES_MODEL.head||model===CLOTHES_MODEL.glasses||model===CLOTHES_MODEL.hats)state.wanted.goOnParole();
    break;
   }
   case PRICE_SECTION.haircuts:modifyStat(state,STAT.hairdressingBudget,price);takeOff(info.b);state.clothes.setTextureAndModelKeys(key,info.a,info.b);state.wanted.goOnParole();break;
   case PRICE_SECTION.tattoos:modifyStat(state,STAT.tattooBudget,price);if(info.a>=0&&info.a<CLOTHES_TEXTURE_TOTAL)state.clothes.setTextureAndModelKeys(key,0,info.a);break;
   case PRICE_SECTION.gifts:this.host?.giveWeapon(WEAPON_FLOWERS,0);break;
   case PRICE_SECTION.food:modifyStat(state,STAT.foodBudget,price);modifyStat(state,STAT.mealsEaten,1);break;
   case PRICE_SECTION.weapons:
    modifyStat(state,STAT.weaponBudget,price);
    if(key===WEAPON_ARMOUR)this.host?.setArmour(state.playerInfo.maxArmour);
    else{this.host?.giveWeapon(key,info.a);this.host?.setCurrentWeapon(key);}
    break;
  }
 }
}
/** CStats::ModifyStat (0x55D090). */
function modifyStat(state:ShoppingState,stat:number,value:number){if(value<0)state.stats.decrement(stat,-value);else state.stats.increment(stat,value);}
