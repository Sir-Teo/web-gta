"""Generate original diagnostic COL2/COL3 assets with an external DragonFF checkout."""
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from gtaLib import col
out = Path(__file__).resolve().parents[1] / 'tests/fixtures'
for version in (2, 3):
    col.Sections.init_sections(version)
    model = col.ColModel()
    model.version, model.model_name, model.model_id = version, f'diagnostic_col{version}', 100 + version
    model.bounds = col.TBounds((-2, -2, -1), (2, 2, 2), (0, 0, 0.5), 3.5)
    model.spheres = [col.TSphere((0, 0, 1), 0.5, col.TSurface(7, 2, 3, 0xA3))]
    model.boxes = [col.TBox((-1, -1, -0.5), (1, 1, 0), col.TSurface(9, 0, 1, 0xB4))]
    model.mesh_verts = [(-2, -2, 0), (2, -2, 0), (2, 2, 0), (-2, 2, 0)]
    model.mesh_faces = [col.TFace(0, 1, 2, 10, 0xC5), col.TFace(0, 2, 3, 11, 0xD6)]
    model.face_groups = [col.TFaceGroup((-2, -2, 0), (2, 2, 0), 0, 1)]
    if version == 3:
        model.shadow_verts = [(-1, -1, 0.25), (1, -1, 0.25), (0, 1, 0.25)]
        model.shadow_faces = [col.TFace(0, 1, 2, 12, 0xE7)]
    writer = col.coll(); writer.models = [model]
    (out / f'dragonff-collision-v{version}.col').write_bytes(writer.write_memory())
