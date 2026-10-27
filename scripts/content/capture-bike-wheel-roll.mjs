/** Reproduce the inspected ARM64 wheel-angle instructions; no executable is bundled. */
import {readExecutable,SOURCE} from './lib/ios-executable.mjs';
const expected=[
 [0x1004554b4,0xbd492260],[0x1004554bc,0x5400008c],
 [0x100455520,0xbd4072a0],[0x100455534,0x52800001],[0x100455538,0x94008752],
 [0x100455544,0xbd094a60],[0x10045554c,0x1e210800],[0x100455558,0xbd094260],
 [0x10045555c,0xbd492a60],[0x100455570,0x540004ad],
 [0x1004555c8,0xb94a1661],[0x1004555cc,0xbd4076a0],[0x1004555e0,0x94008728],
 [0x1004555ec,0xbd094e60],[0x1004555f4,0x1e210800],[0x100455600,0xbd094660],
 [0x100455868,0xbd494268],[0x10045589c,0x9103c3e0],[0x1004558a4,0x97f9d1cb],
 [0x100455944,0xbd494668],[0x100455978,0x9103c3e0],[0x100455980,0x97f9d194],
];
const executable=await readExecutable(process.argv[2]);executable.expectCode(expected);
console.log(JSON.stringify({source:SOURCE,function:'CBike::PreRender',entry:'0x100454ee0',
 processWheelRotation:'0x100477280',angleFields:{front:'0x940',rear:'0x944'},
 notes:['A positive front contact count selects half the front wheel diameter and wheel state NORMAL.',
 'A positive rear contact count selects half the rear diameter and the state at bike+0xa14.',
 'Each returned rotation speed is multiplied by CTimer::ms_fTimeStep and added to its axle angle.',
 'The ordinary non-burst wheel frames use SetRotateX of the stored axle angle.'],
 instructions:expected.map(([address,word])=>({address:`0x${address.toString(16)}`,word:`0x${word.toString(16)}`}))},null,2));
