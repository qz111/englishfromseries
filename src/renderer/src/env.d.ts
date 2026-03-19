/// <reference types="vite/client" />

import { Session, AppSettings, LLMRequest, Sentence } from '../../types/transcript';

declare global {
  interface Window {
    api: {
      openVideoDialog: () => Promise<string | null>;
      loadSession: (videoPath: string) => Promise<Session | null>;
      saveSession: (session: Session) => Promise<void>;
      startTranscription: (videoPath: string) => Promise<Sentence[]>;
      callLLM: (req: LLMRequest) => Promise<string>;
      exportSession: (session: Session, format: 'markdown' | 'pdf') => Promise<string>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<void>;
      onTranscriptionProgress: (cb: (progress: number) => void) => (() => void);
    };
  }
}
