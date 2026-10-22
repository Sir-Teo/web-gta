# Captured vehicle appearance queries

CVehicle::GetVehicleAppearance at iOS `0x100476ec0` reads the handling pointer
at vehicle +0x4a8, then the low nibble of handling byte +0xcf. These are model
flag bits 24–27 from the word at +0xcc. Its mapping matches the pinned PC
function at `0x6D1080`:

| Selected category bits | Appearance |
| --- | --- |
| None | 1, automobile |
| 0x01000000 | 2, bike |
| 0x02000000 | 3, helicopter |
| 0x08000000 | 4, boat |
| 0x04000000 | 5, plane |
| Any combination of categories | 0, none |

Unrelated flags do not affect the result. It is not a model-name classification
or a priority choice between several set bits.

The script host previously returned automobile for every non-sentinel vehicle
handle, including aircraft and adopted player vehicles. The player snapshot
also treated its helicopter controller as a plane. Both paths now use the same
handling-flags helper. Bike and train classes expose their existing flags through
the same getter already available on cars, boats and aircraft; the script host
reuses its existing model-flags callback. Minimal legacy test hosts without
that callback retain zero-category behavior and still validate the live handle.

`scripts/research/native-vehicle-appearance.py` runs the entire native function
without intercepted calls in Unicorn 2.1.4. It verifies executable SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
Thirty-two fixtures cover all sixteen category combinations with and without
unrelated bits. Six integration cases exercise the script host and the actual
bike/helicopter/boat/plane occupant conditions, including negation; another
checks legacy-host behavior and invalid handles.

All 3,788 unit tests pass (51 skipped), the build and six browser checks pass.
The new browser verifies real car, BMX, Maverick, Tropic and Beagle entities,
then boards each non-car family and checks both the player snapshot and the
registered vehicle query. The existing occupant-targeting test and four
bike-rider tests also pass. Census classification is unchanged.

The SYN6 diagnostic bot exposed this bug when its aircraft-specific RPG decision
could not recognize the recorded helicopter. The correction also applies to
ordinary SCM occupant conditions; it does not itself establish mission completion.
