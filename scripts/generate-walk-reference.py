"""Original matching visual/collision floor for imported-scene walking tests."""
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from gtaLib import col
from gtaLib.dff import dff, Clump, Frame, Geometry, Material, Atomic, Vector, Matrix, Sphere, Triangle, RGBA, GeomSurfPro
points = [(-8, -8, 0), (8, -8, 0), (8, 8, 0), (-8, 8, 0)]
clump = Clump(); frame = Frame(); frame.name = 'walk_floor'; frame.position = Vector(0, 0, 0)
frame.rotation_matrix = Matrix(Vector(1,0,0), Vector(0,1,0), Vector(0,0,1)); clump.frame_list = [frame]
g = Geometry(); g.vertices = [Vector(*p) for p in points]; g.normals = [Vector(0,0,1)] * 4
g.triangles = [Triangle(1,0,0,2), Triangle(2,0,0,3)]; g.bounding_sphere = Sphere(0,0,0,12)
g.prelit_colors = [RGBA(150,170,145,255)] * 4
m = Material(); m.color = RGBA(255,255,255,255); m.surface_properties = GeomSurfPro(1,0,1); g.materials = [m]
clump.geometry_list = [g]; a = Atomic(); a.frame = 0; a.geometry = 0; a.flags = 4; clump.atomic_list = [a]
visual = dff(); visual.clumps = [clump]
col.Sections.init_sections(3); physical = col.ColModel(); physical.version = 3; physical.model_name = 'walk_floor'; physical.model_id = 500
physical.bounds = col.TBounds((-8,-8,-0.1), (8,8,0.1), (0,0,0), 12)
physical.mesh_verts = points; physical.mesh_faces = [col.TFace(0,1,2,0,255), col.TFace(0,2,3,0,255)]
collection = col.coll(); collection.models = [physical]
folder = Path(__file__).resolve().parents[1] / 'tests/fixtures'
(folder / 'walk-floor.dff').write_bytes(visual.write_memory(0x36003)); (folder / 'walk-floor.col').write_bytes(collection.write_memory())
