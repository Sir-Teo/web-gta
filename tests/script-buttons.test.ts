import {expect,test} from 'vitest';
import {BUTTON} from '../src/engine/ScmPads';
import {ScriptButtonReads,touchActionsForReads} from '../src/input/scriptButtons';

test('a button counts as wanted while a script reads it, and for half a second after',()=>{
 const reads=new ScriptButtonReads(),counts=new Array(20).fill(0);
 const at=(now:number)=>[...reads.update(b=>counts[b],now)].sort((a,b)=>a-b);
 expect(at(0)).toEqual([]);
 counts[BUTTON.triangle]=3;expect(at(100)).toEqual([BUTTON.triangle]);
 counts[BUTTON.triangle]=4;counts[BUTTON.dpadLeft]=1;expect(at(300)).toEqual([BUTTON.dpadLeft,BUTTON.triangle]);
 // The script stops reading: the buttons go half a second after their last read.
 expect(at(700)).toEqual([BUTTON.dpadLeft,BUTTON.triangle]);expect(at(801)).toEqual([]);
});

test('the touch buttons for what a script reads: those shown only on call, by where the player is',()=>{
 const read=(...buttons:number[])=>new Set(buttons);
 const foot={inVehicle:false,menu:false,asked:[] as string[]},car={...foot,inVehicle:true};
 // Nothing read, nothing asked; the buttons always on screen (Fire, Jump, Sprint, the pedals) are not asked for again.
 expect(touchActionsForReads(read(),foot)).toEqual([]);
 expect(touchActionsForReads(read(BUTTON.cross,BUTTON.circle,BUTTON.square,BUTTON.leftShock),foot)).toEqual([]);
 // A blackjack table: Enter (triangle) for leaving, the weapon's R2 is on screen. A hoop: Look back (R3).
 expect(touchActionsForReads(read(BUTTON.triangle,BUTTON.cross,BUTTON.rightShoulder2),foot)).toEqual(['VEHICLE_ENTER_EXIT']);
 expect(touchActionsForReads(read(BUTTON.rightShock),foot)).toEqual(['PED_LOOKBEHIND']);
 // A call: Action on foot only.
 expect(touchActionsForReads(read(BUTTON.leftShoulder1),foot)).toEqual(['PED_ANSWER_PHONE']);
 expect(touchActionsForReads(read(BUTTON.leftShoulder1),car)).toEqual([]);
 // A gym machine's level, the roulette chip: the arrows; at the wheel, the shoulder twos are the look buttons.
 expect(touchActionsForReads(read(BUTTON.dpadLeft,BUTTON.dpadRight,BUTTON.dpadUp,BUTTON.dpadDown),foot)).toEqual(['MENU_UP','MENU_DOWN','MENU_LEFT','MENU_RIGHT']);
 expect(touchActionsForReads(read(BUTTON.leftShoulder2,BUTTON.rightShoulder2,BUTTON.triangle),car)).toEqual(['VEHICLE_ENTER_EXIT','VEHICLE_LOOKLEFT','VEHICLE_LOOKRIGHT']);
 // A script menu has its own arrows; a direction already up under its own name (a conversation's Yes and No, the
 // group's Follow and Stay) is not put up twice.
 expect(touchActionsForReads(read(BUTTON.dpadLeft,BUTTON.dpadUp),{...foot,menu:true})).toEqual([]);
 expect(touchActionsForReads(read(BUTTON.dpadLeft,BUTTON.dpadRight,BUTTON.dpadUp,BUTTON.dpadDown),{...foot,asked:['CONVERSATION_YES','CONVERSATION_NO']})).toEqual(['MENU_UP','MENU_DOWN']);
 expect(touchActionsForReads(read(BUTTON.dpadUp,BUTTON.dpadDown),{...foot,asked:['GROUP_CONTROL_FWD','GROUP_CONTROL_BWD']})).toEqual([]);
});
