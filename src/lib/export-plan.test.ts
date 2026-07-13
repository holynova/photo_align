import { describe, expect, it } from 'vitest';
import { EXPORT_FPS, getExportDurationSeconds, getExportFramePlan } from './export-plan';

describe('getExportFramePlan', () => {
  it('uses a single fixed frame duration for every export format', () => {
    expect(getExportFramePlan(3, 1, 'fade').frameDurationMs).toBe(Math.round(1000 / EXPORT_FPS));
  });

  it('changes hold frames once when speed changes', () => {
    const normal = getExportFramePlan(10, 1, 'none');
    const double = getExportFramePlan(10, 2, 'none');

    expect(normal.holdFrames).toBe(12);
    expect(double.holdFrames).toBe(6);
    expect(getExportDurationSeconds(10, 2, 'none')).toBeCloseTo(getExportDurationSeconds(10, 1, 'none') / 2);
  });

  it('adds transitions only between adjacent photos', () => {
    expect(getExportFramePlan(1, 1, 'slow').totalFrames).toBe(12);
    expect(getExportFramePlan(2, 1, 'slow').totalFrames).toBe(32);
  });
});
