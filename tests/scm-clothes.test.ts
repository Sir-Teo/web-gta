import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {CLOTHES_MODEL,CLOTHES_TEXTURE,CLOTHES_MODEL_UNAVAILABLE,dependentTexture,textureDependency} from '../src/engine/ScmClothes';
import {appendStringToKey,nativeKey,nativeUppercaseKey} from '../src/engine/nativeKeyGen';
import {scmOpcode} from '../src/engine/scmOpcodes';

/** GIVE_PLAYER_CLOTHES and its twin: a player index, two short strings and a part. */
function giveClothes(opcode:number,texture:string,model:string,part:number){
 const bytes:number[]=[opcode&0xff,opcode>>8&0xff,1,0,0,0,0];
 for(const text of [texture,model]){
  bytes.push(14,text.length,...[...text].map(character=>character.charCodeAt(0)));
 }
 bytes.push(4,part&0xff);
 return new Uint8Array(bytes);
}
function run(bytes:Uint8Array,game:ScmGameState){
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands};
 const thread=new ScmThread(bytes,0,0,undefined,host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}

describe('the key the game hashes its names with',()=>{
 test('it is CRC-32 left as its own remainder, with no final inversion',()=>{
  // The standard CRC-32 of a string is the inverted remainder, so the key is that inverted back.
  expect(nativeKey('')>>>0).toBe(0xffffffff);
  expect(nativeUppercaseKey('a')>>>0).toBe(0x2c266174);
  expect(nativeUppercaseKey('The quick brown fox jumps over the lazy dog')>>>0).toBe(0xb3cd4946);
 });
 test('the uppercase key lifts only a to z, so case does not matter',()=>{
  expect(nativeUppercaseKey('player')).toBe(nativeUppercaseKey('PLAYER'));
  expect(nativeUppercaseKey('PLAYER')>>>0).toBe(0x971e421c);
  expect(nativeUppercaseKey('vest_1')).toBe(nativeUppercaseKey('VEST_1'));
  // A key kept over two calls is the key of the two strings joined.
  expect(appendStringToKey(nativeKey('VEST'),'_1')).toBe(nativeKey('VEST_1'));
 });
});

describe('the clothes a script gives the player',()=>{
 test('a texture part is dressed, and the model part it depends on with it',()=>{
  const game=new ScmGameState();
  run(giveClothes(scmOpcode('GIVE_PLAYER_CLOTHES'),'vest','torso',CLOTHES_TEXTURE.torso),game);
  expect(game.clothes.textureKeys[CLOTHES_TEXTURE.torso]).toBe(nativeUppercaseKey('vest'));
  expect(game.clothes.modelKeys[CLOTHES_MODEL.torso]).toBe(nativeUppercaseKey('torso'));
  expect(game.clothes.dressedParts).toBe(1);
 });

 test('a texture part with no model of its own dresses no model key',()=>{
  const game=new ScmGameState();
  run(giveClothes(scmOpcode('GIVE_PLAYER_CLOTHES'),'tattoo','ignored',CLOTHES_TEXTURE.leftChest),game);
  expect(game.clothes.textureKeys[CLOTHES_TEXTURE.leftChest]).toBe(nativeUppercaseKey('tattoo'));
  expect([...game.clothes.modelKeys].every(key=>key===0)).toBe(true);
 });

 test('the outside-shop twin dresses the same description and is counted',()=>{
  const game=new ScmGameState();
  run(giveClothes(scmOpcode('GIVE_PLAYER_CLOTHES_OUTSIDE_SHOP'),'shades','glasses',CLOTHES_TEXTURE.glasses),game);
  expect(game.clothes.textureKeys[CLOTHES_TEXTURE.glasses]).toBe(nativeUppercaseKey('shades'));
  expect(game.clothes.modelKeys[CLOTHES_MODEL.glasses]).toBe(nativeUppercaseKey('glasses'));
  expect(game.clothesGivenOutsideShop).toBe(1);
 });

 test('the dependency table matches the one the engine reads either way',()=>{
  for(const [name,texturePart] of Object.entries(CLOTHES_TEXTURE)){
   const modelPart=textureDependency(texturePart);
   if(modelPart===CLOTHES_MODEL_UNAVAILABLE)continue;
   expect(dependentTexture(modelPart),name).toBe(texturePart);
  }
  expect(textureDependency(CLOTHES_TEXTURE.stomach)).toBe(CLOTHES_MODEL_UNAVAILABLE);
  expect(textureDependency(99)).toBe(CLOTHES_MODEL_UNAVAILABLE);
 });

 test('a part outside the table is refused, and init undresses everything',()=>{
  const game=new ScmGameState();
  expect(()=>game.clothes.setTextureAndModel('a','b',18)).toThrow(/range/);
  game.clothes.setTextureAndModel('vest','torso',CLOTHES_TEXTURE.torso);
  game.clothes.init();
  expect(game.clothes.dressedParts).toBe(0);
  expect([...game.clothes.modelKeys].every(key=>key===0)).toBe(true);
 });
});
