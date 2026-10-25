/** CBmx association phase and frame transforms from the pinned ARM64 executable. */
import {readExecutable,SOURCE} from './lib/ios-executable.mjs';
const expected=[
 [0x100459bc8,0x528019c1],[0x100459bec,0xbd4ab502],
 [0x10045a0a8,0xbd403b00],[0x10045a0b0,0xbd47e901],[0x10045a0b4,0x1e210800],
 [0x10045a0b8,0xf9401708],[0x10045a0bc,0xbd401901],[0x10045a0c0,0x1e211800],
 [0x10045a0e0,0xbd41e900],[0x10045a0e4,0x94024d3f],[0x10045a0ec,0x1e210800],[0x10045a0f0,0xbd0a2660],
 [0x10045a214,0x1e214000],[0x10045a218,0xbd0a2a60],[0x10045a21c,0xbd0a2e60],
 [0x10045aca0,0xf943ca68],[0x10045acc4,0xbd4a2660],[0x10045acd4,0x97f9bcf9],
 [0x10045ad04,0xf943ce68],[0x10045ad28,0xbd4a2a60],[0x10045ad38,0x97f9bce0],
 [0x10045ad68,0xf943d268],[0x10045ad8c,0xbd4a2e60],[0x10045ad9c,0x97f9bcc7],
];
const executable=await readExecutable(process.argv[2]);executable.expectCode(expected);
const float=address=>executable.file.readFloatLE(executable.offset(address));
const constants={negativeTau:float(0x10058e7e8),restKeep:float(0x1005941e8),hopTarget:float(0x10058cab4)};
if(constants.negativeTau!==Math.fround(-2*Math.PI)||constants.restKeep!==Math.fround(.97)||constants.hopTarget!==Math.fround(Math.PI/2))throw Error('Unexpected bicycle crank constants.');
console.log(JSON.stringify({source:SOURCE,functions:['CBmx::ProcessDrivingAnims','CBmx::PreRender'],
 notes:['Animation IDs 207/208 are BIKE_PEDAL/BIKE_SPRINT; the selected association phase sets crank = -2pi * currentTime / duration.',
 'Without an active association, crank *= pow(float32(0.97), CTimer::ms_fTimeStep).',
 'Both pedal angles are -crank. Chainset/pedal_r/pedal_l nodes are optional and their matrices use SetRotate(angle, 0, 0), restoring their original translation.',
 'The bunny-hop association blends the crank towards pi/2; that association and native transition selection are not yet ported by the browser rider controller.'],
 constants,instructions:expected.map(([address,word])=>({address:`0x${address.toString(16)}`,word:`0x${word.toString(16)}`}))},null,2));
