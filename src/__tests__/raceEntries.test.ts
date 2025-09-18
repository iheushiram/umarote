import { describe, it, expect } from 'vitest';
import { resolveDuplicateRaceEntryIds } from '../index';

describe('resolveDuplicateRaceEntryIds', () => {
  it('removes provisional entries when confirmed horse numbers exist', () => {
    const duplicates = resolveDuplicateRaceEntryIds([
      { id: 1, horseId: 'horse-1', horseNo: 0 },
      { id: 2, horseId: 'horse-1', horseNo: 10 }
    ]);

    expect(duplicates).toEqual([1]);
  });

  it('keeps first confirmed entry and removes later duplicates', () => {
    const duplicates = resolveDuplicateRaceEntryIds([
      { id: 10, horseId: 'horse-2', horseNo: 7 },
      { id: 11, horseId: 'horse-2', horseNo: 7 },
      { id: 12, horseId: 'horse-2', horseNo: 0 }
    ]);

    expect(duplicates).toEqual([11, 12]);
  });

  it('ignores entries without horseId', () => {
    const duplicates = resolveDuplicateRaceEntryIds([
      { id: 20, horseId: null, horseNo: 0 },
      { id: 21, horseId: 'horse-3', horseNo: 5 }
    ]);

    expect(duplicates).toEqual([]);
  });
});
