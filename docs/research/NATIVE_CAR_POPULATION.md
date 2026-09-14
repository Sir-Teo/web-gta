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
