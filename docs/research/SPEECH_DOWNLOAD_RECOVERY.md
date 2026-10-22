# Mission dialogue download recovery

`ScriptSpeech` loads the packaged SCRIPT manifest, verifies bank size and SHA-256,
and decodes individual MP3 lines. Its public load resolves false if a line cannot
be obtained, allowing the existing subtitle-duration fallback to run.

Previously, a failed manifest request resolved to undefined and stayed cached.
Dependent bank and line requests cached that absence too. A temporary HTTP error,
network failure or malformed response could silence later dialogue for the session.

Failures now reject internally and evict the failed manifest, bank and line
requests. The next request can recover, and concurrent requests still share
downloads. There is no new background retry loop or delay in the current mission.
A known missing optional manifest (404) stays cached, as do missing entries in
a valid manifest. Verified banks survive decoder failures so another attempt
need only decode the line again.

When the native slot's first load fails and the fallback subsequently recovers
the line, AudioSystem now fills that slot too. Otherwise the decoded line plays
through the fallback without its native entity, volume and mixing behavior.
A newer preload is respected if it replaced the old line during decoding.

Three parameterized tests cover HTTP 503, rejected fetch and malformed JSON,
including concurrent different/repeated lines. Two further tests cover decode
recovery from a retained bank and cached optional absence. Two native-loader
integration tests cover recovered slot playback and replacement during decoding.
All 3,695 unit tests pass (51 skipped). This is browser delivery behavior;
native audio scheduling and opcode classification are unchanged.

The browser regression forces the first manifest request to return HTTP 503,
then verifies a second manifest request, one bank download, the decoded 3.84 s
line, native +6 dB frontend playback, audible output, entity attachment, clearing,
the mission-passed tune and beat-clock behavior. It passes without page errors.
The final build also passes. Existing terrain-support warnings during the opening
are separate from these audio assertions.
