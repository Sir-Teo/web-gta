"""Original diagnostic IFP clips. No original game assets or external writer code."""
from pathlib import Path
import math
import struct

def name(value):
    # Deliberate bytes after the terminator exercise fixed-width C-string semantics.
    data = value.encode('ascii') + b'\0'
    return data + b'X' * (24 - len(data))

def package(version):
    compressed = version == 'ANP3'
    def track(label, bone, translated):
        kind = (4 if translated else 3) if compressed else (2 if translated else 1)
        keys = b''
        for time, angle in [(0, 0), (1, math.pi / 2), (2, math.pi)]:
            q = (0, 0, math.sin(angle / 2), math.cos(angle / 2))
            if time == 2:
                q = tuple(-v for v in q)  # Same orientation, antipodal representation.
            xyz = (time, -2 * time, time / 2)
            if compressed:
                keys += struct.pack('<5h', *(round(v * 4096) for v in q), time * 60)
                if translated:
                    keys += struct.pack('<3h', *(round(v * 1024) for v in xyz))
            else:
                keys += struct.pack('<5f', *q, time)
                if translated:
                    keys += struct.pack('<3f', *xyz)
        return name(label) + struct.pack('<IIi', kind, 3, bone) + keys, len(keys)
    root, root_size = track('Root', 0, True)
    child, child_size = track(' Arm', -1, False)
    animation = name('diagnostic_turn') + struct.pack('<I', 2)
    if compressed:
        animation += struct.pack('<II', root_size + child_size, 1)
    body = name('original_fixture') + struct.pack('<I', 1) + animation + root + child
    return version.encode('ascii') + struct.pack('<I', len(body)) + body

folder = Path(__file__).resolve().parents[1] / 'tests/fixtures'
for version in ['ANP2', 'ANP3']:
    (folder / f'animation-{version.lower()}.ifp').write_bytes(package(version))

# Matching clip for the separately exported diagnostic skin: Root ID 10, Tip by name.
rig = bytearray(package('ANP3'))
struct.pack_into('<i', rig, 104, 10)
rig[156:180] = name('Tip')
(folder / 'animation-rig.ifp').write_bytes(rig)

# Three original role diagnostics with different durations and travel speeds.
def role_clip(label, duration, speed, crouched=False):
    tracks = []
    for label_bone, bone, translated in [('Root', 10, True), ('Tip', -1, crouched)]:
        keys = b''
        for fraction in [0, .5, 1]:
            time = duration * fraction
            angle = .35 if not translated and fraction == .5 else 0
            keys += struct.pack('<5h', 0, round(math.sin(angle / 2) * 4096), 0, round(math.cos(angle / 2) * 4096), round(time * 60))
            if translated:
                keys += struct.pack('<3h', 0, round(-speed * time * 1024) if label_bone == 'Root' else 0, 0 if label_bone == 'Root' else round(.45 * 1024))
        tracks.append((name(label_bone) + struct.pack('<IIi', 4 if translated else 3, 3, bone) + keys, len(keys)))
    return name(label) + struct.pack('<III', 2, sum(size for _, size in tracks), 1) + b''.join(data for data, _ in tracks)
body = name('role_diagnostics') + struct.pack('<I', 3) + role_clip('Idle', 2, 0) + role_clip('Walk', 2, 2) + role_clip('Run', 1, 4)
(folder / 'animation-roles.ifp').write_bytes(b'ANP3' + struct.pack('<I', len(body)) + body)

body = name('crouch_diagnostics') + struct.pack('<I', 2) + role_clip('CrouchIdle', 2, 0, True) + role_clip('CrouchWalk', 2, 1, True)
(folder / 'animation-crouch.ifp').write_bytes(b'ANP3' + struct.pack('<I', len(body)) + body)
