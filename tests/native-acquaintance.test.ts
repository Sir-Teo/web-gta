import {expect,test} from 'vitest';
import {ACQUAINTANCE_DISLIKE,ACQUAINTANCE_HATE,ACQUAINTANCE_IGNORE,ACQUAINTANCE_LIKE,ACQUAINTANCE_RESPECT,
 NativeAcquaintance,NATIVE_PED_TYPES,nativePedType} from '../src/ped/nativeAcquaintance';

test('ePedType numbers the types the way the enum does, by name and without case',()=>{
 expect(NATIVE_PED_TYPES.length).toBe(32);
 expect(nativePedType('CIVMALE')).toBe(4);
 expect(nativePedType('CIVFEMALE')).toBe(5);
 expect(nativePedType('COP')).toBe(6);
 expect(nativePedType('GANG1')).toBe(7);
 expect(nativePedType('PROSTITUTE')).toBe(22);
 expect(nativePedType('mission8')).toBe(31);
 expect(nativePedType('NOT_A_TYPE')).toBeUndefined();
 expect(nativePedType(undefined)).toBeUndefined();
});

test('putting a ped type in one acquaintance takes it out of the other four',()=>{
 const table=new NativeAcquaintance(),cop=1<<6,gang=1<<7;
 table.setAs(ACQUAINTANCE_HATE,cop);
 expect(table.idFor(6)).toBe(ACQUAINTANCE_HATE);
 // The same type set again somewhere else moves rather than joining both.
 table.setAs(ACQUAINTANCE_LIKE,cop);
 expect(table.idFor(6)).toBe(ACQUAINTANCE_LIKE);
 expect(table.get(ACQUAINTANCE_HATE)).toBe(0);
 // Other types are untouched by the move.
 table.setAs(ACQUAINTANCE_DISLIKE,gang);
 expect(table.idFor(7)).toBe(ACQUAINTANCE_DISLIKE);
 expect(table.idFor(6)).toBe(ACQUAINTANCE_LIKE);
 // Setting a type that is already in that list changes nothing at all.
 table.setAs(ACQUAINTANCE_LIKE,cop);
 expect(table.idFor(6)).toBe(ACQUAINTANCE_LIKE);
 // Clearing takes it out and leaves it in none.
 table.clearAs(ACQUAINTANCE_LIKE,cop);
 expect(table.idFor(6)).toBeUndefined();
 // Clearing a whole acquaintance empties that list only.
 table.clear(ACQUAINTANCE_DISLIKE);
 expect(table.idFor(7)).toBeUndefined();
 expect(table.get(ACQUAINTANCE_RESPECT)).toBe(0);
 expect(table.get(ACQUAINTANCE_IGNORE)).toBe(0);
});

test('a mask can carry several ped types at once, as the command’s own bit numbers do',()=>{
 const table=new NativeAcquaintance(),both=(1<<4)|(1<<5);
 table.setAs(ACQUAINTANCE_RESPECT,both);
 expect(table.idFor(4)).toBe(ACQUAINTANCE_RESPECT);
 expect(table.idFor(5)).toBe(ACQUAINTANCE_RESPECT);
 table.setAs(ACQUAINTANCE_HATE,1<<31);
 expect(table.idFor(31)).toBe(ACQUAINTANCE_HATE);
 expect(table.get(ACQUAINTANCE_HATE)).toBe(0x80000000);
});
