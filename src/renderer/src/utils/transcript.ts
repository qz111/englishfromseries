import { Sentence } from '../../../types/transcript';

/**
 * Returns the sentenceId of the sentence currently active at the given playback time.
 * Uses a "karaoke" heuristic: the active sentence is the last one whose startTime
 * is <= currentTime. This keeps a sentence highlighted across subtitle gaps rather
 * than de-highlighting between sentences.
 */
export function getActiveSentenceId(
  sentences: Sentence[],
  currentTime: number
): string | undefined {
  let active: string | undefined;
  for (const s of sentences) {
    if (s.startTime <= currentTime) active = s.sentenceId;
    else break;
  }
  return active;
}
