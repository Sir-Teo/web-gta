# Native lane layout evidence

`pathLaneOffset` follows `CCarPathLink::OneWayLaneOffset` in pinned
[PathFind.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PathFind.h).
The return value adjusts a lane index; it is not a world-space displacement.

| Record condition | Adjustment |
|---|---|
| Opposite-direction lanes present | `0.5 - sameLanes / 2` |
| Only same-direction lanes present | `0.5 - decodedWidth / 5.4 / 2` |
| Neither direction has lanes | `0.5` |

Branch order matters. The first branch ignores width and the number of opposite
lanes beyond their presence. The second uses the signed fixed-point width
decoded from the navigation record. Do not apply an absolute value or substitute
the visual road mesh width. Lane eligibility remains a separate check; the
zero-lane fallback does not make a record drivable.

## Acquired content audit

All 31,466 navigation records from the 64 exterior path areas were inspected:

- Opposite-direction lanes present: **24,634**.
- Same-direction lanes only: **6,820**.
- No lanes in either direction: **12**.
- Decoded width range: **0–7.5**, with no negative widths in this dataset.
- Returned adjustment range: approximately **−0.0092592593–0.5**.

These counts cover navigation records, not distinct roads or driveable routes.
The source format supports signed widths even though this acquired dataset has
no negative values. `scripts/content/audit-paths.mjs` now includes `laneLayout`
in the depot's `path-content.json`. The full graph audit still reports zero
unresolved references. Log: `/tmp/web-gta-path-lanes-audit.log`.

Tests exercise all encoded lane-count combinations in the first branch, signed
width handling, the no-lane fallback, and the real archive's branch totals and
ranges. Six tests across three files pass with the real content depot, and the
production build passes. Logs: `/tmp/web-gta-path-lanes-tests.log` and
`/tmp/web-gta-path-lanes-build.log`.

## Geometry still to establish

In this pinned San Andreas source, `FindLinksToGoWithTheseNodes`,
`FindPathDirection`, and the lane-following steering functions in
[CarCtrl.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/CarCtrl.cpp)
still call the original executable. The offset method alone does not establish
the full mapping from lane index and travel sign to world position, intersection
curves, or vehicle height. The related
[Vice City CarCtrl implementation](https://ni.4a.si/anonymous/re3/tree/src/control/CarCtrl.cpp?h=miami&id=a43ca86542e904aa4f6a193ebda7d628c8015ab7)
is a comparison lead, not evidence of San Andreas parity. No guessed lane-center
geometry or native vehicle steering was added in this step.
