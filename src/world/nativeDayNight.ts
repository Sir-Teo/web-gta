import { wrapMinutes } from './timecycle';

/** Building prelight schedule transcribed in CustomBuildingRenderer::UpdateDayNightBalanceParam. */
export function nativeDayNightBalance(minutes: number) {
  if (!Number.isFinite(minutes)) throw new Error('Native prelight time must be finite.');
  const time = wrapMinutes(minutes); // CClock::GetMinutesToday includes seconds / 60.
  if (time < 360) return 1;
  if (time < 420) return (420-time)/60;
  if (time < 1200) return 0;
  if (time < 1260) return (time-1200)/60;
  return 1;
}
