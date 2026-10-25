# Aircraft gun hard points and velocity lead

Ordinary aircraft gun traces now start at the model's gun dummy or the native
model hard point. The old host position was the fuselage centreline, up to six
units forward according to its collision radius. That point put Rustler fire
between the wings and Hunter fire above its actual gun.

PC CVehicle::GetPlaneGunsPosition (0x6D4290) first returns a nonzero model dummy
at DUMMY_VEHICLE_GUN (13). CVehicleModelInfo::PreprocessHierarchy obtains the
dummy's translation and transforms it through its parents, excluding the clump
root. The pinned aircraft hierarchy descriptors identify this dummy as
`miscpos_a`, hierarchy ID 13, flags 9. The host captures its immutable model
position once when WorldPlane is constructed.

Absent an active dummy, the native positions are right/forward/up:

| Model | Position |
| --- | --- |
| Hunter | 0, 4.41, -1.27 |
| Seasparrow | -0.5, 2.4, -0.785 |
| RC Baron | 0, 0.45, 0 |
| Rustler | 2.19 + 0.2 × (gunId - 1), 1.5, -0.58 |
| Maverick / Police Maverick | 0, 2.85, -0.5 |
| Hydra | 1.48, 0.44, -0.52 |
| Cargobob | 0, 6.87, -1.65 |
| Tornado / unsupported fallback | 0, 0, 0 |

The source refers to Hunter's offset through the missing PC VehicleGunOffset
global. Its pinned executable initializer supplies that value. The other
constants and Rustler spacing agree with the reversed PC function. These
float32 values are initialized by MOVZ/MOVK instructions, rather than stored
as a contiguous float table. The ordinary Hunter position differs from
FIRE_HUNTER_GUN's separate `(0, 4.8, -1.3)` offset, which remains distinct.

FirePlaneGuns (PC 0x6D4D30) advances Rustler's two-bit hard-point cycle before
querying its position: 1, 2, 0, then 1 again. Rejected cooldown attempts leave
it alone, and aircraft retain independent cycles when control changes.
The native world trace origin adds a full timestep of move speed after the
vehicle transform. Browser velocity in metres/second times the current fixed
step in seconds gives the same unit conversion. Scripted Hunter firing retains
its separately supplied native timestep and offset.

The PC implementation returns a nonzero model dummy before Rustler spacing;
this branch order is preserved. The pinned mobile routine instead reaches
its Rustler offset after loading the dummy, so its instruction trace is not
substituted for this PC branch.

Sources at revision 4281f82d8af83e14935ac84a69dfd1ceebb9f256:
[Vehicle.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Vehicle.cpp),
[VehicleModelInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Models/VehicleModelInfo.cpp),
[VehicleModelInfo.h](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Models/VehicleModelInfo.h).
The [constant and descriptor capture](plane-gun-positions-capture.json) checks
the pinned executable hash and the instructions connecting the Hunter global
and dummy field to GetPlaneGunsPosition. It is reproducible:

```
node scripts/content/capture-plane-gun-positions.mjs [path-to-pinned-executable]
```

Units compare all nine captured records, dummy precedence, float32 Rustler
spacing, parent/root transforms, invalid hierarchy rejection, independent
accepted-shot cycles and transformed/velocity-led origins for all five armed
host models. The live model check uses original Hunter, Seasparrow, RC Baron,
Rustler and Hydra assets. Its independent Three transforms agree with every
emitted origin. The outgoing original car/bike occupant check and original
0541 command also pass with the new positions.

The existing attacking Hunter fixture originally spawned its body 0.5 below
the fixed Hydra target's centre. Its native gun was then 1.77 below the target,
and it fired 148 rounds without a damage call. The fixture now aligns only the
initial muzzle height with the target's body centre, using gunPosition's native
offset. The enemy still flies under HELI_ATTACK_PLAYER, with the same gun,
rocket and real-damage requirements. The settled run records six gun calls,
two rockets and two enemy aircraft-damage calls. Its first recorded tracer meets
the target's fuselage. All 21 supported aircraft also pass original-model
construction and disposal after the new dummy cache is installed.

Remaining scope: the host still emits one ray per gun activation. The reversed
PC FirePlaneGuns implementation repeats one precomputed point in its two-shot
loop, whereas the pinned mobile routine recalculates and mirrors the second
barrel's X. That difference needs retail PC evidence before claiming complete
barrel parity. Attached flash positions, casing flags/size, spread, vehicle
weapon availability and matched retail traces remain open.
