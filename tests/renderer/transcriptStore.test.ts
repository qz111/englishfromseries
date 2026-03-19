import { describe, it, expect, beforeEach } from 'vitest';
import { useTranscriptStore } from '../../src/renderer/store/transcriptStore';
import { Session } from '../../src/types/transcript';

const makeSentence = (id: string) => ({
  sentenceId: id,
  startTime: 0,
  endTime: 1,
  text: 'Hello world.',
  isMarkedByUser: false,
  words: [],
  diagnostics: { pronunciationFlagged: false, vocabularyQueries: [] },
});

const makeSession = (): Session => ({
  videoPath: '/test/video.mp4',
  createdAt: '2026-01-01T00:00:00Z',
  transcript: [makeSentence('s_001'), makeSentence('s_002'), makeSentence('s_003')],
});

describe('transcriptStore', () => {
  beforeEach(() => {
    useTranscriptStore.setState({ session: null, mode: 'landing' });
  });

  it('loads a session', () => {
    const session = makeSession();
    useTranscriptStore.getState().loadSession(session);
    expect(useTranscriptStore.getState().session).toEqual(session);
  });

  it('marks a sentence', () => {
    useTranscriptStore.getState().loadSession(makeSession());
    useTranscriptStore.getState().markSentence('s_001');
    const s = useTranscriptStore.getState().session!.transcript[0];
    expect(s.isMarkedByUser).toBe(true);
  });

  it('flags pronunciation', () => {
    useTranscriptStore.getState().loadSession(makeSession());
    useTranscriptStore.getState().flagPronunciation('s_002');
    const s = useTranscriptStore.getState().session!.transcript[1];
    expect(s.diagnostics.pronunciationFlagged).toBe(true);
  });

  it('adds a vocabulary query', () => {
    useTranscriptStore.getState().loadSession(makeSession());
    const query = { selectedWord: 'moo point', type: 'slang' as const, aiExplanation: 'A joke.' };
    useTranscriptStore.getState().addVocabularyQuery('s_001', query);
    const s = useTranscriptStore.getState().session!.transcript[0];
    expect(s.diagnostics.vocabularyQueries).toHaveLength(1);
    expect(s.diagnostics.vocabularyQueries[0]).toEqual(query);
  });
});
