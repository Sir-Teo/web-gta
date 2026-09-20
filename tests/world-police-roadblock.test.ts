import {expect,test} from 'vitest';
import {roadblockCrewPlacements,ROADBLOCK_PLACEMENTS,ROADBLOCK_SPECIAL_PLACEMENTS} from '../src/simulation/WorldPolice';
test('roadblock crews stand at GenerateRoadBlockPedsForCar\'s placements, scaled by the car\'s radius',()=>{
 expect(ROADBLOCK_PLACEMENTS[0]).toEqual([-1.5,1.9]);expect(ROADBLOCK_SPECIAL_PLACEMENTS[0]).toEqual([0,3.2]);
 expect(roadblockCrewPlacements(0,2,1,false)).toEqual([{x:-1.5,y:1.9},{x:-1.5,y:-2.6}]);
 expect(roadblockCrewPlacements(1,2,1,false)).toEqual([{x:1.5,y:1.9},{x:1.5,y:-2.6}]);
 expect(roadblockCrewPlacements(2,2,2,false)).toEqual([{x:-3,y:0},{x:3,y:0}]);
 expect(roadblockCrewPlacements(0,4,1,false)).toHaveLength(4);expect(roadblockCrewPlacements(2,4,1,false)).toHaveLength(2);
 expect(roadblockCrewPlacements(2,2,1,true)).toEqual([{x:-1.5,y:0},{x:1.5,y:0}]);
});
