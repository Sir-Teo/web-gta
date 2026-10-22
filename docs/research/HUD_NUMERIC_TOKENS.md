# Closed numeric tokens in HUD text

ZERO2's fuel counter displayed the literal label `FUEL ~1~`. The stock GXT text
contains that numeric placeholder, but the DOM formatter removed only letter
tokens. The native font consumes an unresolved closed numeric token without
drawing a glyph. The shared formatter now follows that behavior, after control
name resolution and the caller's number insertion.

`scripts/research/native-font-numeric-tokens.py` executes complete ParseToken
calls at iOS `0x10037c3c4` in Unicorn 2.1.4. It verifies the pinned executable's
SHA-256 `9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
No calls are intercepted. Twenty-eight captures cover all ten leading digits,
longer digit sequences, a numeric-led word and a Unicode payload, with the blip
argument both false and true. Each returns immediately after the closing tilde,
with colour, optional tag, newline and controller-symbol state unchanged.

The pinned reversed PC CFont::ParseToken (`0x718F00`) also has no digit action
and skips to the closing tilde. The fix applies this shared token-consumption
contract to DOM text; it does not infer full PC retail HUD layout from the iOS
captures. Number insertion still precedes font parsing, so rewards and other
supplied values remain visible. Script palette tags remain available to atlas
rendering. Malformed token handling and full controller-symbol rendering retain
their existing coverage.

Thirty cases failed before the change. The new tests compare every captured
consumed span, the actual ZERO2 GXT label, number insertion, adjacent palette tags
and the existing handling of an unmatched token. The five focused text/control
suites pass 48 checks. ZERO2's permanent combat/result regression also checks
that its actual DOM counter label reads `FUEL`.

All 4,713 unit tests pass (51 skipped), and the build passes. The full controlled
ZERO2 browser also passes in 1.4 minutes, checking its corrected live fuel label,
all five courier deaths, native $5,000 reward and delayed cleanup. The inspected
result screenshot now shows `FUEL` without the unresolved token. Historical
mission sweep bytes and census classifications are unchanged.

See [PC script-font coverage](PC_SCRIPT_FONTS.md) and
[ZERO2 result coverage](ZERO2_VALIDATION.md).
