export const BUILDING_PIPELINE = 0x53f2009c, BUILDING_DN_PIPELINE = 0x53f20098;
export const isBuildingPipeline = (id?: number) => id === BUILDING_PIPELINE || id === BUILDING_DN_PIPELINE;

/** The colour sets an atomic's geometry carries: the prelight (RpGeometryGetPreLightColors) and the extra-vertex-colour
 * plugin's night set. */
interface PrelitGeometry { colors?: Uint8Array; nightColors?: Uint8Array }

/** CCustomBuildingRenderer::IsCBPCPipelineAttached (0x5D7F40): an explicit building pipeline ID, or else a geometry with
 * both a night colour set and prelight. Nearly every world model in the PC archive carries no pipeline plugin and is a
 * building by the second test. The routine is unreversed in gta-reversed; the jte/GTASA decompilation and aap's librwgta
 * (`isBuildingPipeAttached`, "PC logic") agree on it. */
export const isBuildingAtomic = (pipeline: number | undefined, geometry: PrelitGeometry) =>
  isBuildingPipeline(pipeline) || !!(geometry.nightColors && geometry.colors);

/** CCustomBuildingRenderer::AtomicSetup (0x5D7F00): the day/night pipe when the geometry has both colour sets, the plain
 * building pipe otherwise, whatever pipeline ID the atomic was stored with. */
export const isDayNightAtomic = (geometry: PrelitGeometry) => !!(geometry.nightColors && geometry.colors);
