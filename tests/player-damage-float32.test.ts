import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {NATIVE_PLAYER_DAMAGE_MULT,Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>RAPIER.init());let sim:Simulation|undefined;afterEach(()=>{sim?.dispose();sim=undefined;});
function fixture(health:number,armour=0){sim=new Simulation();sim.player.health=health;sim.player.armour=armour;return sim;}
const nativeFactor=Math.fround(Math.fround(25)*NATIVE_PLAYER_DAMAGE_MULT);
test('CJ survives an exact native one-HP remainder without arming death recovery',()=>{
 const s=fixture(Math.fround(nativeFactor+1));expect(s.damagePlayer(25,false,{weapon:22,piece:3})).toBe(true);expect(s.player.health).toBe(1);expect(s.deathRemaining).toBe(0);expect(s.damageEvents.at(-1)).toMatchObject({died:false,health:nativeFactor,armour:0});
});
test('CJ armour retains its exact native subtraction',()=>{const s=fixture(100,20);s.damagePlayer(25,false,{weapon:22});expect(s.player.health).toBe(100);expect(s.player.armour).toBe(Math.fround(20-nativeFactor));expect(s.damageEvents.at(-1)?.armour).toBe(nativeFactor);});
test('partial armour preserves one HP through both native subtractions',()=>{const s=fixture(Math.fround(nativeFactor-8+1),8);s.damagePlayer(25,false,{weapon:22});expect(s.player.health).toBe(1);expect(s.player.armour).toBe(0);expect(s.damageEvents.at(-1)?.died).toBe(false);});
test('friendly damage rounds its float product before the one-HP boundary',()=>{const s=fixture(Math.fround(nativeFactor+1));s.damagePlayer(250,false,{weapon:22,friendly:true});expect(s.player.health).toBe(1);expect(s.damageEvents.at(-1)?.died).toBe(false);});
test('intro1 rounds its factor after armour before computing the native remainder',()=>{const intro=Math.fround(Math.fround(nativeFactor-8)*Math.fround(.77)),s=fixture(Math.fround(intro+1),8);s.headScriptName=()=> 'intro1';s.damagePlayer(25,false,{weapon:22});expect(s.player.health).toBe(1);expect(s.player.armour).toBe(0);expect(s.damageEvents.at(-1)?.died).toBe(false);});
test('drowning bypasses armour while keeping the native one-HP remainder',()=>{const s=fixture(Math.fround(nativeFactor+1),20);s.damagePlayer(25,true,{weapon:53});expect(s.player.health).toBe(1);expect(s.player.armour).toBe(20);expect(s.damageEvents.at(-1)?.armour).toBe(0);});
test('a real native below-one remainder still starts death recovery once',()=>{const s=fixture(Math.fround(nativeFactor+.5));s.damagePlayer(25,false,{weapon:22});expect(s.player.health).toBe(0);expect(s.deathRemaining).toBeGreaterThan(0);expect(s.damageEvents.at(-1)?.died).toBe(true);const timer=s.deathRemaining;s.damagePlayer(25,false,{weapon:22});expect(s.deathRemaining).toBe(timer);expect(s.damageEvents).toHaveLength(1);});
test('a nonfatal event reports the native factor instead of quantized field loss',()=>{const s=fixture(5000),factor=Math.fround(Math.fround(20)*NATIVE_PLAYER_DAMAGE_MULT);s.damagePlayer(20,false,{weapon:28});expect(s.player.health).toBe(Math.fround(Math.fround(5000)-factor));expect(s.damageEvents.at(-1)?.health).toBe(factor);});
test('a sub-ULP accepted hit retains its positive native response without changing the field',()=>{const s=fixture(100),factor=Math.fround(Math.fround(1e-7)*NATIVE_PLAYER_DAMAGE_MULT);s.damagePlayer(1e-7,false,{weapon:22});expect(s.player.health).toBe(100);expect(s.damageEvents.at(-1)).toMatchObject({health:factor,died:false});expect(factor).toBeGreaterThan(0);});
