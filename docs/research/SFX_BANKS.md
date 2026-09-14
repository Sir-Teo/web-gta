# Native PC sound-effect bank reader

`src/assets/sfx.ts` provides local readers for `BankLkup.dat`, `PakFiles.dat`
and individual PC SFX banks. It does not yet replace the shipped sound clips or
provide an audio import UI. The next integration requires an independently
inspected FEET package and its matching configuration files.

## Inspect a local audio installation

From the repository root:

```sh
node scripts/content/audit-sfx.mjs /absolute/game-root /absolute/new-report.json
```

The command expects `audio/CONFIG/BankLkup.dat`, `audio/CONFIG/PakFiles.dat`
and the package names listed by that configuration under `audio/SFX/`. Default
bank IDs are 0 through 6, covering the native footstep bank enum. Optional numeric
arguments select specific global bank IDs, for example `0 4 6`. Bank IDs are
resolved through the lookup's package index, not assumed to belong to GENRL or
to the first package. Exact filename case is required on case-sensitive systems.

The report records lookup hashes, package names/sizes, bank offsets, sound IDs,
PCM hashes, source sample rates, durations, signed headroom, raw loop metadata,
peak and RMS. It contains metadata only. Package reads use file-backed Blobs and
bounded bank slices. The report path must be new: existing reports are never
replaced. The command does not download content, install audio or export WAVs.

Validation: five SFX reader tests and `node --test
scripts/content/audit-sfx.test.mjs` pass; the production build passes. The command
test creates two generated packages with reordered lookup indices and nonzero
bank offsets, checks known PCM measurements, and verifies existing report
preservation. Generated data is explicitly a format/command fixture, not a
substitute for original-package validation. No retail audio has been audited yet.

## Source-backed layout

The pinned [AEBankLoader.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/Loaders/AEBankLoader.h)
defines these structures:

- Bank lookup: 12 bytes, package index at 0, file offset at 4, PCM data size at 8.
- Package lookup: 52 bytes, a 12-byte base filename followed by platform metadata.
- Bank header: 4 bytes for count/padding, then 400 descriptors of 12 bytes each.
- Sound descriptor: bank-relative byte offset, raw loop-start field, unsigned
  16-bit frequency and signed 16-bit headroom.

[AEMP3BankLoader.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/Loaders/AEMP3BankLoader.cpp)
divides the file offset by the streaming-sector size for I/O; the lookup offset
itself is in bytes. `GetSoundBuffer` derives each sound's extent from the next
descriptor, or the lookup's PCM size for the final sound. That size excludes the
4,804-byte header. The reader mirrors these boundaries and preserves raw loop
metadata rather than assuming its unit or interpreting its sentinel prematurely.

[AEAudioHardware.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/Hardware/AEAudioHardware.cpp)
creates static channels with 16-bit samples; AEAudioChannel initializes them as
mono. `sfxPcmSamples` converts signed little-endian PCM16 to Float32 using 32768
as the divisor. It preserves the source sample rate separately for playback.

The [sound bank enum](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/Enums/eSoundBank.h)
assigns banks 0–6 to generic, grass, gravel, metal, sand, tile and wood. The
[footstep and landing handlers](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/Entities/AEPedAudioEntity.cpp)
use different sample selection rules. Dedicated landing events use generic
sample 0 or 6 outside water; they are not interchangeable with randomly selected
ordinary footsteps. The project's current landing-contact sounds remain an
approximation. `DoFootLanded` is not reversed in the pinned source, and the
experimental PlayFootSteps body is bypassed by its original-function call.

## Validation and boundaries

Four format tests cover byte-offset package slicing, subarray lookup decoding,
record padding, two distinct sound rates, signed headroom, loop metadata, exact
PCM extrema, independent sample ownership, invalid filenames, truncated headers,
excessive counts, reversed/odd offsets and zero rates. The production build passes.
Bank extraction is bounded to 64 MiB of PCM per selected bank and uses Blob.slice;
it does not read a whole SFX package into memory. This reader targets PC PCM SFX,
not PS2 sound formats or encrypted radio streams.

No original audio-package validation or listening comparison has been performed.
On 2026-09-14 the public Noclip host returned HTTP 404 for the tested
`audio/CONFIG/BankLkup.dat`, `audio/SFX/GENRL` and `audio/SFX/FEET` paths.
That is an availability result for those exact paths, not proof that no public
sound resources exist. A separate public
[audio-editor implementation](https://github.com/MadGamerHD/GTA-SA-Audio-Editor)
documents the same basic PC bank layout, but has not been executed here.
