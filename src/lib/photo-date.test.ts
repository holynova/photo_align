import { describe, expect, it } from 'vitest';
import { formatLocalDate, parseDateFromFilename } from './photo-date';

describe('photo date helpers', () => {
  it('formats the local calendar day without converting to UTC', () => {
    const date = new Date(2024, 0, 1, 0, 30);
    expect(formatLocalDate(date)).toBe('2024-01-01');
  });

  it('reads valid YYYYMMDD sequences from a filename', () => {
    expect(parseDateFromFilename('IMG_20240506_102030.jpg')).toBe('2024-05-06');
    expect(parseDateFromFilename('portrait.jpg')).toBe('');
  });
});
