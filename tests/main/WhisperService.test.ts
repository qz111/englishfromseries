import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs to avoid real file access
vi.mock('fs', () => ({
  default: {
    createReadStream: vi.fn().mockReturnValue('mock-stream'),
  },
  createReadStream: vi.fn().mockReturnValue('mock-stream'),
}));

// Mock the OpenAI SDK before importing the service
const mockCreate = vi.fn();

vi.mock('openai', () => {
  const MockOpenAI = vi.fn(function (this: any) {
    this.audio = {
      transcriptions: {
        create: mockCreate,
      },
    };
  });
  return { default: MockOpenAI };
});

import { WhisperService } from '../../src/main/services/WhisperService';

const MOCK_WHISPER_RESPONSE = {
  segments: [
    {
      id: 0,
      text: " I mean it's a moo point.",
      start: 12.5,
      end: 15.2,
      words: [
        { word: ' I', start: 12.5, end: 12.6 },
        { word: ' mean', start: 12.6, end: 12.8 },
        { word: " it's", start: 12.8, end: 13.0 },
        { word: ' a', start: 13.0, end: 13.1 },
        { word: ' moo', start: 13.1, end: 13.4 },
        { word: ' point.', start: 13.4, end: 15.2 },
      ],
    },
  ],
};

describe('WhisperService', () => {
  let service: WhisperService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WhisperService();
    mockCreate.mockResolvedValue(MOCK_WHISPER_RESPONSE);
  });

  it('returns an array of Sentence objects', async () => {
    const sentences = await service.transcribe('/fake/audio.wav', 'sk-test', () => {});
    expect(sentences).toHaveLength(1);
    expect(sentences[0].sentenceId).toBe('s_000');
    expect(sentences[0].text).toBe("I mean it's a moo point.");
    expect(sentences[0].words).toHaveLength(6);
  });

  it('initializes diagnostics as empty on each sentence', async () => {
    const sentences = await service.transcribe('/fake/audio.wav', 'sk-test', () => {});
    expect(sentences[0].diagnostics).toEqual({
      pronunciationFlagged: false,
      vocabularyQueries: [],
    });
  });

  it('strips leading space from word tokens', async () => {
    const sentences = await service.transcribe('/fake/audio.wav', 'sk-test', () => {});
    expect(sentences[0].words[0].word).toBe('I');
  });
});
