# Character feet and authored street collision

The clothed native Fat-body gameplay probe exposed shoes disappearing into the street at idle. The source FatIdle pose places the lowest sneaker vertex approximately 1.02192 units below the player entity origin, so the existing one-unit native entity offset alone was not the main discrepancy.

Two independent environment/controller errors compounded it:

- The turning-head road rendered at Y=0.02 while its underlying flat collision floor was at Y=-0.05. Other road layers also had no matching surface collider.
- The standing capsule extended 0.55 + 0.3 = 0.85 units below its center, but the simulation reported feet 0.9 units below that center. Crouching had the same 0.05-unit mismatch (0.3 + 0.3 versus 0.65). The 0.025 controller separation offset did not cancel these errors.

`STREET_SURFACES` now provides one set of rectangle/circle extents and elevations for both rendering and Rapier collision. Physics uses matching upward-facing triangle surfaces, including the same 64-segment circle outlines as the renderer. Asphalt/concrete layering heights remain intact. Grass rendering and the underlying heightfield both use the shared ground elevation, -0.04. Imported native scenes do not receive these authored street surfaces.

The standing capsule half-cylinder is now 0.6 plus its 0.3 radius, matching the 0.9 foot-to-center convention. Crouching uses 0.35 plus 0.3, matching 0.65. Creation, stance switching, exit-clearance queries and reset all use the corrected dimensions. This changes standing clearance from 1.7 to 1.8 units and crouched clearance from 1.2 to 1.3; it is a controller geometry correction, not a model-specific visual offset.

The native CJ idle capture now shows the sneaker soles at the visible road surface. No change was made to the source animation, model scale, native one-unit entity offset or skin geometry. Exact foot planting over varying terrain, slopes and other animations remains separate work. The demonstrated scene is the authored neighborhood, not the imported San Andreas world.

Tests check upward triangle winding, collider/render elevations, grounded foot position and capsule-center consistency. The overhang fixture now explicitly supplies 1.4 units of clearance for the 1.3-unit crouched capsule; the porch check derives expected foot height from the actual porch top plus controller separation. All 618 tests in 132 files pass. The build and native-player gameplay browser check pass. Logs: `/tmp/web-gta-ground-alignment-{unit-final,build,browser,regression}.log`. Updated capture: `artifacts/native-cj-fat-idle.png`.
