import { create } from 'zustand';
import { Session, AppMode, VocabularyQuery } from '../../types/transcript';

interface TranscriptState {
  session: Session | null;
  mode: AppMode;
  loadSession: (session: Session) => void;
  setMode: (mode: AppMode) => void;
  toggleMark: (sentenceId: string) => void;
  flagPronunciation: (sentenceId: string) => void;
  addVocabularyQuery: (sentenceId: string, query: VocabularyQuery) => void;
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  session: null,
  mode: 'landing',

  loadSession: (session) => set({ session }),
  setMode: (mode) => set({ mode }),

  toggleMark: (sentenceId) =>
    set((state) => ({
      session: state.session
        ? {
            ...state.session,
            transcript: state.session.transcript.map((s) =>
              s.sentenceId === sentenceId ? { ...s, isMarkedByUser: !s.isMarkedByUser } : s
            ),
          }
        : null,
    })),

  flagPronunciation: (sentenceId) =>
    set((state) => ({
      session: state.session
        ? {
            ...state.session,
            transcript: state.session.transcript.map((s) =>
              s.sentenceId === sentenceId
                ? { ...s, diagnostics: { ...s.diagnostics, pronunciationFlagged: true } }
                : s
            ),
          }
        : null,
    })),

  addVocabularyQuery: (sentenceId, query) =>
    set((state) => ({
      session: state.session
        ? {
            ...state.session,
            transcript: state.session.transcript.map((s) =>
              s.sentenceId === sentenceId
                ? {
                    ...s,
                    diagnostics: {
                      ...s.diagnostics,
                      vocabularyQueries: [...s.diagnostics.vocabularyQueries, query],
                    },
                  }
                : s
            ),
          }
        : null,
    })),
}));
