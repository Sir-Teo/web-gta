# Procedural entity lighting

The eight models in the published Verdant package have no serialized custom pipeline ID. Their geometry flags are `0x1002f`: lighting and prelight are enabled, normals are absent. The procedural adapter previously supplied only building-pipeline lighting; these generic atomics therefore used an unlit material and ignored native ambient light.

The adapter now enables the existing generic native material path. It receives the native object ambient channel separately from the world ambient channel, with the same sun multiplier used by character lighting. Building-pipeline materials retain their separate shader. Scene replacement carries the object ambient inputs to the new owner.

## Source behavior

At gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [CEntity::SetupLighting](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Entity.cpp) uses half the generated-light factor for lit generic buildings. The browser currently chooses a neutral generated-light factor of 1, producing a multiplier of 0.5.
- [CObject::SetupLighting](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Object/Object.cpp) calls [CRenderer::SetupLightingForEntity](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Renderer.cpp). The multiplier is `0.95 * (world ambient mean + contact brightness) + 0.05`, before generated-light multiplication.
- [CPhysical construction](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Physical.cpp) initializes contact brightness to zero. The static procedural adapter follows that initial state. It does not substitute the triangle's lighting byte: the inspected AddObject receives that byte but does not use it.
- [SetLightColoursForPedsCarsAndObjects](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/app/app_light.cpp) scales directional and object ambient colors. The current browser path still omits the source brightness-slider addition, as does its existing character path.

[librw World::enumerateLights](https://github.com/aap/librw/blob/18532c2e13efbc1aa43f0b00b4459831f9414de0/src/world.cpp) includes ambient light without normals, but requires native normals for directional and local light enumeration. The model adapter now sets diffuse contribution to zero when the native geometry lacks the normals flag. Computed Three.js normals remain available for rendering needs but no longer invent directional illumination in the generic native lighting path. This reference is a RenderWare reimplementation, not proof of retail GPU parity.

## Verification and limits

Unit tests verify entity-kind factors, ambient channel scaling, material selection and absent-normal diffuse suppression. A GPU test loads the actual packaged shrub and checks that changing ambient changes its rendered pixels, while increasing directional intensity from zero to 20 does not. The walking test verifies visible procedural pixels, pause and collision ownership with this path enabled.

The pinned GenerateLightsAffectingObject function delegates to the executable; the neutral factor of 1 is an explicit browser policy, not a verified reconstruction of that routine. Generated point lights, scorched objects, physical contact-brightness updates after creation, brightness-slider additions, exact custom pipeline attachment rules and original-platform vertex-light precision remain incomplete. The existing generic material uses the project's current prelight/interpolation implementation; a matched retail screenshot comparison is still required. This change is an ambient-lighting correction, not a claim of pixel-identical vegetation.
