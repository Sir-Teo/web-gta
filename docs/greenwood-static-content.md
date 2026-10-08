# Greenwood static content

`public/play/vehicles/greenwood/` contains unchanged native DFF, TXD, IDE,
HANDLING and CARCOLS resources from the same inspected Noclip dataset used for
the included world areas. The manifest records each resource's byte length,
SHA-256 and upstream provenance. Public availability does not certify a retail
version or establish redistribution rights.

Rebuild from the verified local depot:

```sh
GTA_PUBLISH_VEHICLE=1 GTA_CONTENT_DIR=/absolute/content-depot npx vitest run tests/build-pages-vehicle.test.ts --maxWorkers=2
```

The builder verifies the complete source IMG against the world source lock and
all supplemental files against the vehicle source lock before publishing. It
extracts `greenwoo.dff` and `greenwoo.txd` using the production IMG parser.

`loadIncludedGreenwood(baseUrl, variation, signal)` downloads same-host files,
checks bounded lengths and SHA-256, and resolves a `NativeCarAssets` assembly.
The base URL must end in `/`; callers use the Vite base path for project Pages
hosting. No content depot, backend, conversion service or upstream asset host
is needed by the browser. The eight source paint combinations are available
through an explicit variation index (traffic cars choose theirs with
ChooseVehicleColour, `src/vehicle/nativeVehicleColours.ts`). Handling index 68 is the native VT_GREENWOOD enum, independent of
vehicle model ID 492.

Validation: `tests/browser/included-greenwood.spec.ts` loads the shipped files
without a depot, installs and renders the production car assembly, checks all
12 textures and 20 collision shapes, verifies disposal, and rejects a changed
DFF. The game loads this bundle as it starts and places the drivable Greenwood
near the spawn (`src/main.ts`); world placement, entry and driving are the
ordinary car's.
