import fs from 'fs';
import OpenAI from 'openai';
import { Sentence } from '../../types/transcript';

export class WhisperService {
  async transcribe(
    audioPath: string,
    apiKey: string,
    onProgress: (progress: number) => void
  ): Promise<Sentence[]> {
    const client = new OpenAI({ apiKey });

    onProgress(0.1);

    const response = await client.audio.transcriptions.create(
      {
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment', 'word'],
      },
      { signal: AbortSignal.timeout(30_000) }
    );

    onProgress(0.9);

    const sentences: Sentence[] = ((response as any).segments ?? []).map(
      (seg: any, i: number) => ({
        sentenceId: `s_${String(i).padStart(3, '0')}`,
        startTime: seg.start,
        endTime: seg.end,
        text: seg.text.trim(),
        isMarkedByUser: false,
        words: (seg.words ?? []).map((w: any) => ({
          word: w.word.replace(/^\s+/, ''),
          start: w.start,
          end: w.end,
        })),
        diagnostics: {
          pronunciationFlagged: false,
          vocabularyQueries: [],
        },
      })
    );

    onProgress(1.0);
    return sentences;
  }
}
