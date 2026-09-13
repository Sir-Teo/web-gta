"""Read-only sampler provenance audit of a user-supplied San Andreas VER2 IMG.
Usage: python3 scripts/research/audit-texture-samplers.py /path/to/gta3.img
Prints metadata only; does not extract or redistribute native assets.
"""
import collections
import json
from pathlib import Path
import struct
import sys


def chunks(data):
    position = 0
    while position < len(data):
        if len(data) - position < 12:
            raise ValueError('Truncated RenderWare header')
        kind, size, _ = struct.unpack_from('<III', data, position)
        end = position + 12 + size
        if end > len(data):
            raise ValueError('Truncated RenderWare payload')
        yield kind, data[position + 12:end]
        position = end


def name(data):
    return bytes(data).split(b'\0', 1)[0].decode('ascii', errors='replace')


def audit(path):
    counts = collections.Counter()
    leaves, materials = [], []
    dictionaries = textures = 0
    with path.open('rb') as archive:
        magic, count = struct.unpack('<4sI', archive.read(8))
        if magic != b'VER2' or count > 100000:
            raise ValueError('Expected bounded VER2 IMG')
        entries = [struct.unpack('<IHH24s', archive.read(32)) for _ in range(count)]
        for offset, sectors, _, entry_name in entries:
            filename = name(entry_name)
            if not filename.lower().endswith('.txd') and filename != 'veg_bevtree2.dff':
                continue
            if sectors * 2048 > 64 * 1024 * 1024:
                raise ValueError('Archive entry exceeds 64 MiB')
            archive.seek(offset * 2048)
            data = memoryview(archive.read(sectors * 2048))
            if len(data) < 12:
                raise ValueError('Truncated archive entry')
            # IMG entries are sector-padded; only walk the declared root chunk.
            size = struct.unpack_from('<I', data, 4)[0]
            root_kind, root = next(chunks(data[:12 + size]))
            if filename.endswith('.dff'):
                def walk(data):
                    for kind, payload in chunks(data):
                        if kind == 6:
                            parts = list(chunks(payload))
                            sampler = struct.unpack_from('<I', parts[0][1])[0]
                            materials.append({'model': filename, 'texture': name(parts[1][1]), 'samplingWord': sampler, 'filter': sampler & 255})
                        elif kind in (26, 15, 8, 7):
                            walk(payload)
                if root_kind != 16:
                    raise ValueError('Expected clump')
                walk(root)
                continue
            if root_kind != 22:
                raise ValueError('Expected texture dictionary')
            dictionaries += 1
            for kind, native in chunks(root):
                if kind != 21:
                    continue
                textures += 1
                parts = list(chunks(native))
                structure = parts[0][1]
                if parts[0][0] != 1 or struct.unpack_from('<I', structure)[0] != 9:
                    raise ValueError('Expected Direct3D 9 native texture')
                sampler = struct.unpack_from('<I', structure, 4)[0]
                texture_name = name(structure[8:40])
                extensions = []
                for part_kind, extension in parts[1:]:
                    if part_kind == 3:
                        for plugin, payload in chunks(extension):
                            key = hex(plugin)
                            counts[key] += 1
                            extensions.append({'id': key, 'bytes': len(payload)})
                if any(term in texture_name.lower() for term in ('leav', 'planta', 'kbtree')):
                    width, height, depth, levels, raster_type, flags = struct.unpack_from('<HHBBBB', structure, 80)
                    leaves.append({'dictionary': filename, 'texture': texture_name, 'filter': sampler & 255, 'width': width, 'height': height, 'levels': levels, 'flags': flags, 'extensions': extensions})
    return {'dictionaries': dictionaries, 'textures': textures, 'extensionCounts': dict(counts), 'groveTreeMaterials': materials, 'leafRasters': leaves}


if __name__ == '__main__':
    print(json.dumps(audit(Path(sys.argv[1])), indent=2))
