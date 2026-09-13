# Implementation plan

This plan implements the [design](DESIGN.md). All gates below are future acceptance criteria. No game, benchmark, importer or runtime test has been implemented yet.

## Decisions to carry into implementation

| Decision | Initial choice | Revisit only when |
|---|---|---|
| Product | Desktop-first, local single-player, static HTTPS distribution | Target platforms or multiplayer scope change |
| Reference | Provisional original PS2-era presentation; separately labeled PC keyboard preset | A specific reference release is selected |
| Runtime | TypeScript + Vite + Three.js WebGLRenderer | A measured candidate provides materially better results |
| Physics | Rapier behind a game-specific adapter | Representative handling tests expose an unresolvable limitation |
| Art contract | GLB/glTF, KTX2 where suitable, stable metadata and interaction anchors | A measured format constraint demands another representation |
| Content | Authored/licensed pack; optional separate local importer | Compatible original files and a defined source build are available |
| Execution | Main-thread fixed simulation; decode/import workers | Profile shows simulation is the main-thread bottleneck |
| Saves | IndexedDB transactions, export/import, previous-good revision | Requirements exceed local single-player persistence |
| Offline | Verified, versioned downloadable content packs | Never imply full offline access from a partial cache |

Select and pin dependency versions during the first executable spike. Commit a lockfile and record browser, OS and GPU versions with performance captures. Do not pin versions from an old tutorial or assume every new renderer release is compatible with custom materials.

## Planned repository boundaries

```text
src/
  app/                 boot, lifecycle, capability checks, composition
  input/               actions, device mappings, contexts, focus handling
  simulation/
    entities/          IDs, components, lifetime and ownership
    character/         locomotion and authoritative action phases
    vehicles/          handling, seats, doors, damage and control transfer
    population/        pedestrians, traffic, gangs and activation tiers
    police/            incidents, escalation and response rules
    combat/            weapons, targeting, damage and hit queries
    missions/          graph executor, reservations, events and rewards
    progression/       stats, economy, inventory and world changes
  physics/             Rapier integration and collision-query adapter
  world/               cells, road graph, nav tiles and residency
  content/             manifests, providers, validation and cache indexing
  render/              Three.js objects, materials, animation, camera, FX
  audio/               buses, emitters, station timeline and playback
  persistence/         save schema, migrations, transactions, export/import
  ui/                  HUD, radar, pause, map and settings
  workers/             decode/import; optional simulation worker
  diagnostics/         recording, perf markers and local debug controls
  service-worker/      static cache, staged updates and offline manifest
tools/
  content-build/       authoring exports, validation, LOD and packing
  world-build/         road/navmesh/collision processing
  reference/           capture catalog and comparison calculations
content-src/           authored source definitions; large DCC files as appropriate
public/content/        generated distributable packs only
tests/
  scenarios/           seeded gameplay and streaming fixtures
  reference/           approved capture metadata and permitted reference files
docs/                  decisions, research and production records
```

This is a proposed structure, not a scaffold already created. Runtime rules must not import renderer objects. The simulation-to-render adapter resolves asset IDs and entity snapshots into visual instances. Diagnostics must be removable from the normal HUD.

## Minimum data contracts

These sketches establish ownership and units. They are not complete types or executable implementations.

```ts
type EntityId = { index: number; generation: number };
type AssetId = string;
type Vec3 = readonly [number, number, number];

interface InputFrame {
  sequence: number;
  tick: number;
  context: 'foot' | 'vehicle' | 'menu' | 'cinematic';
  move: readonly [number, number]; // normalized action-space input
  lookDelta: readonly [number, number];
  held: number;                   // action bitmask
  pressed: number;                // consume once, even during catch-up
  released: number;
}

interface AssetRecord {
  id: AssetId;
  hash: string;
  sourceId: string;
  distribution: 'bundled' | 'local-only';
  permissionRecord: string;
  boundsMeters: { min: Vec3; max: Vec3 };
  resources: { path: string; hash: string; bytes: number }[];
  lods: { resource: string; geometricErrorMeters: number }[];
  collision?: AssetId;
  estimatedCpuBytes: number;
  estimatedGpuBytes: number;
  anchors?: Record<string, { positionMeters: Vec3; rotation: Vec3 }>;
}

interface WorldCell {
  id: string;
  boundsMeters: { min: Vec3; max: Vec3 };
  dependencyIds: AssetId[];
  renderClusters: AssetId[];
  collision: AssetId[];
  navTiles: AssetId[];
  roadGraph: AssetId;
  populationProfile: string;
  ambienceProfile: string;
  persistentSpawnIds: string[];
}

interface ContentProvider {
  getManifest(): Promise<ContentManifest>;
  readRange(resource: string, offset: number, length: number,
            signal?: AbortSignal): Promise<ArrayBuffer>;
  // An implementation may read a full small chunk if HTTP ranges are unavailable.
  hasLocalResource(resource: string): Promise<boolean>;
}

interface SaveEnvelope {
  schemaVersion: number;
  engineBuild: string;
  packId: string;
  packVersion: string;
  manifestHash: string;
  slotId: string;
  revision: number;
  simulationTick: number;
  savedAt: string;                // metadata, not gameplay time
  state: SerializableGameState;
  integrityHash: string;
}
```

