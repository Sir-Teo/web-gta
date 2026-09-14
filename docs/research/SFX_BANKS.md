# Native PC sound-effect bank reader

`src/assets/sfx.ts` provides local readers for `BankLkup.dat`, `PakFiles.dat`
and individual PC SFX banks. The local content-folder path can now install the footstep banks for gameplay,
as described below. The public FEET package and matching configuration files have now been inspected
as described below; gameplay playback integration remains unfinished.

## Reproduce the verified footstep content

Run from the repository root, with Node and `bsdtar` available:

```sh
node scripts/content/acquire-feet.mjs /absolute/content-depot
node scripts/content/acquire-feet.mjs /absolute/content-depot --verify-only
```

The acquisition command resolves the current download link from the recorded
MediaFire page, requests only bytes 0–4194303, and requires an exact HTTP 206
Content-Range response. A server returning the full archive is rejected before
its body is installed. Both the 4 MiB prefix and three extracted files must match
the recorded SHA-256 hashes. The verified prefix is cached at
`.source-cache/audio-prefix.rar`; reruns reuse valid files and repair only missing
or changed files. All needed members are extracted and checked before publication;
individual destination replacements use the existing atomic verified-file helper.
These audio files supplement the map depot acquired by `acquire-world.mjs`.

`--verify-only` checks all three audio files without network requests or writes;
the archive-prefix cache is not required. The normal acquisition also exits
without network requests when all three files already match. This is a separate
content-preparation command, not a runtime dependency or application backend.

Verified 2026-09-14: a fresh empty temporary directory successfully downloaded the
prefix, extracted all three members, passed offline verification and then passed
the independent SFX audit for seven banks and 38 sounds. Two automated acquisition
tests cover source-page limits, direct-link host validation, ignored/wrong ranges,
wrong payload hashes, correct range headers and preserving an existing file when
verification fails. Run `node --test scripts/content/feet-acquisition.test.mjs`.
Future source-page changes or changed archive bytes fail rather than silently
selecting a different fidelity baseline.

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
substitute for original-package validation. The initial command test used generated data; the subsequent public-package audit
is recorded below.

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

