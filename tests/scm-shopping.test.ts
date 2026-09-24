import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {PRICE_SECTION,ScmShopping} from '../src/engine/ScmShopping';
import {ScmClothes} from '../src/engine/ScmClothes';
import {nativeUppercaseKey} from '../src/engine/nativeKeyGen';
import {NativeWanted} from '../src/simulation/nativeWanted';

const text=readFileSync('public/play/world/files/data/shopping.dat','latin1');
function shop(models:Record<string,number>={}){
 const given:[number,number][]=[],current:number[]=[];let armour=0;
 const shopping=new ScmShopping();shopping.load(text);
 shopping.host={modelIndex:name=>models[name.toLowerCase()]??-1,level:()=>1,giveWeapon:(t,a)=>{given.push([t,a]);},setCurrentWeapon:t=>{current.push(t);},setArmour:v=>{armour=v;}};
 const stats=new Map<number,number>(),wanted=new NativeWanted();
 const state={money:5000,clothes:new ScmClothes(),playerInfo:{maxArmour:150},wanted,
  stats:{increment:(s:number,v:number)=>{stats.set(s,(stats.get(s)??0)+v);},decrement:(s:number,v:number)=>{stats.set(s,(stats.get(s)??0)-v);}}};
 return {shopping,state,stats,given,current,armour:()=>armour,wanted};
}

test('an Ammu-Nation lists its weapons by type, prices them and sells them', () => {
 const {shopping,state,stats,given,current,armour}=shop();
 shopping.loadShop('ammun1');
 expect(shopping.shopLoaded).toBe('ammun1');expect(shopping.priceSectionLoaded).toBe(PRICE_SECTION.weapons);
 expect(shopping.numItemsInShop).toBe(16);expect(shopping.itemInShop(0)).toBe(22);expect(shopping.itemInShop(5)).toBe(48);
 expect(shopping.price(22)).toBe(200);expect(shopping.nameTag(22)).toBe('PISTOL');expect(shopping.extraInfo(22,0)).toBe(30);
 shopping.buy(state,22);
 expect(state.money).toBe(4800);expect(given).toEqual([[22,30]]);expect(current).toEqual([22]);
 expect(stats.get(13)).toBe(200);expect(stats.get(62)).toBe(200);expect(shopping.hasPlayerBought(22)).toBe(true);
 // Body armour fills to the player's maximum rather than handing over a weapon.
 shopping.buy(state,48);expect(armour()).toBe(150);expect(given).toHaveLength(1);
 // The same shop again is not reloaded; "bought" lists what was bought of the loaded prices.
 shopping.loadShop('AMMUN1');expect(shopping.numItemsInShop).toBe(16);
 shopping.loadShop('bought');expect([...shopping.shopContents.slice(0,shopping.numItemsInShop)].sort()).toEqual([22,48]);
});

test('the price count steps over comment lines, which take slots of their own', () => {
 const {shopping}=shop();
 shopping.loadPrices('clothes');
 // Clothes opens on ten comment lines before player_torso.
 const torso=nativeUppercaseKey('player_torso');
 shopping.loadShop('CSchp');
 expect(shopping.extraInfo(torso,1)).toBe(0);
 expect(shopping.numPrices).toBeGreaterThan(shopping.numItemsInShop);
});

test('new clothes take the old ones\' stats back, dress the player and put him on parole', () => {
 const {shopping,state,stats,wanted}=shop();
 wanted.setWantedLevel(2);
 shopping.loadShop('CSchp');
 const vest=nativeUppercaseKey('vest'),tshirt=nativeUppercaseKey('tshirtblunts');
 shopping.buy(state,vest);
 expect(state.clothes.textureKeys[0]).toBe(vest);expect(state.clothes.modelKeys[0]).toBe(nativeUppercaseKey('vest'));
 // respect 2 (×10 on STAT_CLOTHES_RESPECT) and sexy 3 (×10 on STAT_APPEARANCE).
 expect(stats.get(66)).toBe(20);expect(stats.get(80)).toBe(30);expect(stats.get(14)).toBe(10);
 expect(wanted.level).toBe(0);expect(wanted.levelBeforeParole).toBe(2);
 // A crime within 20 s brings the old level back.
 wanted.setWantedLevelNoDrop(1);expect(wanted.level).toBe(2);
 shopping.buy(state,tshirt);
 expect(stats.get(66)).toBe(20);expect(stats.get(80)).toBe(0);expect(wanted.level).toBe(0);
});

test('parole lapses after 20 s', () => {
 const wanted=new NativeWanted();wanted.setWantedLevel(3);wanted.goOnParole();
 for(let i=0;i<21;i++)wanted.update(1,true,false,false);
 wanted.setWantedLevelNoDrop(1);expect(wanted.level).toBe(1);
});

test('food is keyed by its model and counts a meal', () => {
 const {shopping,state,stats}=shop({clucklow:2215,cluckmed:2216,cluckhigh:2217,cluck_healthy:2218});
 shopping.loadShop('FDchick');
 expect(shopping.priceSectionLoaded).toBe(PRICE_SECTION.food);expect(shopping.itemInShop(0)).toBe(2215);
 shopping.buy(state,2215);
 expect(state.money).toBe(4998);expect(stats.get(245)).toBe(20);expect(stats.get(200)).toBe(1);expect(stats.get(20)).toBe(2);
});

test('a price modifier replaces the file\'s price when the prices load', () => {
 const {shopping}=shop();
 shopping.addPriceModifier(22,1);shopping.loadShop('ammun1');expect(shopping.price(22)).toBe(1);
 shopping.removePriceModifier(22);shopping.removeLoadedShop();shopping.loadShop('ammun1');expect(shopping.price(22)).toBe(200);
});
