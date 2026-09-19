import {expect,test} from 'vitest';
import {findNodeClosestToCoorsFavourDirection} from '../src/simulation/trafficRoute';

const node=(x:number,y:number,z:number,extra={})=>({kind:'vehicle',water:false,linkCount:1,position:[x,y,z],...extra});
const areas=(nodes:unknown[])=>new Map([[0,{nodes}]]) as never;

test('FindNodeClosestToCoorsFavourDirection weighs height by 3 and favours nodes ahead',()=>{
 // Level 12 away beats one 5 away but 4 up: 12 against 5 + 3 × 4.
 const level=node(12,0,0),above=node(5,0,4);
 expect(findNodeClosestToCoorsFavourDirection(areas([above,level]),{x:0,y:0,z:0},{x:1,y:0})).toBe(level);
 // A node 10 behind costs 10 + 40; one 30 ahead wins.
 const behind=node(-10,0,0),ahead=node(30,0,0);
 expect(findNodeClosestToCoorsFavourDirection(areas([behind,ahead]),{x:0,y:0,z:0},{x:1,y:0})).toBe(ahead);
 // Water, unlinked and pedestrian nodes are skipped.
 expect(findNodeClosestToCoorsFavourDirection(areas([node(1,0,0,{water:true}),node(2,0,0,{linkCount:0}),node(3,0,0,{kind:'pedestrian'}),ahead]),{x:0,y:0,z:0},{x:1,y:0})).toBe(ahead);
});