Use explicit coordinate and rotation conventions; the final schema should distinguish Euler metadata from quaternion runtime transforms. Runtime physics uses meters/seconds and radians. If source data uses other conventions, preserve source values separately and convert through one tested adapter. `ContentManifest` and `SerializableGameState` are deliberate domain contracts to finish in the first spike.

Cells follow `absent → fetching → decoded → collision-ready → active → retiring`. Failure and cancellation are explicit states. Activation is atomic with respect to gameplay: a rendered road alone is not an active traversable sector. Shared resources are reference-counted across cells, vehicles and missions.

Worker snapshots contain sequence/tick, entity generation, transform, velocity, animation/action phase and compact visual state. Spawn/despawn, damage, dialogue and objective changes use ordered events with acknowledgements; dropped transform snapshots must not drop a gunshot or mission reward. Buffer transfer relinquishes ownership, so use a bounded reuse pool and never write into a transferred buffer. If the worker falls behind, preserve bounded interpolation and use an explicit pause/recovery path rather than extrapolate collisions indefinitely.

## First work packages

### A. Reference specification and asset feasibility

Deliver a reference manifest with platform, build, capture conditions and evidence IDs. Select one street block, one protagonist sample, one bicycle and two car classes. Record a short baseline suite: straight movement, turning, jump, camera recenter, entry/exit, acceleration, braking and a corner. Keep unknown fields marked unknown.

For authored content, produce one fully dressed block and rig sample. For imported content, prove a supported source build through geometry, texture, collision and animation conversion. Inspect day/night colors and transparent foliage. A generic model viewer is an intermediate deliverable; the gate requires the assets to work with their gameplay anchors.

**Exit:** one coherent reference, valid asset manifest, correct scale and orientation, reproducible sample conversion or export, and documented gaps. If original files are unavailable, continue with the authored pack and retain the import interface.

### B. Executable runtime and measurement fixture

Build the boot flow, capability screen, action mapping, fixed-step loop, renderer/physics adapters and local diagnostic recorder. Add a calibration course with flat road, slopes, steps, walls, thin barriers and a simple junction. Expose controlled weather, time, camera poses and seeded spawning through development commands.

Record simulation time, frame intervals, physics work, draw calls, estimated resource allocations and asset readiness latency. Separate cold startup from warm traversal. Include pointer-lock and audio startup on a real user gesture.

**Exit:** the scene boots on named desktop browsers, input survives pause/focus changes, and the same action recording produces comparable within-build trajectories at different render rates.

### C. Character and camera calibration

Integrate the approved rig and locomotion transitions. Build foot/camera controls, safe capsule movement, basic climbing, collision-aware camera and authoritative animation events. Add seated and entry/exit actions before multiplying character outfits or vehicle models.

**Exit:** reference walk/run/jump/camera scenarios reviewed side by side; curbs and corners work; no recurrent foot sliding or pose/physics separation in the approved actions. A menu opening cannot leave movement or camera input active.

### D. Vehicle calibration

Implement one ordinary car, one contrasting class and a bicycle. Add vehicle parameters, seat reservation, door state, occupant interruption, safe exit, collision response, camera and engine/tire audio. Instrument speed, braking, turning and suspension trials.

