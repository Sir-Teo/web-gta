"""Generate original diagnostic DFFs with an external DragonFF checkout.
Usage: python3 scripts/generate-model-reference.py /path/to/DragonFF
Validated exporter revision: 5a7c2f18d6ff9ac4e3424d552cfe404c931d039d.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[1]).resolve()))
from gtaLib.dff import dff, Clump, Frame, Geometry, Material, Atomic, Texture
from gtaLib.dff import Vector, Matrix, Sphere, Triangle, RGBA, GeomSurfPro, TexCoords, ExtraVertColorExtension

clump = Clump()
root = Frame(); root.name = 'diagnostic_root'; root.position = Vector(3, 4, 5)
root.rotation_matrix = Matrix(Vector(1, 0, 0), Vector(0, 1, 0), Vector(0, 0, 1))
child = Frame(); child.name = 'rotated_pyramid'; child.parent = 0; child.position = Vector(1, 0, 2)
child.rotation_matrix = Matrix(Vector(0, 1, 0), Vector(-1, 0, 0), Vector(0, 0, 1))
clump.frame_list = [root, child]
g = Geometry()
g.vertices = [Vector(-1, -1, 0), Vector(1, -1, 0), Vector(1, 1, 0), Vector(-1, 1, 0), Vector(0, 0, 3)]
g.triangles = [Triangle(b, a, mat, c) for a, b, c, mat in [(0, 1, 4, 0), (1, 2, 4, 0), (2, 3, 4, 0), (3, 0, 4, 0), (0, 3, 2, 1), (0, 2, 1, 1)]]
g.normals = [Vector(0, 0, 1)] * 5
g.bounding_sphere = Sphere(0, 0, 1.5, 2.1)
g.prelit_colors = [RGBA(180, 220, 255, 255)] * 4 + [RGBA(255, 225, 130, 255)]
g.uv_layers = [[TexCoords(0, 0), TexCoords(1, 0), TexCoords(1, 1), TexCoords(0, 1), TexCoords(.5, .5)]]
g.extensions['extra_vert_color'] = ExtraVertColorExtension([RGBA(30, 45, 95, 255)] * 5)
for color in [RGBA(255, 255, 255, 255), RGBA(255, 140, 60, 255)]:
    m = Material(); m.flags = 0; m.color = color; m.surface_properties = GeomSurfPro(1, 0, 1); g.materials.append(m)
t = Texture(); t.filters = 2; t.uv_addressing = 0x11; t.name = 'calibration_grid'; g.materials[0].textures = [t]
clump.geometry_list = [g]
a = Atomic(); a.frame = 1; a.geometry = 0; a.flags = 4; clump.atomic_list = [a]
model = dff(); model.clumps = [clump]
folder = Path(__file__).resolve().parents[1] / 'tests/fixtures'
for name, strip in [('dragonff-model.dff', False), ('dragonff-model-strips.dff', True)]:
    g.export_flags['exclude_geo_faces'] = strip; g.export_flags['triangle_strip'] = strip
    (folder / name).write_bytes(model.write_memory(0x36003))
    print(folder / name)
