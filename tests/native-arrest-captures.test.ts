import {expect,test} from 'vitest';
import captures from './fixtures/native-arrest-task.json';
import {copCanArrest} from '../src/police/nativeArrest';
// Native SetDownTime is called after the eligibility test and before MakeAbortable.
// Its captured call remains the oracle even when an existing task refuses the abort.
type Capture={input:{name:string;subtask?:number;hasFall?:boolean;falling?:boolean;position?:number[]};downTimesMs:number[]};
for(const capture of captures.captures as Capture[]){const input=capture.input;if(!('hasFall'in input)||input.subtask!==1000)continue;
 test(`native ${input.name} eligibility in both coordinate frames`,()=>{
  const position=input.position??[0,0,0],falling=input.falling===true,expected=capture.downTimesMs.includes(100000),cop={x:0,y:0,z:0};
  expect(copCanArrest({cop,suspect:{x:position[0],y:position[1],z:position[2]},suspectFalling:falling,up:'z'})).toBe(expected);
  expect(copCanArrest({cop,suspect:{x:position[0],y:position[2],z:-position[1]},suspectFalling:falling,up:'y'})).toBe(expected);
 });
}
