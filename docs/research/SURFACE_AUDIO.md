# Native surface audio

The public [surfaud.dat](https://z.noclip.website/GrandTheftAutoSanAndreas/data/surfaud.dat)
was downloaded and parsed on 2026-09-14. It has 6,530 bytes and SHA-256
`5a25dfb38743e42b46f7979941f9fa8a1201788e91f991975dfed997aa4db605`.
All 179 rows resolve to distinct known native surface IDs. The acquisition lock
now includes this resource; the external depot passes 114 file checks. This
establishes the inspected public dataset, not certified retail byte identity.

The pinned [SurfaceInfos_c::LoadSurfaceAudioInfos](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/SurfaceInfos_c.cpp)
reads a name and nine signed integer flags, converts nonzero values to booleans,
and applies rows in order. `readSurfaceAudio` retains that conversion and reports
unknown-name DEFAULT aliases and duplicate overrides. The game loader rejects
these warnings rather than silently accepting a modified ambiguous table.
Malformed rows and oversized files fail before installation.

[CAEPedAudioEntity::HandleFootstepEvent](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/Entities/AEPedAudioEntity.cpp)
selects water, concrete, grass/long grass, sand, gravel, wood, tile, then metal;
otherwise it uses generic footsteps. `nativeFootstepCategory` follows that
precedence for the contact surface. Forced water surface overrides, native sound
bank availability and random sample selection are not implemented here.

The content-folder importer sends the exact root `surfaud.dat` File with optional
environment files. Gameplay parses it locally before scene installation. Its
existing bounded ground probe now returns the COL material as well as lighting;
mesh hits retain their original per-triangle material index. The fixed-step audio
call uses this contact's category for the player, for cadence and landing-contact
sounds. Imported scenes no longer classify grass from placeholder-world XY
coordinates. Unknown contacts and missing tables use the generic concrete sample,
with no extra ray through an intervening unknown collider. The game already
rejects that collider as an unresolved support source.

Only the existing concrete and grass recordings are shipped. Grass/long-grass
categories choose grass; the other categories currently use the generic recording.
Their separate identities remain available in the table for future banks. This
is a material-selection improvement, not authentic GTA audio playback. Native
contact selection itself, water interactions, original audio banks, landing-event
bank distinctions and pedestrian audio behavior remain incomplete.

Validation: all 663 unit tests in 138 files, both native-player browser cases,
build and production smoke pass. Tests cover flag conversion, category precedence,
unknown/duplicate rows, malformed input, the acquired 179-row table, optional File
handoff, material selection on boxes and separate mesh triangles, and normal and
landing sounds overriding authored geography. The normal-CJ browser case confirms
the surface table reaches the running imported Grove Street session. No audio
listening comparison against retail was performed. Logs:
`/tmp/web-gta-surface-audio-{unit,browser,production}.log`.
