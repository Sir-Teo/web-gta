import {expect,test} from 'vitest';
import {readVehicleIde,indexVehicleIde} from '../src/assets/vehicleIde';
const row='492 greenwoo greenwoo car GREENWOO GREEN_WOOD null normal 10 0 FFFFFFFF -1 0.75 0.8 2';
test('all vehicle columns retain source identity and wheel dimensions',()=>{
  expect(readVehicleIde('cars\n'+row+'\nend').records[0]).toEqual({id:492,model:'greenwoo',dictionary:'greenwoo',type:'car',handling:'GREENWOO',gameName:'GREEN_WOOD',animation:'null',vehicleClass:'normal',frequency:10,flags:0,components:4294967295,misc:-1,frontWheelSize:.75,rearWheelSize:.8,wheelUpgradeClass:2,line:2,issues:[]});
});
test('mixed IDE sections, comments and duplicate IDs retain provenance and load order',()=>{
  const {records}=readVehicleIde('\uFEFFobjs\n1 tree trees\nend\ncars\n'+row.replace(/ /g,',')+' # test\n'+row.replace('.75','.9')+'\nend');
  expect(records).toHaveLength(2);expect(records[0].line).toBe(5);expect(indexVehicleIde(records).get(492)?.frontWheelSize).toBe(.9);
});
test('optional data remains absent and incomplete wheel definitions are diagnostic',()=>{
  const short=row.split(' ').slice(0,11).join(' '),r=readVehicleIde('cars\n'+short+'\nend').records[0];
  expect(r.frontWheelSize).toBeUndefined();expect(r.misc).toBeUndefined();expect(r.issues).toHaveLength(1);
  const boat=readVehicleIde('cars\n'+short.replace(' car ',' boat ')+'\nend').records[0];expect(boat.issues).toEqual([]);
  const bike=readVehicleIde('cars\n'+row.replace(' car ',' bike ')+'\nend').records[0];expect(bike.misc).toBe(-1);
});
test('malformed fields and resource bounds reject',()=>{
  for(const value of [row+' extra',row.replace('492','-1'),row.replace('FFFFFFFF','xyz'),row.replace('0.75','NaN'),row.replace('greenwoo','bad/name'),row.replace(' 10 ',' 1.5 ')])expect(()=>readVehicleIde('cars\n'+value+'\nend')).toThrow();
  expect(()=>readVehicleIde(' '.repeat(4*1024*1024+1))).toThrow();
});
