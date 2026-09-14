import {readFileSync} from 'node:fs';
import {test,expect} from 'vitest';
import {readHandling} from '../src/assets/handling';
import {readVehicleIde} from '../src/assets/vehicleIde';
import {prepareFlyingHandling,indexFlyingHandling} from '../src/assets/flyingHandling';
import {nativePlaneGear} from '../src/simulation/nativePlaneGear';
const raw=readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','utf8'));
const profiles=indexFlyingHandling(raw.supplements);
test('every shipped aircraft associates with its native flight table entry',()=>{
 expect(profiles.size).toBe(24);
 const vehicles=readVehicleIde(readFileSync('public/play/world/files/vehicles/vehicles.ide','utf8')).records.filter(v=>v.type==='plane'||v.type==='heli');expect(vehicles).toHaveLength(24);
 for(const vehicle of vehicles){const profile=profiles.get(vehicle.handling);expect(profile,vehicle.model).toBeDefined();expect(Object.keys(profile!.values)).toHaveLength(21);}
 expect(profiles.get('RUSTLER')!.handlingId).toBe(188);expect(profiles.get('DODO')!.handlingId).toBe(197);expect(profiles.get('RCRAIDER')!.handlingId).toBe(209);
 expect(profiles.get('RUSTLER')!.values).toMatchObject({thrust:.5,gearUpResistance:Math.fround(.2),gearDownLift:Math.fround(1.2),formLift:Math.fround(.008),speedResistanceZ:0});
 expect(profiles.get('DODO')!.values.formLift).toBe(Math.fround(.02));
});
test('source float32 narrowing preserves signed stability and documented RCRAIDER spelling',()=>{
 const profile=profiles.get('RCRAIDER')!;expect(profile.values.windMultiplier).toBe(Math.fround(.1));expect(profile.sourceQuirks).toEqual(['Original windMultiplier suffix: 0.1s']);
 expect(profiles.get('RUSTLER')!.values.rollStabilization).toBe(Math.fround(-.002));
 const row=raw.supplements.find(r=>r.kind==='flying'&&r.tokens[0]==='RCRAIDER')!;
 expect(row.tokens[14]).toBe('0.1s');prepareFlyingHandling(row);expect(row.tokens[14]).toBe('0.1s');
});
test('malformed flight profiles never silently become partial or guessed data',()=>{
 const row=raw.supplements.find(r=>r.kind==='flying')!;
 for(const token of ['NaN','Infinity','1e99','0.2garbage']){const bad=structuredClone(row);bad.tokens[1]=token;expect(()=>prepareFlyingHandling(bad)).toThrow();}
 const extra=structuredClone(row);extra.tokens.push('1');expect(()=>prepareFlyingHandling(extra)).toThrow('21 fields');
 const badName=structuredClone(row);badName.tokens[0]='MADEUP';expect(()=>prepareFlyingHandling(badName)).toThrow('Unknown native');
 expect(()=>indexFlyingHandling([row,row])).toThrow('Duplicate');
});
test('native Rustler gear endpoints change drag and wheel availability; Dodo retains equal drag',()=>{
 const rustler=profiles.get('RUSTLER')!,dodo=profiles.get('DODO')!;
 const up=nativePlaneGear(true,2,rustler),down=nativePlaneGear(false,2,rustler);
 expect(up.landingGearStatus).toBe(1);expect(up.wheelStatus).toBe('missing');expect(down.landingGearStatus).toBe(0);expect(down.wheelStatus).toBe('ok');
 expect(up.airResistance/down.airResistance).toBeCloseTo(.2,7);
 expect(nativePlaneGear(true,2,dodo).airResistance).toBe(nativePlaneGear(false,2,dodo).airResistance);
 expect(()=>nativePlaneGear(true,NaN,rustler)).toThrow();
});
