/** CTimeCycle::CalcColoursForPoint altitude correction, after the base/spatial far clip. */
export function nativeAltitudeFarClip(farClip:number, altitude:number):number {
  if (!Number.isFinite(farClip) || farClip<=0 || !Number.isFinite(altitude)) throw new Error('Invalid native far clip or altitude.');
  const f=Math.fround,far=f(farClip),height=f(altitude);
  if (!Number.isFinite(far)||!Number.isFinite(height)) throw new Error('Native far clip or altitude exceeds float range.');
  if (height<=200 || far<=1000) return far;
  if (height>500) return 1000;
  const amount=f(f(height-200)/300);
  return f(f(f(1-amount)*far)+f(amount*1000));
}
