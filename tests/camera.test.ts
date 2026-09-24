import { expect, test } from 'vitest';
import { cameraGlance, glanceOrientation } from '../src/render/cameraLook';

test('vehicle look keys combine into rear view without affecting on-foot Q/E', () => {
  expect(cameraGlance(true, true, false, false)).toBe('left');
  expect(cameraGlance(true, false, true, false)).toBe('right');
  expect(cameraGlance(true, true, true, false)).toBe('behind');
  expect(cameraGlance(true, true, false, true)).toBe('behind');
  expect(cameraGlance(false, true, true, false)).toBe('none');
  expect(cameraGlance(false, false, false, true)).toBe('behind');
});

test('temporary viewpoints use vehicle heading and preserve the stored orbit on release', () => {
  const yaw = 0.7, pitch = 0.4, heading = 1.1;
  expect(glanceOrientation('left', yaw, pitch, heading).yaw).toBeCloseTo(heading + Math.PI / 2);
  expect(glanceOrientation('right', yaw, pitch, heading).yaw).toBeCloseTo(heading - Math.PI / 2);
  expect(glanceOrientation('behind', yaw, pitch, heading).yaw).toBe(heading);
  expect(glanceOrientation('behind', yaw, pitch).yaw).toBeCloseTo(yaw + Math.PI);
  expect(glanceOrientation('none', yaw, pitch, heading)).toEqual({ yaw, pitch });
});


test('distance modes cycle and isolate walking and vehicle preferences', async () => {
  const { nextCameraMode, parseCameraSettings, cameraNominalDistance, vehicleZoomScale } = await import('../src/render/cameraSettings');
  expect(nextCameraMode('near')).toBe('medium'); expect(nextCameraMode('medium')).toBe('far'); expect(nextCameraMode('far')).toBe('near');
  expect(parseCameraSettings({ foot: 'far', vehicle: 'bad' })).toEqual({ foot: 'far', vehicle: 'medium' });
  expect(parseCameraSettings(null)).toEqual({ foot: 'medium', vehicle: 'medium' });
  expect(cameraNominalDistance('near')).toBeLessThan(cameraNominalDistance('medium'));
  expect(cameraNominalDistance('medium')).toBeLessThan(cameraNominalDistance('far'));
  // The car zooms scale the vehicle's chase distance around the medium one it always had.
  expect([vehicleZoomScale('near'), vehicleZoomScale('medium'), vehicleZoomScale('far')]).toEqual([.75, 1, 1.35]);
});
