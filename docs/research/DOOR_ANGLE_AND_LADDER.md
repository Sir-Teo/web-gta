# Door angle queries and the fire ladder

Native research, October 22, 2026. GET_DOOR_ANGLE_RATIO (095F) now returns the original raw door angle. FINALEC's
only call uses index 6, the fire ladder's swinging chassis, while adjusting its attachment heading.

Evidence uses the hash-verified ARM64 executable described in [remote control](REMOTE_CONTROL.md#evidence), plus
pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`, `Door.cpp`, `Automobile.cpp` and `tHandlingData.h`.

The command's name is misleading. The 2300-range table at 0x100202a5c, entry 99, reaches handler 0x1002026c0.
After the vehicle-pool lookup, 0x1002028e8 computes vehicle + 0x77c + door*0x18 for indices below 6, or vehicle +
0x934 otherwise, and copies that float to the output. These are the CDoor::m_angle fields of the six doors and
m_swingingChassis, respectively. There is no division by m_openAngle and no virtual GetDooorAngleOpenRatio call.
Regular door angles retain their sign; every valid index >= 6 chooses the seventh door. Invalid negative indices
are not meaningful native input and do not read arbitrary memory in the browser.

CAutomobile initializes the seventh door when handling flag 0x10000000 (SWINGING_CHASSIS, in handlingFlags, not
modelFlags) is set, or for the ladder fire truck, model 544. Handling takes precedence. Ordinary limits are
+/-0.02*pi, with 598/419 using 0.03*pi and 409 using 0.01*pi. The fire ladder uses +/-0.1*pi. Both mechanisms keep
a fixed active door state and hinge about native Z.

CDoor::Process (iOS 0x10045ee04) derives acceleration from the current versus previous point velocity, adds native
gravity, converts into vehicle axes and forms torque against the rotated direction. For chassis suspension,
input is scaled by 0.025, or zero in widescreen/airborne reduced mode; damping is pow(0.98,timeStep), or
pow(0.95,timeStep), with spring -timeStep*angle*0.06 and speed cap 0.02. The fire ladder uses its native 0.001
threshold, damping 0.92, spring -timeStep*angle*0.01 and cap 0.05. Angle increments by angular velocity once per
render frame, without another timestep multiplication. Stops bounce at -0.8 and -0.4.

The ARM64 rotation at 0x10045efa8 uses the ordinary sin/cos rotation, consistent with the existing native-door
helper; the pinned reversed source negates one rotated component. The new mechanism uses that helper's direction
and the executable's constants. In PreRender (0x100449c80 onward), the active chassis uses frame `chassis`, while
544 uses `misc_b`. After yaw, 0x100449d20 applies the moving-part pitch, angle * float32(-0.0001), about native X.
The resulting Rx(pitch)*Rz(yaw) basis preserves the original frame position.

The car host now owns this seventh-door state, samples motion at the existing 30-fps component cadence and draws
its original frame. GET reads its float32 angle, independently of the open-ratio helper used elsewhere. Disabled
bodies retain their drawing and do not advance the spring. Exact variable-render-rate and visibility gating,
native contact forces, and CONTROL_CAR_DOOR's additional seventh-door state overrides remain separate work.
This is not a complete FINALEC mission pass.

Unit checks cover model/handling initialization, springs, damping, caps, reduced mode, stop bounces and SCM index
forwarding. The live check uses actual 095F bytecode on a model-544 body and original DFF, tests signed ordinary
doors versus raw seventh-door output, applies a lateral velocity change, and verifies composed ladder yaw/pitch.
Existing loader, touch-loader and ordinary door/component browser regressions are also exercised.
