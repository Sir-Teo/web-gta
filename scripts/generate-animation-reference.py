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
