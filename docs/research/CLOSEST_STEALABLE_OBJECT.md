# Burglary loot query

`GET_CLOSEST_STEALABLE_OBJECT` (0866) now queries live script-managed and adopted objects. BURGJB
(mission 125) calls it at SCM 2946925 and 2948495 with the point in locals 63–65, radius 5 and
result in local 49. It returns a stable object handle or -1.

## Native evidence

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1001fd6dc` calls CWorld::FindObjectsInRange (`0x10027332c`, reversed PC `0x564A20`)
with b2D true, a 16-entry buffer, objects enabled and buildings/vehicles/peds/dummies disabled.
It then checks entity type 4 and object flag byte +0x1a5 bit 5 (bIsLiftable).

The iOS range scan admits origins strictly inside the squared horizontal radius (`fcmp`/`b.pl`,
for example at `0x1002734e4`; the corresponding object-list branch repeats this test). All objects
consume buffer entries, including non-liftable ones. The handler then chooses the nearest liftable
origin by float32 3D distance, starting with twice the radius, replacing only on a strict decrease
(`0x1001fd748`–`0x1001fd7b8`). Equal distances preserve the first candidate. Vertical distance can
therefore exceed the supplied radius, provided the planar search admits the object and its 3D
distance is less than twice the radius. No held, visibility, collision, damage or mission-ownership
filter is added. The empty-result path at `0x1001fec70` writes -1.

## Coverage and checks

The numerical scan and selection rules are implemented, including float32 arithmetic, the 16-entry
cap before filtering liftable objects, strict boundaries, first ties and -1 for no result. The
adapter uses the existing live object table and does not create or take ownership of a result.

This command remains **authored**: the table is scanned in insertion order, rather than the native
repeat-sector linked-list order, and does not include unadopted map CObjects. This can change the
result for tied objects or crowded searches and can omit world objects. It does not establish
complete burglary gameplay or replace the separately documented carry-task limitations.

Three unit checks cover selection, height, boundaries, state filters and candidate-buffer behavior.
One adapter check executes both original BURGJB instructions, changing liftable flags between
queries. A browser check repeats both instructions against live records, checking movement out of
range, flag changes, another object's selection and deletion. Full BURGJB completion remains
unverified.
