# Static IPL entity lighting

The published Grove Street package contains 238 serialized atomics: 234 request generic lighting without normals, three request it with normals, and one has lighting disabled. None declares one of the two custom building pipeline IDs currently recognized by the importer. Previously, placed models only received the specialized building-lighting adapter. Their generic path remained unlit, despite the geometry lighting flag.

The native scene owner now enables generic vertex lighting for placed models and supplies the native object ambient channel separately from the building ambient channel. The existing geometry lighting flag still controls material selection, and absent native normals suppress diffuse illumination. The specialized building material retains its own path. Inspection previews do not opt into these scene-lighting options.

## Entity classification

At gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`, [CFileLoader::LoadObjectInstance](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp) creates buildings when no object-data entry exists and dummy objects when one does. [CDummy](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Dummy/Dummy.h) inherits the base entity lighting implementation. Static dummies therefore do not use the CPhysical contact-brightness formula merely because their model appears in object.dat.

[CEntity::SetupLighting](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Entity.cpp) multiplies generated lighting by 0.5 before setting ambient and directional light colors. The browser uses an explicit neutral generated-light factor of 1 until that unreversed routine is implemented. Consequently, placed generic lighting uses half the object ambient channel, scaled by the existing sun multiplier, and a 0.5 directional multiplier. Existing scene replacement retains these inputs. Invalid object ambient values fail before changing the generic lighting uniforms.

## Evidence and remaining scope

A GPU test loads the actual packaged `carlshou1_lae2` model through the native scene owner and verifies that native ambient changes rendered pixels without changing collider ownership. Unit tests verify material selection, scaling, dummy classification, invalid-input retention, scene replacement and fallback restoration. Browser regressions cover both published areas and specialized building alpha behavior.

This does not implement dummy-to-physical-object promotion, contact updates for promoted objects, native generated point lights, brightness-slider additions, scorched objects, or missing custom pipeline attachment rules. The serialized pipeline audit describes the importer inputs; it is not proof of every pipeline the retail loader may attach. Generic vertex precision and matched original-game screenshots remain unverified. See [generic vertex lighting](GENERIC_VERTEX_LIGHTING.md) and [procedural entity lighting](PROCEDURAL_LIGHTING.md) for shared renderer limits.
