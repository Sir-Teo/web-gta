/** CBmx jump-association timing and flags in the pinned ARM64 executable. */
import {readExecutable,SOURCE} from './lib/ios-executable.mjs';
const expected=[
 [0x10045994c,0x528019c2],[0x100459948,0x1e241000],[0x100459950,0x97f38f23],
 [0x100459ae8,0xbd4a0d02],[0x100459aec,0x1e220800],[0x100459af0,0x1e211800],
 [0x100459b14,0xbd4a0d20],[0x100459b20,0x1e213801],[0x100459b24,0x1e201821],
 [0x100459b34,0xbd490d03],[0x100459b3c,0x1e220821],[0x100459b40,0x1e202820],
 [0x100459b50,0x320a1fe9],[0x100459b54,0xb9003e89],
 [0x100459994,0x52b82008],[0x100459998,0xb9003688],
];
const e=await readExecutable(process.argv[2]);e.expectCode(expected);
const float=a=>e.file.readFloatLE(e.offset(a)),chargeSeconds=float(0x10058ca0c),negativeChargeSeconds=float(0x10059090c),associationFlags=e.int32s(0x100624910,6);
if(chargeSeconds!==Math.fround(.2)||negativeChargeSeconds!==Math.fround(-.2)||associationFlags.join()!=='206,4120,207,4146,208,4146')throw Error('Unexpected bicycle jump association data.');
console.log(JSON.stringify({source:SOURCE,function:'CBmx::ProcessBunnyHop',
 pcReference:'https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Bmx.cpp',
 notes:['BIKE_BUNNYHOP (206) blends in at 8/s. A non-player driver cancels at -8/s.',
 'Held: currentTime = 0.2 * controlJump / 25. Release: currentTime = (0.2-currentTime)/0.2 * (duration-0.2) + 0.2; playback speed is 1.5.',
 'Native descriptor flags for 206 are 0x1018: FINISH_AUTO_REMOVE | PARTIAL | SECONDARY_TASK_ANIM. The pinned PC CAnimBlendAssociation::UpdateTime sets finish-auto-remove blend delta to -4/s.',
 'The adjacent pedal/sprint descriptors (207/208) are 0x1032. The reversed PC descriptor array currently omits these three trailing entries; the executable supplies the evidence.'],
 constants:{chargeSeconds,negativeChargeSeconds,releaseSpeed:1.5,blendIn:8,cancelBlendOut:-8,finishBlendOut:-4},associationFlags,
 instructions:expected.map(([address,word])=>({address:`0x${address.toString(16)}`,word:`0x${word.toString(16)}`}))},null,2));
