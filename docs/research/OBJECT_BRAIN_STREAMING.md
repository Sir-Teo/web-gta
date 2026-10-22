# Object identity across streamed scene windows

`ScmMission.processObjectBrains` adopts map placements as script objects. It keeps an
adopted object while the object or its map origin remains within 80 native units of
CJ, and reapplies map suppression when a streamed window supplies the map copy again.
The implementation cites the iOS object-brain routines at `0x1001f4f10`,
`0x1001f5000`, `0x1001f57d0`, and object management at `0x100369b40`.

The host key identifies that map entity throughout its lifetime. Previously,
`modelPlacementsNear` included the placement's current array index in its key, and
the take/hide setters parsed that index back out. A window replacement can reorder
the arrays: the brain controller could adopt the same entity twice, and an old key
could hide or disable another placement.

The scene API now uses the placement catalog's immutable source key:
`[dataset, lowercase IPL source name, text/binary format, source index]`.
Window-local part indices and source namespaces are excluded. Setters resolve the
key through the current catalog, including before the first placement query. Keys
for absent entities or disposed scenes fail without changing another entity.
Attractor effects share this placement key, with their existing effect suffix.
Garage doors and cutscene visibility also consume these opaque placement keys.

Scenes without source provenance use the exact lowercase model, model ID, interior,
position and rotation as a fallback identity. This preserves identity across array
reordering and distinguishes placements on different floors. Identical coincident
placements require source provenance to distinguish them; the fallback does not
invent a persistent identifier for such duplicates. Runtime keys are opaque and
are not a save-file format.

Two scene regressions cover retained and removed sources, namespace changes,
collision and visual isolation, resolution before querying, disposal, and reordered
uncatalogued placements. The existing attractor reindexing regression remains in
the same suite. This change repairs the host's entity identity; it does not change
the native brain chance, activation radius, lifetime, or opcode classification.

Validation on October 22, 2026: all 3,673 unit tests pass (51 skipped), the build
passes, and the normal bar-entry browser reaches wager, aim, shooting, back and
quit with the retained table and opponent. Historical mission sweep bytes are
unchanged.
