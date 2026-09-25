/** One day/night geometry's ExtraVertColour::DNBalance: the balance its prelight was last blended at. `value` is the
 * clamped balance the shader blends by, so it can be handed to a material as a uniform. */
export interface NativeDayNightPrelight { value: number; stored: number; readonly phase: number }

/** pluginExtraVertColourStreamReadCB leaves DNBalance at 1 with the day colours in the prelight; CEntity::CreateRwObject
 * then re-blends at the current balance before the model is drawn (PreRenderUpdate with ignoreDNBalanceParam). */
export function nativeDayNightPrelight(phase: number, balance: number): NativeDayNightPrelight {
  const state = { value: 0, stored: 1, phase: phase & 15 };
  preRenderUpdate(state, balance, 0, true);
  return state;
}

/** CCustomBuildingDNPipeline::PreRenderUpdate (0x5D7200) for a drawn model, once a game frame. `frame` is
 * CCustomBuildingRenderer::Update's counter (s_Magic1, advanced once a CGame::Process and masked to 16); s_Magic2 is
 * always cleared there, so it never forces an update. A change of 0.01 or less is ignored; one of 0.3 or less waits for
 * the atomic's turn, one in sixteen frames. `phase` stands in for the atomic's heap address (address / 0x70 mod 16),
 * which the browser cannot reproduce. Returns whether the prelight was re-blended (NVCPipelineProcess). */
export function preRenderUpdate(state: NativeDayNightPrelight, balance: number, frame: number, ignoreBalance = false) {
  const intensity = Math.abs(state.stored - balance);
  if (intensity <= 0.01 && !ignoreBalance) return false;
  if ((frame & 15) !== state.phase && !ignoreBalance && intensity <= 0.3) return false;
  // NVCPipelineProcess stores the balance unclamped and blends by the clamped one.
  state.stored = balance;
  state.value = Math.min(1, Math.max(0, balance));
  return true;
}

/** A stable per-model stand-in for the atomic address bits PreRenderUpdate staggers by. */
export function dayNightPhase(name: string, index: number) {
  let hash = 2166136261 ^ index;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  return (hash >>> 7) & 15;
}

/** NVCPipelineProcess's per-channel blend of RwRGBA bytes: `lerp` is `to * t + from * (1 - t)` cast to uint8, a
 * truncation. */
export const blendPrelightByte = (day: number, night: number, balance: number) => Math.trunc(night * balance + day * (1 - balance));
