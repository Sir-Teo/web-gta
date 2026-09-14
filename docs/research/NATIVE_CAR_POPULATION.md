# Native car population inputs and selection

The original `cargrp.dat` is now part of the static vehicle resource catalog,
locked in `scripts/content/world-sources.json` and the published manifest:

- [Public native resource](https://z.noclip.website/GrandTheftAutoSanAndreas/data/cargrp.dat)
- 3,963 bytes; SHA-256 `40670294c436e9d96ae30095cc720eba1655615be9a8810a079b81ebe64b6124`.
- 34 positional groups, all model names resolved against the published vehicle IDE.
- Business repeats Elegant; this duplicate remains present.
- Casual rich contains 26 names and casual average 29. Native group storage admits 23 resolved names; ignored tails remain inspectable rather than silently disappearing.

Primary code evidence is pinned to gta-reversed
`0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [Population.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Population.cpp): `LoadGroup` / `LoadCarGroups`. The unified loader is marked NOTSA; its documented native capacity behavior is the basis for preparation, not proof of byte-identical original executable parsing.
- [PopCycle.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PopCycle.h): 34 group IDs; current percentages depend on time index, weekday/weekend and zone PopType.
- [LoadedCarGroup.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/LoadedCarGroup.cpp): weighted selection with at most ten trials. Normal-only choices include normal, poor-family, rich-family and motorbike classes. Suppressed, script-blocked, phasing-out or excessive-reference choices consume attempts rather than being removed from the weight sum.
- [Streaming.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Streaming.cpp): loaded cars are classified using `IsCarModelNeededInCurrentZone`, population percentages and gang state.

`pickNativeLoadedCar` implements the active-member selection path with explicit
caller-owned loaded membership, native frequency/refcount state, script flags
and integer random draws. Its `frequency >= remainingWeight` comparison keeps
the source boundary bias, including a possible leading zero-frequency choice.
The empty/class-excluded paths do not consume random numbers. Zero-total-weight
input is rejected because the native integer-range call has no valid range.
The function does not recreate the source's unused-slot path when
`normalOnly=false`; callers supply active members only.

This prepares the source pipeline for the **742 random-model IPL generators**.
It does not enable them yet: the runtime still lacks native zone PopType,
time-dependent population selection, appropriate loaded-model membership and
script/population ownership. Supplying a uniform pool of supported cars or a
Grove-only guessed group would change the intended behavior. Existing fixed
car spawns remain playable; random cars and traffic remain incomplete.

## Population cycle resource

The original [POPCYCLE.DAT](https://z.noclip.website/GrandTheftAutoSanAndreas/data/popcycle.dat)
is now imported through the same static catalog: 127,108 bytes, SHA-256
`7adf28ff336d652a0d85cd8c9cb37379755e7f68a00b3637ea4afc4d4184aac7`.
It contains 480 rows: 20 zone population types × 2 weekly schedules × 12 two-hour
periods. Each row stores 24 byte values: ped/car limits, dealer/gang/cop/other
percentages and 18 civilian group weights. Raw values and source line numbers
are retained independently of prepared values.

The pinned [PopCycle.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PopCycle.cpp)
non-`FIX_BUGS` initialization rescales only group totals below 100, using integer
truncation. Fifteen source rows require rescaling; eleven still total below 100
afterward. Totals above 100 remain unchanged. This follows the inspected
reverse-engineered implementation; its comments discuss differences and fixes,
so it is not a claim of independently established retail binary parity.

Time lookup follows `CPopCycle::Update`: native days 0 and 7 use the Sunday
schedule; Monday uses the weekend schedule until 20:00; Saturday uses the weekday
schedule until 20:00; Tuesday through Friday use the weekday schedule. The
hour index is integer hours divided by two. Day 0 is accepted because the source
handles it; its calendar meaning is uncertain in the source comment.

The vehicle catalog exposes civilian car-group membership for explicit zone
population type, day and hour. For example, Buffalo belongs to the business
area's active groups at weekday midnight and not at 08:00. This is membership,
not a loaded-car pool or a probability distribution. Gang/cheat overrides,
spatial zone PopType assignment and model streaming still need integration
before random parked-car spawning is enabled.