At the initial reader implementation, no original audio package was available.
The later acquisition below supersedes that availability limitation. No listening
comparison against retail gameplay has been performed.
On 2026-09-14 the public Noclip host returned HTTP 404 for the tested
`audio/CONFIG/BankLkup.dat`, `audio/SFX/GENRL` and `audio/SFX/FEET` paths.
That is an availability result for those exact paths, not proof that no public
sound resources exist. A separate public
[audio-editor implementation](https://github.com/MadGamerHD/GTA-SA-Audio-Editor)
documents the same basic PC bank layout, but has not been executed here.


## Verified public FEET package

On 2026-09-14, the archive linked by
[MixMods](https://www.mixmods.com.br/2012/07/pasta-audio-para-gta-sa-rip-steam-compactado/)
was available through its
[MediaFire page](https://www.mediafire.com/file/iyav6zf999dabu3/Pasta%20audio.rar/file).
The server honored a bytes 0–4194303 range request with HTTP 206 and reported a
2,996,059,339-byte full RAR. The opening 4 MiB contains complete CONFIG entries
and FEET before the larger GENRL entry. `bsdtar --fast-read` successfully extracted
only the three named files, without requiring the truncated remainder or radio
content. No archive programs were executed. Source paths and hashes are recorded
in `scripts/content/feet-sources.json`; the archive prefix hash also identifies
the exact inspected range. The temporary download URL is intentionally omitted
because MediaFire generates it per request.

| File | Bytes | SHA-256 |
|---|---:|---|
| BankLkup.dat | 8,520 | b89a66ddef4e5da74c4c13abb38a9aa7985397bee45b00e080da89f07a1eee50 |
| PakFiles.dat | 468 | 36bc8f4814d4ef4dc3b7c43ae5c26f0de1feeda1bc15cdf2250456d2927bc57c |
| FEET | 354,020 | 57eeebdf4205f6db6ff388f8b2099a60ce507ee07a5d8b3defad0383d55e31d0 |

All three files match both the XXH32 and XXH3 values in
[Shivelight's GTA SA 1.0 checksum list](https://gist.github.com/Shivelight/0087493603aafce6e0f4860e30264206).
This is independent community checksum corroboration, not a certified retail
comparison or a determination of redistribution rights.

The actual bank reader resolves 710 global lookup entries and nine package names.
Banks 0–6 occupy FEET contiguously with no leftover bytes:

| Bank | Category | Sounds | Source sample rates (Hz) |
|---:|---|---:|---|
| 0 | Generic | 9 | 15000, 16000, 17000 |
| 1 | Grass | 5 | 18000 |
| 2 | Gravel | 5 | 18000 |
| 3 | Metal | 5 | 16000 |
| 4 | Sand | 4 | 12000 |
| 5 | Tile | 5 | 8000 |
| 6 | Wood | 5 | 16000, 44100 |

All 38 PCM buffers parse, retain finite normalized samples and exactly account
for each bank's PCM byte extent. The local data lives under
`/Users/teo/Developer/web-gta-content/audio/`, including `sources.json` and
`feet-inspection.json`. No native sound bytes enter the repository or production
build. Six SFX tests pass with `GTA_CONTENT_DIR` set, including the new hash-locked
real-package test. This proves extraction against acquired content; it does not
yet verify rendered audio, headroom application, random variation or gameplay
sound-bank selection.


## Native footstep playback in imported scenes

The content-folder importer recognizes the exact three relative paths under
`audio/CONFIG/` and `audio/SFX/` and attaches them as one optional local File bundle.
`readNativeFootsteps` resolves banks 0–6 through their package indices, checks the
selected package name, enforces bounded file sizes and validates the required
sample counts and Web Audio-compatible rates. A complete successful load replaces
the previous banks atomically; a failed load preserves them. A generation check
prevents late asynchronous loads from installing after disposal or replacement.

`AudioSystem` creates mono AudioBuffers directly from decoded PCM16, using each
sound's original sample rate. Buffer creation is cached on demand after the
AudioContext exists, so importing before the first play gesture works. Playback
retains the existing spatial graph, voice limit, pause, mute and cleanup behavior.
The developer state exposes installed bank count and native shots started; those
counters do not measure audibility at the speakers.

Surface selection now passes the full native category into audio. Generic steps
select samples 1–5; grass, gravel, metal, tile and wood select 0–4; sand selects
0–3. This follows the pinned footstep handler's ranges using a random value for
each playback. Water currently uses the generic bank because the separate swimming
bank has not been acquired. Without native banks, the existing concrete/grass
recordings remain available. Native landing-contact notifications currently pass
through the ordinary footstep selection; dedicated landing-event sample 0/6,
original headroom/volume/pitch rules and the uncertain DoFootLanded caller remain
unfinished. This is original-recording playback, not complete native audio parity.

Validation: 672 unit tests in 140 files, both native-player browser checks, build
and production smoke pass. The normal-CJ browser case imports the real folder,
asserts seven banks installed and verifies native shots started while walking in
Grove Street. Format/range tests exercise all categories, the actual acquired
package, wrong-package rejection, truncation and invalid file bundles. Logs:
`/tmp/web-gta-native-footsteps-{unit,browser,build,production}.log`. No listening
comparison against retail gameplay was performed. Native audio remains external
to the repository and is never fetched by the production game.

## Native recording headroom

`nativeHeadroomGain` now applies the sound descriptor's signed hundredth-dB
headroom during native footstep playback. The pinned
[GetSoundHeadroom](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/Loaders/AEMP3BankLoader.cpp)
returns `Headroom / 100.0f`, and
[CAESound::CalculateVolume](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/AESound.cpp)
subtracts it before directional and distance attenuation. The Web Audio adapter
multiplies the existing event gain by `10 ** (-headroomDb / 20)`, using a float32
conversion for the source division. PCM samples remain unchanged. Positive
headroom attenuates; negative values increase the gain. Authored fallback clips
retain their previous levels.

The acquired generic walking clips specify 0.83–9.15 dB of headroom; tile clips
specify 13.89–18.34 dB. Ignoring those differences previously changed their relative
levels substantially. This correction covers the per-recording adjustment only.
The original event-volume table, total mixer attenuation, distance curves,
pedestrian movement-dependent gain/pitch and dedicated landing-event rules remain
unfinished, so the overall mix is not yet an original-game match.

The unit check covers unity, ±20 dB, attenuation, signed limits and invalid input.
The browser gameplay test intercepts source-to-gain connections and observes the
actual GainNode value when native source recordings start. It matches their sample
rate and PCM length to the acquired generic bank descriptors, then verifies the
applied headroom factor. This checks real audio-graph configuration, not subjective
loudness or hardware output.

Validation: 673 unit tests in 141 files, both native-player browser cases, build
and production smoke pass. Logs:
`/tmp/web-gta-native-headroom-{unit,browser,production}.log`.

## Inaudible one-shot lifecycle

The audio dispatcher now rejects one-shot requests before native sample selection
and PCM buffer creation when playback is paused, the AudioContext is unavailable,
the sound is out of range, the voice limit is reached, or mute/master/effects
settings make the effects bus inaudible. Muting or zeroing master/effects also
stops existing one-shot voices. Ambient and engine loops keep their existing
bus-level behavior.

The event observer continues tracking footsteps while muted, so these events are
discarded rather than queued for unmute. Native sound buffers remain cached for
later audible steps. Browser coverage exercises mute, zero effects and zero
master independently while CJ walks in imported Grove Street; each case checks
that native start counts do not increase and no one-shot voices remain. It lets
movement settle while muted before verifying no replay at rest, then verifies
fresh walking produces new native sounds after restoring volume. Pause checks
also confirm suspended context and zero one-shot voices.

Validation: all 673 unit tests, both native-player browser cases (including the
three independent inaudible-settings cases), build and production smoke pass.
Logs: `/tmp/web-gta-native-audio-lifecycle-{unit,browser,production}.log`.

## Native footstep frequency variation

Native footstep recordings now use the handler's `0.0588f` frequency variance
rather than the authored sample system's repeating three-rate pattern. The pinned
[HandleFootstepEvent](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/Entities/AEPedAudioEntity.cpp)
passes this variance to the sound, and
[CAESound::CalculateFrequency](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Audio/AESound.cpp)
adds a random offset in the symmetric variance range. It disables variance when
nonpositive or at least as large as the requested speed. `nativeSoundFrequency`
implements those branches with float32 speed/variance and result conversion.

Playback currently supplies a base speed of 1 and samples independent randomness
for sample choice and frequency. This removes an unrelated repeating pitch pattern
from the native recordings, but it does not recover DoFootLanded's unresolved
movement-dependent speed argument or reproduce the original PRNG sequence. Doppler
and slow-motion frequency scaling remain separate work. The authored fallback
recordings retain their existing pitch behavior.

Tests cover symmetry, intermediate values, additive rather than multiplicative
variation, disabled variance and invalid inputs. The real native-player browser
case observes AudioBufferSourceNode playbackRate when each sampled recording
starts, checks the expected frequency range, and retains the source-sample-rate
and headroom checks. No subjective listening or retail waveform comparison is
claimed.

Validation: 675 unit tests in 142 files, both native-player browser cases, build
and production smoke pass. Logs:
`/tmp/web-gta-native-frequency-{unit,browser,production}.log`.
