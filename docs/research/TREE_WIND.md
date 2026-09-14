# Native tree and palm wind

Implemented against gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [CEntity::ModifyMatrixForTreeInWind and PreRender](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Entity.cpp), address `0x534E90`.
- [IDE flags](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Enums/eItemDefinitionFlags.h) and [atomic special-type assignment](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Models/AtomicModelInfo.cpp).

IDE tree is `0x2000`, palm is `0x4000`. These differ from the model-info special-type representation. Palm overrides tree; later unknown, tag and breakable-statue assignments override both. Damageable `0x1000` does not select palm. The actual packaged bushes with flags 8324 and Joshua tree with flags 12420 therefore select tree behavior.

The pure evaluator requires a wrapped uint32 timer, uint16 entity seed, uint32 entity address and native world X/Y wind direction. Strong wind shares PlantMgr's table and unusual added-one term. Calm wind uses the low 12 bits of address plus timer, with multiply-based float32 arithmetic that differs from grass's division-based formula. Palms add the weather-dependent lean. Direction is not normalized.

The procedural render adapter replaces X/Y in the native modelling matrix's at column before converting to Three.js coordinates. It preserves Z, other columns, origin, collision matrices and registry records. Paused, hidden and exploded object entities retain their pose. Repeated updates do not accumulate deformation. This is a visual shear, not rigid-body rotation or mesh displacement.

Validation: 432 independently compiled C++ reference cases cover both types, wind thresholds, timer wrap, seed endpoints and address wrap; adapter tests cover scaled visuals, collision ray hits, unchanged collision-source matrices, pause, visibility, explosion and disposed ownership.

## Remaining integration work

This is an explicit-input adapter, **not yet called by the walking scene**. The current walking scene supplies a documented calm grass policy; it has no verified native weather wind direction or entity-address policy. Substituting a procedural slot for a native entity address would manufacture phase accuracy. The placement manager now consumes and retains the native constructor seed before transform sampling, as detailed below. This does not reconstruct original memory addresses or weather evolution.

Local helicopter wind modifiers are not evaluated here. The source adds their result after directional sway. Static IPL tree rendering also needs its own PreRender integration. Original-platform matrix precision, retail screenshots and weather evolution remain unverified. Do not describe this change as completed vegetation animation or pixel parity.

## Constructor seed ordering correction

[Building construction](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Building.cpp) and [object construction](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Object/Object.cpp) both call CEntity, whose constructor draws `m_nRandomSeed`. [AddObject](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Plant/ProcSurfaceInfo.cpp) constructs the entity before its four transform samples. Inspected CPhysical and CObject initialization add no further random draws on these vegetation paths.

The manager previously omitted this constructor draw. It now draws one raw CRT output after successful allocation and before XY scale, Z scale, rotation and height offset. Installation receives the seed and exposes it with the procedural instance diagnostics. Pool-cap rejection and null allocation consume neither the constructor seed nor transform samples. Existing AddObjects reseeding semantics are preserved.

An independent compiled C++ trace verifies the first two placements and their transforms, seeds, and the changed second placement after a failed first allocation. Both building and object paths are tested. Because fractional density acceptance also occurs later in the RNG stream, the fixed Verdant content audit changes from 149 entities / 16 temporary objects to 140 / 12, retaining 63 triangles and 23 alignment matrices. Those counts describe this fixture and camera, not a matched retail capture. This corrects the earlier audit baseline rather than adding a density adjustment.
