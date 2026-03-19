// src/types/transcript.ts

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface VocabularyQuery {
  selectedWord: string;
  type: 'vocabulary' | 'slang';
  aiExplanation: string;
}

export interface Diagnostics {
  pronunciationFlagged: boolean;
  vocabularyQueries: VocabularyQuery[];
}

export interface Sentence {
  sentenceId: string;
  startTime: number;
  endTime: number;
  text: string;
  isMarkedByUser: boolean;
  words: Word[];
  diagnostics: Diagnostics;
}

export interface Session {
  videoPath: string;
  createdAt: string;
  transcript: Sentence[];
}

export type AppMode = 'landing' | 'processing' | 'watch' | 'review' | 'review-center';

export type LLMProvider = 'openai' | 'anthropic';

export interface AppSettings {
  llmProvider: LLMProvider;
  openaiApiKey: string;
  anthropicApiKey: string;
  whisperApiKey: string;
}

export interface LLMRequest {
  sentenceId: string;
  selectedWord: string;
  type: 'vocabulary' | 'slang';
  currentSentence: string;
  prevSentence?: string;
  nextSentence?: string;
}
