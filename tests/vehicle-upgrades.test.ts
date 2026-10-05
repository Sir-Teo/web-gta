import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {otherLinkedUpgrade,readCarMods,vehicleModSlot,vehicleRemaps,vehicleUpgradePlace,VEHICLE_UPGRADE_SLOTS} from '../src/vehicle/nativeVehicleUpgrades';
// CVehicleModelInfo::LoadVehicleUpgrades over the published carmods.dat (noclip's PC copy; the iOS bundle's is the
// same file with Unix line ends), and CAtomicModelInfo::SetupVehicleUpgradeFlags.
const mods=readCarMods(readFileSync('public/play/world/files/vehicles/carmods.dat','utf8'));
test('the linked pairs, each model\'s upgrades with the hydraulics and stereo after them, and the three wheel sets',()=>{
 expect(mods.links).toHaveLength(23);
 expect(mods.links[0]).toEqual(['bntl_b_ov','bntr_b_ov']);
 expect(otherLinkedUpgrade(mods,'WG_R_A_J')).toBe('wg_l_a_j');expect(otherLinkedUpgrade(mods,'spl_b_mar_m')).toBeUndefined();
 expect(mods.mods.get('admiral')).toEqual(['nto_b_l','nto_b_s','nto_b_tw','hydralics','stereo']);
 expect(mods.mods.get('blistac')).toEqual(['rf_b_sc_r','wg_l_b_ssk','bnt_b_sc_p_m','exh_b_t','spl_b_bbb_m','spl_b_bab_m','nto_b_l','nto_b_s','nto_b_tw','spl_b_mab_m','spl_b_bar_m','bntl_b_ov','exh_b_l','hydralics','stereo']);
 for(const list of mods.mods.values())expect(list.length).toBeLessThanOrEqual(VEHICLE_UPGRADE_SLOTS);
 expect([...mods.wheels.keys()]).toEqual([0,1,2]);
 expect(mods.wheels.get(0)).toEqual(['wheel_gn1','wheel_gn2','wheel_gn3','wheel_gn4','wheel_gn5','wheel_sr3','wheel_sr4','wheel_lr3','wheel_lr4','wheel_or1']);
 expect(mods.wheels.get(2)).toHaveLength(9);
});
test('an upgrade\'s place: a chassis part at the car\'s upgrade positions, a dummy part standing in for its own component',()=>{
 expect(vehicleUpgradePlace('bnt_b_sc_m')).toEqual({place:0,dummy:false});
 expect(vehicleUpgradePlace('bntl_b_ov')).toEqual({place:1,dummy:false});
 expect(vehicleUpgradePlace('spl_b_mar_m')).toEqual({place:6,dummy:false});
 expect(vehicleUpgradePlace('wg_r_a_j')).toEqual({place:9,dummy:false});
 expect(vehicleUpgradePlace('nto_b_tw')).toEqual({place:0xF,dummy:false});
 expect(vehicleUpgradePlace('hydralics')).toEqual({place:0x10,dummy:false});
 expect(vehicleUpgradePlace('exh_b_t')).toEqual({place:0x13,dummy:true});
 expect(vehicleUpgradePlace('wheel_sr3')).toEqual({place:2,dummy:true});
 expect(vehicleUpgradePlace('fbmp_a_s')).toEqual({place:0xC,dummy:true});
 expect(vehicleUpgradePlace('misc_c_lr_rem1')).toEqual({place:0x16,dummy:true});
 expect(vehicleUpgradePlace('cj_coin_op')).toBeUndefined();
 // Every upgrade the file names has a place.
 const all=[...mods.links.flat(),...[...mods.mods.values()].flat(),...[...mods.wheels.values()].flat()];
 expect(all.filter(n=>!vehicleUpgradePlace(n))).toEqual([]);
});
test("GET_VEHICLE_MOD_TYPE's slots (iOS): the chassis parts 0 to 10, the dummy parts 11 to 16, anything else 0",()=>{
 const slot=(name:string)=>vehicleModSlot(vehicleUpgradePlace(name));
 expect(['bnt_b_sc_m','bntl_b_ov','bntr_b_ov','spl_b_mar_m','wg_l_b_ssk','wg_r_a_j','fbb_lr_slv1','bbb_lr_slv1','lgt_b_rspt','rf_b_sc_r','nto_b_l','hydralics','stereo'].map(slot)).toEqual([0,1,1,2,3,3,4,5,6,7,8,9,10]);
 expect(['chss_lr_t1','wheel_gn1','exh_b_t','fbmp_a_s','rbmp_a_s','misc_a_lr_rem1','misc_b_lr_rem1','misc_c_lr_rem1'].map(slot)).toEqual([11,12,13,14,15,16,16,16]);
 expect(slot('cj_coin_op')).toBe(0);
});
test("a vehicle's paintjobs: the archive's dictionaries named after it with digits, in the archive's order, four at most (AssignRemapTxd)",()=>{
 const remaps=vehicleRemaps(['elegy1.txd','elegy.txd','elegy2.TXD','cj_ped1.txd','camper1.txd','elegy3.txd','x1.dff','sultan1.txd','sultan2.txd','sultan3.txd','sultan4.txd','sultan5.txd'],new Set(['elegy','camper','sultan']));
 expect(remaps.get('elegy')).toEqual(['elegy1','elegy2','elegy3']);expect(remaps.get('camper')).toEqual(['camper1']);
 expect(remaps.get('sultan')).toHaveLength(4);expect(remaps.has('cj_ped')).toBe(false);
});
