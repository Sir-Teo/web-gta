import {expect,test} from 'vitest';
import {readHandling,indexHandling} from '../src/assets/handling';
// Independent synthetic base record: name + 35 source-ordered values.
const row='DIAGNOSTIC 1200 2400 2.5 0.1 -0.2 -0.3 75 0.8 0.9 0.52 5 180 24 10 R P 8 0.6 0 35 1.2 0.15 0.02 0.3 -0.2 0.55 0.1 0.25 0.7 12345 80000001 FFFFFFFF 1 2 3';
test('base handling preserves source field order, raw units and unsigned flags',()=>{
  const {records,supplements,warnings}=readHandling('\uFEFF; diagnostic\r\n'+row+'\r\n;the end\ninvalid');
  expect(records).toHaveLength(1);expect(supplements).toEqual([]);expect(warnings).toEqual([]);
  expect(records[0]).toMatchObject({name:'DIAGNOSTIC',line:2,issues:[],values:{mass:1200,turnMass:2400,dragMultiplier:2.5,
    centerOfMassX:.1,centerOfMassY:-.2,centerOfMassZ:-.3,percentSubmerged:75,tractionMultiplier:.8,tractionLoss:.9,tractionBias:.52,
    gears:5,maxVelocity:180,engineAcceleration:24,engineInertia:10,driveType:'R',engineType:'P',brakeDeceleration:8,brakeBias:.6,abs:0,
    steeringLock:35,suspensionForce:1.2,suspensionDamping:.15,suspensionHighSpeedCompression:.02,suspensionUpperLimit:.3,suspensionLowerLimit:-.2,
    suspensionBias:.55,suspensionAntiDive:.1,seatOffset:.25,collisionDamageMultiplier:.7,monetaryValue:12345,modelFlags:2147483649,
    handlingFlags:4294967295,frontLights:1,rearLights:2,animationGroup:3}});
});
test('specialized families remain ordered raw records with explicit noninterpretation warnings',()=>{
  const result=readHandling('! BIKE 1 2\n$ HELI 1 0.5s\n% BOAT 3\n^ 4 5\n'+row.replaceAll(' ',','));
  expect(result.records).toHaveLength(1);expect(result.supplements).toEqual([
    {kind:'bike',line:1,tokens:['BIKE','1','2']},{kind:'flying',line:2,tokens:['HELI','1','0.5s']},
    {kind:'boat',line:3,tokens:['BOAT','3']},{kind:'animation',line:4,tokens:['4','5']},
  ]);expect(result.warnings[0]).toContain('4 specialized');
});
test('raw duplicates survive and exact-name index uses the last matching definition',()=>{
  const {records}=readHandling(row+'\n'+row.replace('1200','1300')+'\n'+row.replace('DIAGNOSTIC','diagnostic'));
  expect(records).toHaveLength(3);const index=indexHandling(records);
  expect(index.size).toBe(2);expect(index.get('DIAGNOSTIC')?.values.mass).toBe(1300);expect(index.get('diagnostic')?.values.mass).toBe(1200);
});
test('unsupported raw byte and enum values are retained with issues, never silently normalized',()=>{
  const tokens=row.split(' ');tokens[1]='0';tokens[7]='0';tokens[11]='256';tokens[15]='X';tokens[16]='Q';
  const record=readHandling(tokens.join(' ')).records[0];expect(record.values.gears).toBe(256);expect(record.values.driveType).toBe('X');expect(record.issues).toHaveLength(5);
});
test('malformed base input rejects partial numeric scans, wrong counts, flag overflow and control corruption',()=>{
  for(const [column,value] of [[1,'12kg'],[1,'NaN'],[1,'1e40'],[11,'2.5'],[30,'2147483648'],[31,'100000000'],[32,'-1'],[15,'RR']] as const){
    const tokens=row.split(' ');tokens[column]=value;expect(()=>readHandling(tokens.join(' '))).toThrow(/Handling line 1/);
  }
  for(const value of [row+' 1',row.split(' ').slice(0,-1).join(' '),row.replace('DIAGNOSTIC','A'.repeat(32)),row+'\0','!'])expect(()=>readHandling(value)).toThrow();
  expect(()=>readHandling(' '.repeat(4*1024*1024+1))).toThrow(/4 MiB/);
});