**Exit:** acceleration and braking curves are measured against the reference, class differences are convincing, and the entry/drive/exit loop survives interruption. Test blocked doors, moving exits, overturned cars and simultaneous seat requests. Retain an explicit mismatch list before adding more vehicles.

### E. Living streamed district

Build the first connected district with road graph, collision, nav tiles, shared resources, LODs and sector pinning. Add traffic, pedestrian schedules, simple reactions, time/weather and regional sound. Implement near/far population promotion and stable entity identity.

**Exit:** a ten-minute repeated route does not grow resource counts monotonically; delayed cells never create missing ground; rapid reversals and intersections preload correctly. Record a fixture near the proposed 24-active-car/48-visible-pedestrian workload on actual hardware.

### F. Combat, police, missions and persistence

Add the initial weapons, damage and police escalation scenarios. Build three mission graphs, one shop, garage/safehouse, meaningful progression and transactional saves. Integrate mission reservations, cinematics, death/arrest, retries and reward deduplication.

**Exit:** complete all missions and explicitly exercise their failure branches; save/load reproduces progression and critical actors; interrupted saves retain the previous good revision. Combat and police tuning carry reference evidence or clearly labeled deviations.

### G. Delivery, offline and quality pass

Ship a static build fixture with hashed content, correct MIME types, staged updates and downloadable offline pack. Test denied storage, interrupted downloads, offline restart, outdated saves, context loss and a gamepad disconnect. Add graphics tiers without changing core rules.

**Exit:** a player can begin, play the full slice, save, close, reopen and continue offline after a verified download. Submit gameplay video, representative screenshots, performance captures and a remaining-issues list. Only then estimate expansion.

## Acceptance scenarios

| ID | Scenario | Required invariant or evidence |
|---|---|---|
| REF-01 | Walk/sprint fixed route at fixed stats | Travel time, stop distance, pose and camera measurements |
| REF-02 | Brake a named vehicle from matched speed | Distance and speed curve, with surface and condition logged |
| REF-03 | Drive a constant-input corner | Radius, yaw response, lean and camera compared |
| INT-01 | Interrupt entry while seat is reserved | No duplicate occupant, frozen controls or stale reservation |
| INT-02 | Exit beside a wall or at speed | Valid capsule position and defined velocity transfer |
| COM-01 | Aim past an obstacle beside the muzzle | Nearby wall blocks the shot correctly |
| AI-01 | Promote a moving traffic car into physics | No teleport, speed jump or route loss |
| POL-01 | Repeat a low-level incident | Tier, response timing and clearing behavior measured |
| STR-01 | Delay the next road cell during fast driving | Player never enters missing collision |
| STR-02 | Reverse direction through the same sectors | Shared assets survive until last reference is released |
| MIS-01 | Skip a cutscene and retry after failure | Same final cinematic state; complete cleanup on retry |
| MIS-02 | Replay a completion event after save/reload | One reward and one progression transition |
| SAV-01 | Interrupt a save transaction | Current or previous valid revision loads; no partial state |
| SAV-02 | Import corrupt or incompatible save | Original slot preserved; comprehensible failure message |
| OFF-01 | Boot offline with incomplete pack | Availability accurately reported; no false full-world promise |
| UPD-01 | Release update during a running mission | Active build/content remain consistent until safe activation |
| LIFE-01 | Hide tab, unlock pointer, disconnect gamepad | Simulation/input follow defined pause and resume policy |
| GPU-01 | Lose and restore WebGL context | Rebuilt presentation or explicit safe checkpoint recovery |
| PERF-01 | Repeat a dense route for 20–30 minutes | Frame distributions, memory plateau and sustained behavior |

Browser automation should exercise real inputs for player-facing acceptance. Deterministic simulation commands are useful for setting up fixtures, not as a replacement for testing input and camera integration. Headless software-renderer measurements do not establish real GPU performance.

## Expansion policy

Keep the full-state geographic plan visible, but build through accepted neighborhoods and mission families. Add one new vehicle/locomotion family at a time because each creates new animation, camera, AI, physics, streaming and mission dependencies. Test flight-specific residency before releasing aircraft. Track content coverage by concrete entries, not by an unsupported overall percentage.

At the end of the slice, retain a decision record for renderer, physics, worker placement, cell dimensions, cache structure and asset strategy. Reopen a decision only with a demonstrated defect, changed requirement, or measured performance limit. This keeps production effort focused on fidelity and content.
