import { describe, it, expect } from 'vitest';
import { getActiveSentenceId } from '../../src/renderer/src/utils/transcript';
import { Sentence } from '../../src/types/transcript';

function makeSentence(id: string, startTime: number, endTime: number): Sentence {
  return {
    sentenceId: id,
    startTime,
    endTime,
    text: 'Test sentence.',
    isMarkedByUser: false,
    words: [],
    diagnostics: { pronunciationFlagged: false, vocabularyQueries: [] },
  };
}

const sentences: Sentence[] = [
  makeSentence('s1', 0, 2),
  makeSentence('s2', 2, 5),
  makeSentence('s3', 5, 9),
];

describe('getActiveSentenceId', () => {
  it('returns undefined for empty transcript', () => {
    expect(getActiveSentenceId([], 3)).toBeUndefined();
  });

  it('returns undefined when currentTime is before first sentence', () => {
    expect(getActiveSentenceId(sentences, -1)).toBeUndefined();
  });

  it('returns first sentence at its exact startTime', () => {
    expect(getActiveSentenceId(sentences, 0)).toBe('s1');
  });

  it('returns correct sentence mid-play', () => {
    expect(getActiveSentenceId(sentences, 3.5)).toBe('s2');
  });

  it('returns last sentence when currentTime is past all sentences', () => {
    expect(getActiveSentenceId(sentences, 99)).toBe('s3');
  });

  it('keeps current sentence highlighted across a subtitle gap (karaoke behaviour)', () => {
    const withGap: Sentence[] = [
      makeSentence('s1', 0, 2),
      makeSentence('s2', 2, 4),
      makeSentence('s3', 6, 9),
    ];
    expect(getActiveSentenceId(withGap, 5)).toBe('s2');
  });

  it('transitions to next sentence exactly at its startTime', () => {
    expect(getActiveSentenceId(sentences, 5)).toBe('s3');
  });
});
