# Dead-body sight query research

Native observations, October 22, 2026. CAN_CHAR_SEE_DEAD_CHAR (0480) now has partial on-foot
coverage, described in [DEAD_BODY_SIGHT.md](DEAD_BODY_SIGHT.md).

MANSIO2 (mission 103) calls it at SCM 2495410, 2495421 and 2509087 with local-array observer handles and ped
types 25/24/25. The pinned iOS handler at `0x1001e23cc` collects two parameters, resolves the first as a ped,
then at `0x1001e2af0` scans 16 pointers at intelligence +0x228. The second parameter is ignored. For each
non-null entry it calls IsAlive (`0x10032911c`), then CanPedTargetPed (`0x1003483e0`) with direction checking.
IsAlive tests ped states 54/55 (DIE/DEAD), independently of current health.

CanPedTargetPed aims at target origin +0.75 z, or -0.25 z if a secondary duck task exists. CanPedTargetPoint
(`0x1003482fc`) rejects negative forward dot products, then 3D squared distance >1600 (constant at
`0x10058fdc0`). Its line starts at observer origin +0.75 z and checks buildings/objects, with camera-ignore
checking on, excluding vehicles/peds/dummies and see-through checking off.

The reversed CEntityScanner (PC 5FFA20) refreshes a nearest-16 list on its tick timer, within the maximum of
hearing and seeing ranges. For NPC observers it excludes peds already in DEAD state, while dying peds can
remain candidates. The scanner can also retain an entry between refreshes. The browser has nearby-living
queries and death-clip timing but no equivalent shared ped-scanner state. A fresh health-based search would
therefore give different answers, especially for fully dead bodies and immediately after a scan.

The browser now supplies a cached scan and a death-animation phase distinction before exposing the original
conditional query. The complete native task/PEDSTATE transition still needs work. The native binary identity
is recorded in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
