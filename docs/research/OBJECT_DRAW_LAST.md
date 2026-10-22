# Script object draw order

`SET_OBJECT_DRAW_LAST` (0418) now moves script objects and adopted map placements into the later,
distance-sorted render pass. POOL2 (mission 8) sets it at SCM 375146 and 375174 on object local 238.

## Native evidence

The pinned executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1001e0970` sets/clears bit 14 of CEntity's flags at +0x28 for a nonzero/zero operand.
It changes no position, collision or physical movement flags.

The pinned reversed CRenderer::AddEntityToRenderList (`0x5534B0`, Renderer.cpp) inserts bDrawLast
entities into CVisibilityPlugins::InsertEntityIntoSortedList. That sorts into the alpha-entity list
by distance (with separate special-model/underwater paths). RenderEntity (`0x732B40`) uses alpha
reference 100 for a non-fading exterior object, or zero in an interior or for a no-Z-write model.
Fading uses zero; the model's no-Z-write flag controls depth writing. Clearing bDrawLast restores
the ordinary render-list path. Changing only a numeric renderOrder while leaving the material in
Three's opaque pass cannot reproduce this later pass.

## Integration and checks

The existing placement render policy now accepts runtime draw-last overrides. It rebuilds the
placement's material selection using the same native flag-dependent alpha/depth policy, retaining
distance, fade state, per-material alpha and scorched lighting. Shared geometry, source materials,
textures and neighboring placements remain untouched; superseded private copies are disposed.
A false override can clear a model's default draw-last flag. Adopted placement overrides, including
false, are retained across streamed windows.

ScriptObjectViews creates the policy when the command first overrides an object, follows the camera
distance, and composes it with fading and scorched lighting. The collision body is retained.

The command stays **authored**: the browser uses Three's later per-mesh pass, rather than the native
shared entity-list capacity, whole-entity callback ordering and special underwater/really-draw-last
lists. Existing material/pipeline coverage limits also remain. Full POOL2 completion is unverified.

Four new unit checks cover both original instructions, adopted-host forwarding, state preservation,
model-default clearing, sibling ownership and a real installed map's placements. Browser draw-call
ordering verifies the flagged object follows an opaque peer even when that peer has a higher numeric
renderOrder. Pixel checks verify the exterior threshold changes from 140 to 100 and restores when
cleared. The live POOL2 check exercises both original instructions, fixed collision identity, fading
and scorched-state composition. Both existing scorched-lighting browser checks pass separately.
