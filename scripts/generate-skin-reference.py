"""Export an original two-bone weighted strip with the pinned external DragonFF."""
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from gtaLib.dff import dff, Clump, Frame, Geometry, Material, Atomic, Vector, Matrix, Sphere, Triangle, RGBA, GeomSurfPro, SkinPLG, HAnimPLG, HAnimHeader, Bone

def frame(name, parent, position, bone_id=None):
    f = Frame(); f.name = name; f.parent = parent; f.position = Vector(*position)
    f.rotation_matrix = Matrix(Vector(1,0,0), Vector(0,1,0), Vector(0,0,1))
    if bone_id is not None:
        f.bone_data = HAnimPLG(); f.bone_data.header = HAnimHeader(0x100, bone_id, 0)
    return f
clump = Clump()
# Palette order deliberately differs from frame order: Tip=1, Root=0.
clump.frame_list = [frame('Container', -1, (0,0,0)), frame('Tip', 2, (0,0,1), 42), frame('Root', 0, (0,0,0), 10)]
root = clump.frame_list[2].bone_data; root.header = HAnimHeader(0x100, 10, 2)
root.bones = [Bone(10,0,0), Bone(42,1,3)]
g = Geometry(); g.vertices = [Vector(-.5,0,0), Vector(.5,0,0), Vector(-.5,0,1), Vector(.5,0,1), Vector(-.5,0,2), Vector(.5,0,2)]
g.normals = [Vector(0,-1,0)] * 6
g.triangles = [Triangle(1,0,0,2), Triangle(3,1,0,2), Triangle(3,2,0,4), Triangle(5,3,0,4)]
g.bounding_sphere = Sphere(0,0,1,2); g.prelit_colors = [RGBA(200,140,65,255)] * 6
m = Material(); m.color = RGBA(255,255,255,255); m.surface_properties = GeomSurfPro(1,0,1); g.materials = [m]
skin = SkinPLG(); skin.num_bones = 2
skin.vertex_bone_indices = [(0,0,0,0)] * 2 + [(0,1,0,0)] * 2 + [(1,0,0,0)] * 2
skin.vertex_bone_weights = [(1,0,0,0)] * 2 + [(.5,.5,0,0)] * 2 + [(1,0,0,0)] * 2
skin.bone_matrices = [((1,0,0,0),(0,1,0,0),(0,0,1,0),(0,0,0,1)), ((1,0,0,0),(0,1,0,0),(0,0,1,0),(0,0,-1,1))]
g.extensions['skin'] = skin; clump.geometry_list = [g]
a = Atomic(); a.frame = 0; a.geometry = 0; a.flags = 4; clump.atomic_list = [a]
asset = dff(); asset.clumps = [clump]
folder = Path(__file__).resolve().parents[1] / 'tests/fixtures'
(folder / 'dragonff-skin.dff').write_bytes(asset.write_memory(0x36003))
