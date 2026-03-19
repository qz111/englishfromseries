# Immersive English Learning Video Player — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop Electron app that lets users watch local videos without subtitles, mark confusing sentences with R, then diagnose and review them with AI explanations.

**Architecture:** Electron main process owns all I/O (FFmpeg, Whisper API, LLM API, session JSON, export). Renderer process is a React + Zustand UI that communicates via typed IPC channels. The transcript JSON is progressively hydrated across 3 steps (transcribe → mark → diagnose) and auto-saved to disk after every mutation.

**Tech Stack:** Electron 28, React 18, TypeScript 5, Vite (via electron-vite), Zustand 4, OpenAI SDK, Anthropic SDK, ffmpeg-static, Vitest, nock

---

## File Map

```
englishfromseries/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts
│
├── src/
│   ├── types/
│   │   └── transcript.ts          # All shared TypeScript types (Session, Sentence, etc.)
│   │
│   ├── main/
│   │   ├── index.ts               # Electron app entry, window creation, app lifecycle
│   │   ├── settings.ts            # Read/write settings.json in userData
│   │   ├── ipc/
│   │   │   ├── channels.ts        # Typed IPC channel name constants
│   │   │   └── handlers.ts        # All ipcMain.handle() registrations
│   │   └── services/
│   │       ├── FFmpegService.ts   # Audio extraction subprocess
│   │       ├── WhisperService.ts  # OpenAI Whisper API call + response parsing
│   │       ├── LLMService.ts      # GPT-4o / Claude calls, prompt building
│   │       ├── SessionStore.ts    # Serialized read/write of session JSON to disk
│   │       └── ExportService.ts   # Markdown + PDF generation from session
│   │
│   ├── preload/
│   │   └── index.ts               # contextBridge API exposed to renderer
│   │
│   └── renderer/
│       ├── index.html
│       ├── main.tsx               # React entry point
│       ├── App.tsx                # Root component, mode routing
│       ├── store/
│       │   └── transcriptStore.ts # Zustand store: session state + all mutations
│       └── components/
│           ├── LandingScreen.tsx  # Drop zone for video file
│           ├── ProcessingScreen.tsx # FFmpeg + Whisper progress spinner
│           ├── WatchMode/
│           │   ├── WatchMode.tsx  # Watch mode container, R key listener
│           │   └── VideoPlayer.tsx # HTML5 <video>, controls, seek bar
│           ├── ReviewMode/
│           │   ├── ReviewMode.tsx      # Review mode container (video + transcript)
│           │   ├── TranscriptPanel.tsx # Scrolling sentence list with color coding
│           │   └── DiagnosticMenu.tsx  # Word chips, 3-button diagnosis, AI result
│           └── ReviewCenter/
│               ├── ReviewCenter.tsx   # Review & Export hub
│               └── AudioLoopDeck.tsx  # Loops pronunciation-flagged sentences
│
└── tests/
    ├── main/
    │   ├── SessionStore.test.ts
    │   ├── LLMService.test.ts
    │   └── WhisperService.test.ts
    └── renderer/
        └── transcriptStore.test.ts
```

---

## Phase 1: Foundation

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`

- [ ] **Step 1: Scaffold with electron-vite**

```bash
cd D:/developer_tools/englishfromseries
npm create @quick-start/electron@latest . -- --template react-ts --skip-git
```

When prompted, choose: React + TypeScript. Accept defaults.

Expected: `package.json`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/` all created.

- [ ] **Step 2: Install production dependencies**

```bash
npm install zustand openai @anthropic-ai/sdk ffmpeg-static
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest nock @types/node
```

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```

Expected: Electron window opens with default React content. No errors in terminal.

- [ ] **Step 5: Create test script in package.json**

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold electron-vite react-ts project with dependencies"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/transcript.ts`

- [ ] **Step 1: Create types file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/transcript.ts
git commit -m "feat: add shared TypeScript types for transcript data model"
```

---

### Task 3: Zustand Store

**Files:**
- Create: `src/renderer/store/transcriptStore.ts`
- Create: `tests/renderer/transcriptStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/renderer/transcriptStore.test.ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/renderer/transcriptStore.test.ts
```

Expected: FAIL — `transcriptStore` module not found.

- [ ] **Step 3: Implement the store**

```typescript
// src/renderer/store/transcriptStore.ts
import { create } from 'zustand';
import { Session, AppMode, VocabularyQuery } from '../../types/transcript';

interface TranscriptState {
  session: Session | null;
  mode: AppMode;
  loadSession: (session: Session) => void;
  setMode: (mode: AppMode) => void;
  markSentence: (sentenceId: string) => void;
  flagPronunciation: (sentenceId: string) => void;
  addVocabularyQuery: (sentenceId: string, query: VocabularyQuery) => void;
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  session: null,
  mode: 'landing',

  loadSession: (session) => set({ session }),
  setMode: (mode) => set({ mode }),

  markSentence: (sentenceId) =>
    set((state) => ({
      session: state.session
        ? {
            ...state.session,
            transcript: state.session.transcript.map((s) =>
              s.sentenceId === sentenceId ? { ...s, isMarkedByUser: true } : s
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/renderer/transcriptStore.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/store/transcriptStore.ts tests/renderer/transcriptStore.test.ts
git commit -m "feat: add Zustand transcript store with mark/diagnose mutations"
```

---

### Task 4: SessionStore

**Files:**
- Create: `src/main/services/SessionStore.ts`
- Create: `tests/main/SessionStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/main/SessionStore.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore } from '../../src/main/services/SessionStore';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const makeSession = (videoPath: string) => ({
  videoPath,
  createdAt: '2026-01-01T00:00:00Z',
  transcript: [],
});

describe('SessionStore', () => {
  let tmpDir: string;
  let store: SessionStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-test-'));
    store = new SessionStore();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it('returns null when no session file exists', async () => {
    const result = await store.load(path.join(tmpDir, 'video.mp4'));
    expect(result).toBeNull();
  });

  it('saves and loads a session', async () => {
    const videoPath = path.join(tmpDir, 'video.mp4');
    const session = makeSession(videoPath);
    store.save(session);
    await new Promise((r) => setTimeout(r, 100)); // wait for async write
    const loaded = await store.load(videoPath);
    expect(loaded).toEqual(session);
  });

  it('session path follows <video>.session.json convention', () => {
    const videoPath = '/some/path/friends-s01e01.mp4';
    expect(store.sessionPath(videoPath)).toBe('/some/path/friends-s01e01.mp4.session.json');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/main/SessionStore.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SessionStore**

```typescript
// src/main/services/SessionStore.ts
import fs from 'fs/promises';
import { Session } from '../../types/transcript';

export class SessionStore {
  private saveQueue: Promise<void> = Promise.resolve();

  sessionPath(videoPath: string): string {
    return `${videoPath}.session.json`;
  }

  async load(videoPath: string): Promise<Session | null> {
    try {
      const raw = await fs.readFile(this.sessionPath(videoPath), 'utf-8');
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }

  save(session: Session): void {
    this.saveQueue = this.saveQueue.then(() => this._write(session));
  }

  private async _write(session: Session): Promise<void> {
    const dest = this.sessionPath(session.videoPath);
    const tmp = `${dest}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(session, null, 2), 'utf-8');
    await fs.rename(tmp, dest);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/main/SessionStore.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/SessionStore.ts tests/main/SessionStore.test.ts
git commit -m "feat: add SessionStore with atomic write-to-temp-then-rename save queue"
```

---

### Task 5: App Settings

**Files:**
- Create: `src/main/settings.ts`

- [ ] **Step 1: Implement settings read/write**

```typescript
// src/main/settings.ts
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { AppSettings } from '../types/transcript';

const DEFAULTS: AppSettings = {
  llmProvider: 'openai',
  openaiApiKey: '',
  anthropicApiKey: '',
  whisperApiKey: '',
};

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}
```

Note: `app` from Electron is only available in the main process — do not import this file in renderer or tests. Settings are accessed via IPC.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/settings.ts
git commit -m "feat: add settings.json read/write for API keys and LLM provider"
```

---

### Task 6: IPC Channels

**Files:**
- Create: `src/main/ipc/channels.ts`
- Create: `src/main/ipc/handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Define typed channel constants**

```typescript
// src/main/ipc/channels.ts
export const IPC = {
  OPEN_VIDEO_DIALOG: 'open-video-dialog',
  LOAD_SESSION: 'load-session',
  START_TRANSCRIPTION: 'start-transcription',
  SAVE_SESSION: 'save-session',
  CALL_LLM: 'call-llm',
  EXPORT_SESSION: 'export-session',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  TRANSCRIPTION_PROGRESS: 'transcription-progress',
} as const;
```

- [ ] **Step 2: Implement IPC handlers skeleton**

```typescript
// src/main/ipc/handlers.ts
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC } from './channels';
import { SessionStore } from '../services/SessionStore';
import { FFmpegService } from '../services/FFmpegService';
import { WhisperService } from '../services/WhisperService';
import { LLMService } from '../services/LLMService';
import { ExportService } from '../services/ExportService';
import { loadSettings, saveSettings } from '../settings';
import { Session, LLMRequest } from '../../types/transcript';

const sessionStore = new SessionStore();
const ffmpegService = new FFmpegService();
const whisperService = new WhisperService();
const llmService = new LLMService();
const exportService = new ExportService();

export function registerHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC.OPEN_VIDEO_DIALOG, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.LOAD_SESSION, async (_e, videoPath: string) => {
    return sessionStore.load(videoPath);
  });

  ipcMain.handle(IPC.SAVE_SESSION, async (_e, session: Session) => {
    sessionStore.save(session);
  });

  ipcMain.handle(IPC.START_TRANSCRIPTION, async (_e, videoPath: string) => {
    const settings = await loadSettings();
    const audioPath = await ffmpegService.extractAudio(videoPath);
    const transcript = await whisperService.transcribe(audioPath, settings.whisperApiKey, (p) => {
      mainWindow.webContents.send(IPC.TRANSCRIPTION_PROGRESS, p);
    });
    return transcript;
  });

  ipcMain.handle(IPC.CALL_LLM, async (_e, req: LLMRequest) => {
    const settings = await loadSettings();
    return llmService.explain(req, settings);
  });

  ipcMain.handle(IPC.EXPORT_SESSION, async (_e, session: Session, format: 'markdown' | 'pdf') => {
    return exportService.export(session, format);
  });

  ipcMain.handle(IPC.GET_SETTINGS, async () => loadSettings());
  ipcMain.handle(IPC.SAVE_SETTINGS, async (_e, settings) => saveSettings(settings));
}
```

- [ ] **Step 3: Expose API via contextBridge in preload**

Replace the contents of `src/preload/index.ts`:

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../main/ipc/channels';
import { Session, AppSettings, LLMRequest } from '../types/transcript';

contextBridge.exposeInMainWorld('api', {
  openVideoDialog: () => ipcRenderer.invoke(IPC.OPEN_VIDEO_DIALOG),
  loadSession: (videoPath: string) => ipcRenderer.invoke(IPC.LOAD_SESSION, videoPath),
  saveSession: (session: Session) => ipcRenderer.invoke(IPC.SAVE_SESSION, session),
  startTranscription: (videoPath: string) => ipcRenderer.invoke(IPC.START_TRANSCRIPTION, videoPath),
  callLLM: (req: LLMRequest) => ipcRenderer.invoke(IPC.CALL_LLM, req),
  exportSession: (session: Session, format: 'markdown' | 'pdf') =>
    ipcRenderer.invoke(IPC.EXPORT_SESSION, session, format),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.GET_SETTINGS),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke(IPC.SAVE_SETTINGS, settings),
  onTranscriptionProgress: (cb: (progress: number) => void) => {
    ipcRenderer.on(IPC.TRANSCRIPTION_PROGRESS, (_e, p) => cb(p));
  },
});

// TypeScript declaration — add to src/renderer/env.d.ts
```

- [ ] **Step 4: Add window.api type declaration**

Create `src/renderer/env.d.ts`:

```typescript
// src/renderer/env.d.ts
import { Session, AppSettings, LLMRequest } from '../types/transcript';

declare global {
  interface Window {
    api: {
      openVideoDialog: () => Promise<string | null>;
      loadSession: (videoPath: string) => Promise<Session | null>;
      saveSession: (session: Session) => Promise<void>;
      startTranscription: (videoPath: string) => Promise<import('../types/transcript').Sentence[]>;
      callLLM: (req: LLMRequest) => Promise<string>;
      exportSession: (session: Session, format: 'markdown' | 'pdf') => Promise<string>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<void>;
      onTranscriptionProgress: (cb: (progress: number) => void) => void;
    };
  }
}
```

- [ ] **Step 5: Register handlers in main/index.ts**

In `src/main/index.ts`, after creating the `BrowserWindow`, call:

```typescript
import { registerHandlers } from './ipc/handlers';
// ... inside app.whenReady():
registerHandlers(mainWindow);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc/ src/preload/index.ts src/renderer/env.d.ts src/main/index.ts
git commit -m "feat: add typed IPC channels, handlers skeleton, and contextBridge API"
```

---

## Phase 2: Media Pipeline

---

### Task 7: FFmpegService

**Files:**
- Create: `src/main/services/FFmpegService.ts`

- [ ] **Step 1: Find the ffmpeg-static binary path**

`ffmpeg-static` exports the path to the bundled FFmpeg binary. In the main process:

```typescript
// verify in a quick test:
import ffmpegPath from 'ffmpeg-static';
console.log(ffmpegPath); // e.g. C:\...\node_modules\ffmpeg-static\ffmpeg.exe
```

- [ ] **Step 2: Implement FFmpegService**

```typescript
// src/main/services/FFmpegService.ts
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import ffmpegPath from 'ffmpeg-static';

export class FFmpegService {
  async extractAudio(videoPath: string): Promise<string> {
    const audioPath = path.join(os.tmpdir(), `efs-audio-${Date.now()}.wav`);
    await this._run([
      '-i', videoPath,
      '-vn',          // no video
      '-ar', '16000', // 16kHz sample rate (Whisper optimal)
      '-ac', '1',     // mono
      '-y',           // overwrite
      audioPath,
    ]);
    return audioPath;
  }

  private _run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath as string, args);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited ${code}: ${stderr}`));
      });
    });
  }
}
```

- [ ] **Step 3: Manual smoke test**

Temporarily add to `handlers.ts` a console.log test, or run the app with a sample video to confirm audio extraction works.

```bash
npm run dev
```

Drop a sample `.mp4` and open DevTools (Ctrl+Shift+I) to check for errors. Confirm the `.wav` file appears in `os.tmpdir()`.

- [ ] **Step 4: Commit**

```bash
git add src/main/services/FFmpegService.ts
git commit -m "feat: add FFmpegService for audio extraction via ffmpeg-static"
```

---

### Task 8: WhisperService

**Files:**
- Create: `src/main/services/WhisperService.ts`
- Create: `tests/main/WhisperService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/main/WhisperService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the OpenAI SDK before importing the service
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn(),
      },
    },
  })),
}));

import OpenAI from 'openai';
import { WhisperService } from '../../src/main/services/WhisperService';

const MOCK_WHISPER_RESPONSE = {
  segments: [
    {
      id: 0,
      text: ' I mean it\'s a moo point.',
      start: 12.5,
      end: 15.2,
      words: [
        { word: ' I', start: 12.5, end: 12.6 },
        { word: ' mean', start: 12.6, end: 12.8 },
        { word: ' it\'s', start: 12.8, end: 13.0 },
        { word: ' a', start: 13.0, end: 13.1 },
        { word: ' moo', start: 13.1, end: 13.4 },
        { word: ' point.', start: 13.4, end: 15.2 },
      ],
    },
  ],
};

describe('WhisperService', () => {
  let service: WhisperService;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new WhisperService();
    const instance = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockCreate = instance.audio.transcriptions.create;
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/main/WhisperService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement WhisperService**

```typescript
// src/main/services/WhisperService.ts
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

    const response = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
    });

    onProgress(0.9);

    const sentences: Sentence[] = (response.segments ?? []).map((seg, i) => ({
      sentenceId: `s_${String(i).padStart(3, '0')}`,
      startTime: seg.start,
      endTime: seg.end,
      text: seg.text.trim(),
      isMarkedByUser: false,
      words: (seg.words ?? []).map((w) => ({
        word: w.word.replace(/^\s+/, ''), // strip leading space
        start: w.start,
        end: w.end,
      })),
      diagnostics: {
        pronunciationFlagged: false,
        vocabularyQueries: [],
      },
    }));

    onProgress(1.0);
    return sentences;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/main/WhisperService.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/WhisperService.ts tests/main/WhisperService.test.ts
git commit -m "feat: add WhisperService with sentence/word timestamp parsing"
```

---

### Task 9: LLMService

**Files:**
- Create: `src/main/services/LLMService.ts`
- Create: `tests/main/LLMService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/main/LLMService.test.ts
import { describe, it, expect } from 'vitest';
import { LLMService } from '../../src/main/services/LLMService';
import { LLMRequest, AppSettings } from '../../src/types/transcript';

describe('LLMService — prompt building', () => {
  const service = new LLMService();

  it('vocabulary prompt contains only current sentence', () => {
    const prompt = service.buildPrompt({
      sentenceId: 's_001',
      selectedWord: 'moot',
      type: 'vocabulary',
      currentSentence: "That's a moot point.",
      prevSentence: 'Previous sentence.',
      nextSentence: 'Next sentence.',
    });
    expect(prompt).toContain("That's a moot point.");
    expect(prompt).toContain('moot');
    expect(prompt).not.toContain('Previous sentence.');
    expect(prompt).not.toContain('Next sentence.');
  });

  it('slang prompt includes prev, current, and next sentences', () => {
    const prompt = service.buildPrompt({
      sentenceId: 's_001',
      selectedWord: 'moo point',
      type: 'slang',
      currentSentence: "It's a moo point.",
      prevSentence: 'I mean.',
      nextSentence: "Like a cow's opinion.",
    });
    expect(prompt).toContain("It's a moo point.");
    expect(prompt).toContain('I mean.');
    expect(prompt).toContain("Like a cow's opinion.");
  });

  it('slang prompt omits prev sentence when undefined', () => {
    const prompt = service.buildPrompt({
      sentenceId: 's_001',
      selectedWord: 'moo point',
      type: 'slang',
      currentSentence: "It's a moo point.",
      nextSentence: "Like a cow's opinion.",
    });
    expect(prompt).not.toContain('Previous sentence:');
    expect(prompt).toContain("It's a moo point.");
  });

  it('slang prompt omits next sentence when undefined', () => {
    const prompt = service.buildPrompt({
      sentenceId: 's_001',
      selectedWord: 'moo point',
      type: 'slang',
      currentSentence: "It's a moo point.",
    });
    expect(prompt).not.toContain('Next sentence:');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/main/LLMService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement LLMService**

```typescript
// src/main/services/LLMService.ts
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { LLMRequest, AppSettings } from '../../types/transcript';

export class LLMService {
  buildPrompt(req: LLMRequest): string {
    if (req.type === 'vocabulary') {
      return [
        `Context sentence: "${req.currentSentence}"`,
        `Selected word: "${req.selectedWord}"`,
        '',
        `Explain what "${req.selectedWord}" means in the context of this specific sentence.`,
        'Be concise. Provide one example sentence. English only.',
      ].join('\n');
    }

    // slang / idiom
    const lines: string[] = [];
    if (req.prevSentence) lines.push(`Previous sentence: "${req.prevSentence}"`);
    lines.push(`Current sentence: "${req.currentSentence}"`);
    if (req.nextSentence) lines.push(`Next sentence: "${req.nextSentence}"`);
    lines.push(`Selected phrase: "${req.selectedWord}"`);
    lines.push('');
    lines.push(
      `Explain what "${req.selectedWord}" means in this conversational context, including any cultural nuance or idiomatic usage. Be concise. Provide one example sentence. English only.`
    );
    return lines.join('\n');
  }

  async explain(req: LLMRequest, settings: AppSettings): Promise<string> {
    const prompt = this.buildPrompt(req);

    if (settings.llmProvider === 'openai') {
      const client = new OpenAI({ apiKey: settings.openaiApiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
      });
      return response.choices[0].message.content ?? '';
    }

    // anthropic
    const client = new Anthropic({ apiKey: settings.anthropicApiKey });
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/main/LLMService.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/LLMService.ts tests/main/LLMService.test.ts
git commit -m "feat: add LLMService with vocabulary/slang prompt strategy and OpenAI/Anthropic support"
```

---

## Phase 3: UI

---

### Task 10: App Root & Landing Screen

**Files:**
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/components/LandingScreen.tsx`
- Create: `src/renderer/components/ProcessingScreen.tsx`

- [ ] **Step 1: Implement App root with mode routing**

```tsx
// src/renderer/App.tsx
import React, { useEffect } from 'react';
import { useTranscriptStore } from './store/transcriptStore';
import { LandingScreen } from './components/LandingScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { WatchMode } from './components/WatchMode/WatchMode';
import { ReviewMode } from './components/ReviewMode/ReviewMode';
import { ReviewCenter } from './components/ReviewCenter/ReviewCenter';

export default function App() {
  const mode = useTranscriptStore((s) => s.mode);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      {mode === 'landing' && <LandingScreen />}
      {mode === 'processing' && <ProcessingScreen />}
      {mode === 'watch' && <WatchMode />}
      {mode === 'review' && <ReviewMode />}
      {mode === 'review-center' && <ReviewCenter />}
    </div>
  );
}
```

- [ ] **Step 2: Implement LandingScreen**

```tsx
// src/renderer/components/LandingScreen.tsx
import React, { useState } from 'react';
import { useTranscriptStore } from '../store/transcriptStore';
import { Session, Sentence } from '../../types/transcript';

export function LandingScreen() {
  const { setMode, loadSession } = useTranscriptStore();
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setError(null);
    const videoPath = await window.api.openVideoDialog();
    if (!videoPath) return;

    // Check for existing session
    const existing = await window.api.loadSession(videoPath);
    if (existing) {
      loadSession(existing);
      setMode('review');
      return;
    }

    // New video — start transcription
    setMode('processing');
    try {
      const sentences: Sentence[] = await window.api.startTranscription(videoPath);
      const session: Session = {
        videoPath,
        createdAt: new Date().toISOString(),
        transcript: sentences,
      };
      await window.api.saveSession(session);
      loadSession(session);
      setMode('watch');
    } catch (e: any) {
      setMode('landing');
      setError(e.message ?? 'Transcription failed.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0' }}>Immersive English Player</h1>
      <p style={{ color: '#64748b', fontSize: 14 }}>Watch local videos and learn from every sentence.</p>
      <button
        onClick={handleOpen}
        style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, padding: '12px 32px', fontSize: 16, cursor: 'pointer', fontWeight: 600 }}
      >
        Open Video
      </button>
      {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Implement ProcessingScreen**

```tsx
// src/renderer/components/ProcessingScreen.tsx
import React, { useEffect, useState } from 'react';

export function ProcessingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    window.api.onTranscriptionProgress((p) => setProgress(Math.round(p * 100)));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
      <p style={{ color: '#94a3b8', fontSize: 16 }}>Transcribing audio...</p>
      <div style={{ width: 300, height: 6, background: '#1e293b', borderRadius: 4 }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#6366f1', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <p style={{ color: '#475569', fontSize: 13 }}>{progress}%</p>
    </div>
  );
}
```

- [ ] **Step 4: Start dev server and verify landing screen**

```bash
npm run dev
```

Expected: App shows "Open Video" button. Clicking it opens a file dialog.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/LandingScreen.tsx src/renderer/components/ProcessingScreen.tsx
git commit -m "feat: add app root mode router, landing screen, and processing screen"
```

---

### Task 11: WatchMode — Video Player & R Key

**Files:**
- Create: `src/renderer/components/WatchMode/WatchMode.tsx`
- Create: `src/renderer/components/WatchMode/VideoPlayer.tsx`

- [ ] **Step 1: Implement VideoPlayer**

```tsx
// src/renderer/components/WatchMode/VideoPlayer.tsx
import React, { useRef, forwardRef, useImperativeHandle } from 'react';

export interface VideoPlayerHandle {
  currentTime: () => number;
}

interface Props {
  videoPath: string;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(({ videoPath }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    currentTime: () => videoRef.current?.currentTime ?? 0,
  }));

  return (
    <video
      ref={videoRef}
      src={`file://${videoPath}`}
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
      controls
    />
  );
});

VideoPlayer.displayName = 'VideoPlayer';
```

- [ ] **Step 2: Implement WatchMode**

```tsx
// src/renderer/components/WatchMode/WatchMode.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { useTranscriptStore } from '../../store/transcriptStore';
import { VideoPlayer, VideoPlayerHandle } from './VideoPlayer';

export function WatchMode() {
  const { session, markSentence, setMode } = useTranscriptStore();
  const videoRef = useRef<VideoPlayerHandle>(null);
  const markedCount = session?.transcript.filter((s) => s.isMarkedByUser).length ?? 0;

  const handleMark = useCallback(() => {
    if (!session || !videoRef.current) return;
    const currentTime = videoRef.current.currentTime();
    const sentence = session.transcript.find(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );
    if (sentence && !sentence.isMarkedByUser) {
      markSentence(sentence.sentenceId);
      window.api.saveSession({ ...session });
    }
  }, [session, markSentence]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'r' || e.key === 'R') handleMark();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleMark]);

  if (!session) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>
        <VideoPlayer ref={videoRef} videoPath={session.videoPath} />
      </div>
      <div style={{ background: '#1e293b', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>{markedCount} sentence{markedCount !== 1 ? 's' : ''} marked</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleMark}
            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, padding: '6px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
          >
            ● MARK [R]
          </button>
          <button
            onClick={() => setMode('review')}
            style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
          >
            Review →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Test in dev**

```bash
npm run dev
```

Open a `.mp4` file, confirm video plays, press R during playback, confirm the marked count increments. Click "Review →" and confirm mode switches.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/WatchMode/
git commit -m "feat: add WatchMode with VideoPlayer and R key sentence marking"
```

---

### Task 12: ReviewMode — Transcript Panel

**Files:**
- Create: `src/renderer/components/ReviewMode/ReviewMode.tsx`
- Create: `src/renderer/components/ReviewMode/TranscriptPanel.tsx`

- [ ] **Step 1: Implement TranscriptPanel**

```tsx
// src/renderer/components/ReviewMode/TranscriptPanel.tsx
import React from 'react';
import { Sentence } from '../../../types/transcript';

interface Props {
  sentences: Sentence[];
  onClickSentence: (sentence: Sentence) => void;
}

function sentenceColor(s: Sentence): string {
  const hasDiagnosis =
    s.diagnostics.pronunciationFlagged || s.diagnostics.vocabularyQueries.length > 0;
  if (hasDiagnosis) return '#34d399'; // green — fully diagnosed
  if (s.isMarkedByUser) return '#fbbf24'; // amber — marked, not yet diagnosed
  return '#475569'; // gray — untouched
}

function sentenceIcon(s: Sentence): string {
  const hasDiagnosis =
    s.diagnostics.pronunciationFlagged || s.diagnostics.vocabularyQueries.length > 0;
  if (hasDiagnosis) return '✓ ';
  if (s.isMarkedByUser) return '★ ';
  return '';
}

export function TranscriptPanel({ sentences, onClickSentence }: Props) {
  return (
    <div style={{ overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
      <div style={{ fontSize: 10, color: '#475569', padding: '0 4px', marginBottom: 4 }}>TRANSCRIPT</div>
      {sentences.map((s) => (
        <div
          key={s.sentenceId}
          onClick={() => s.isMarkedByUser && onClickSentence(s)}
          style={{
            fontSize: 12,
            color: sentenceColor(s),
            padding: '6px 8px',
            borderRadius: 6,
            borderLeft: `2px solid ${s.isMarkedByUser ? sentenceColor(s) : 'transparent'}`,
            background: s.isMarkedByUser ? `${sentenceColor(s)}14` : 'transparent',
            cursor: s.isMarkedByUser ? 'pointer' : 'default',
          }}
        >
          {sentenceIcon(s)}{s.text}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement ReviewMode**

```tsx
// src/renderer/components/ReviewMode/ReviewMode.tsx
import React, { useRef, useState } from 'react';
import { useTranscriptStore } from '../../store/transcriptStore';
import { VideoPlayer, VideoPlayerHandle } from '../WatchMode/VideoPlayer';
import { TranscriptPanel } from './TranscriptPanel';
import { DiagnosticMenu } from './DiagnosticMenu';
import { Sentence } from '../../../types/transcript';

export function ReviewMode() {
  const { session, setMode } = useTranscriptStore();
  const videoRef = useRef<VideoPlayerHandle>(null);
  const [selected, setSelected] = useState<Sentence | null>(null);

  if (!session) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{ background: '#1e293b', padding: '8px 16px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={() => setMode('watch')} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', fontSize: 12 }}>← Watch</button>
        <button onClick={() => setMode('review-center')} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', fontSize: 12 }}>Review Center →</button>
      </div>
      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: video */}
        <div style={{ width: '55%', background: '#000' }}>
          <VideoPlayer ref={videoRef} videoPath={session.videoPath} />
        </div>
        {/* Right: transcript */}
        <div style={{ width: '45%', borderLeft: '1px solid #1e293b', background: '#0f172a' }}>
          <TranscriptPanel
            sentences={session.transcript}
            onClickSentence={(s) => setSelected(s)}
          />
        </div>
      </div>
      {/* Diagnostic Menu overlay */}
      {selected && (
        <DiagnosticMenu
          sentence={selected}
          transcript={session.transcript}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Test in dev**

```bash
npm run dev
```

Open a video with an existing session, confirm Review Mode shows transcript with amber/green highlights.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/ReviewMode/ReviewMode.tsx src/renderer/components/ReviewMode/TranscriptPanel.tsx
git commit -m "feat: add ReviewMode with TranscriptPanel sentence color coding"
```

---

### Task 13: DiagnosticMenu

**Files:**
- Create: `src/renderer/components/ReviewMode/DiagnosticMenu.tsx`

- [ ] **Step 1: Implement DiagnosticMenu**

```tsx
// src/renderer/components/ReviewMode/DiagnosticMenu.tsx
import React, { useState } from 'react';
import { Sentence } from '../../../types/transcript';
import { useTranscriptStore } from '../../store/transcriptStore';

interface Props {
  sentence: Sentence;
  transcript: Sentence[];
  onClose: () => void;
}

export function DiagnosticMenu({ sentence, transcript, onClose }: Props) {
  const { flagPronunciation, addVocabularyQuery, session } = useTranscriptStore();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idx = transcript.findIndex((s) => s.sentenceId === sentence.sentenceId);
  const prev = idx > 0 ? transcript[idx - 1] : undefined;
  const next = idx < transcript.length - 1 ? transcript[idx + 1] : undefined;

  async function handleVocabulary() {
    if (!selectedWord || !session) return;
    setLoading(true);
    setError(null);
    try {
      const aiExplanation = await window.api.callLLM({
        sentenceId: sentence.sentenceId,
        selectedWord,
        type: 'vocabulary',
        currentSentence: sentence.text,
      });
      addVocabularyQuery(sentence.sentenceId, { selectedWord, type: 'vocabulary', aiExplanation });
      window.api.saveSession(session);
    } catch (e: any) {
      setError(e.message ?? 'LLM call failed. Try again.');
    }
    setLoading(false);
  }

  async function handleSlang() {
    if (!selectedWord || !session) return;
    setLoading(true);
    setError(null);
    try {
      const aiExplanation = await window.api.callLLM({
        sentenceId: sentence.sentenceId,
        selectedWord,
        type: 'slang',
        currentSentence: sentence.text,
        prevSentence: prev?.text,
        nextSentence: next?.text,
      });
      addVocabularyQuery(sentence.sentenceId, { selectedWord, type: 'slang', aiExplanation });
      window.api.saveSession(session);
    } catch (e: any) {
      setError(e.message ?? 'LLM call failed. Try again.');
    }
    setLoading(false);
  }

  function handlePronunciation() {
    if (!session) return;
    flagPronunciation(sentence.sentenceId);
    window.api.saveSession(session);
    onClose();
  }

  const existingQueries = sentence.diagnostics.vocabularyQueries;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, width: 560, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Diagnostic</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        {/* Sentence text as word chips */}
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Select a word or phrase:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
          {sentence.words.map((w, i) => (
            <span
              key={i}
              onClick={() => setSelectedWord(w.word)}
              style={{
                padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 14,
                background: selectedWord === w.word ? '#6366f1' : '#0f172a',
                color: selectedWord === w.word ? '#fff' : '#94a3b8',
              }}
            >
              {w.word}
            </span>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button onClick={handlePronunciation} style={{ flex: 1, background: 'rgba(99,102,241,0.15)', border: '1px solid #6366f1', borderRadius: 8, padding: '8px 12px', color: '#818cf8', cursor: 'pointer', fontSize: 13 }}>
            🔊 Pronunciation
          </button>
          <button onClick={handleVocabulary} disabled={!selectedWord || loading} style={{ flex: 1, background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', borderRadius: 8, padding: '8px 12px', color: '#34d399', cursor: selectedWord ? 'pointer' : 'not-allowed', fontSize: 13, opacity: selectedWord ? 1 : 0.5 }}>
            📖 Vocabulary
          </button>
          <button onClick={handleSlang} disabled={!selectedWord || loading} style={{ flex: 1, background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 12px', color: '#fbbf24', cursor: selectedWord ? 'pointer' : 'not-allowed', fontSize: 13, opacity: selectedWord ? 1 : 0.5 }}>
            🗣 Slang / Idiom
          </button>
        </div>

        {loading && <p style={{ color: '#64748b', fontSize: 12 }}>Asking AI...</p>}
        {error && (
          <p style={{ color: '#ef4444', fontSize: 12 }}>
            {error} <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 12 }}>Retry</button>
          </p>
        )}

        {/* Existing explanations */}
        {existingQueries.map((q, i) => (
          <div key={i} style={{ marginTop: 12, background: '#0f172a', borderRadius: 8, padding: 12, borderLeft: `2px solid ${q.type === 'vocabulary' ? '#10b981' : '#f59e0b'}` }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
              <strong style={{ color: q.type === 'vocabulary' ? '#34d399' : '#fbbf24' }}>{q.selectedWord}</strong>
              {' · '}{q.type}
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{q.aiExplanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test in dev**

```bash
npm run dev
```

Click a marked sentence in Review Mode. Confirm: word chips appear, Pronunciation closes menu, Vocabulary/Slang buttons require a word selection, AI result appears inline.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ReviewMode/DiagnosticMenu.tsx
git commit -m "feat: add DiagnosticMenu with word chips, 3-button diagnosis, and inline AI results"
```

---

## Phase 4: Review & Export

---

### Task 14: ExportService

**Files:**
- Create: `src/main/services/ExportService.ts`

- [ ] **Step 1: Implement ExportService — Markdown**

```typescript
// src/main/services/ExportService.ts
import fs from 'fs/promises';
import path from 'path';
import { Session } from '../../types/transcript';
import { BrowserWindow } from 'electron';

export class ExportService {
  async export(session: Session, format: 'markdown' | 'pdf'): Promise<string> {
    const md = this.buildMarkdown(session);
    const dir = path.dirname(session.videoPath);
    const base = path.basename(session.videoPath, path.extname(session.videoPath));
    const mdPath = path.join(dir, `${base}-notes.md`);

    await fs.writeFile(mdPath, md, 'utf-8');

    if (format === 'pdf') {
      return this.exportPdf(md, dir, base);
    }
    return mdPath;
  }

  private buildMarkdown(session: Session): string {
    const lines: string[] = [
      `# English Learning Notes`,
      `**Video:** ${path.basename(session.videoPath)}`,
      `**Date:** ${new Date(session.createdAt).toLocaleDateString()}`,
      '',
      '---',
      '',
    ];

    const marked = session.transcript.filter((s) => s.isMarkedByUser);

    // Vocabulary & Slang section
    const withQueries = marked.filter((s) => s.diagnostics.vocabularyQueries.length > 0);
    if (withQueries.length > 0) {
      lines.push('## Vocabulary & Slang Notes', '');
      for (const s of withQueries) {
        lines.push(`> "${s.text}"`, '');
        for (const q of s.diagnostics.vocabularyQueries) {
          lines.push(`**${q.selectedWord}** *(${q.type})*`);
          lines.push(q.aiExplanation, '');
        }
      }
    }

    // Pronunciation section
    const pronunciation = marked.filter((s) => s.diagnostics.pronunciationFlagged);
    if (pronunciation.length > 0) {
      lines.push('## Pronunciation Review', '');
      for (const s of pronunciation) {
        lines.push(`- [${s.startTime.toFixed(1)}s] "${s.text}"`);
      }
    }

    return lines.join('\n');
  }

  private async exportPdf(md: string, dir: string, base: string): Promise<string> {
    // Use Electron's printToPDF via a hidden window
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
    const html = `<html><body><pre style="font-family:sans-serif;white-space:pre-wrap;padding:32px">${md.replace(/</g, '&lt;')}</pre></body></html>`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await win.webContents.printToPDF({});
    win.close();
    const pdfPath = path.join(dir, `${base}-notes.pdf`);
    await fs.writeFile(pdfPath, pdfBuffer);
    return pdfPath;
  }
}
```

- [ ] **Step 2: Test export via dev**

```bash
npm run dev
```

After diagnosing a sentence, trigger export from the UI (add a temporary export button to ReviewMode) and verify `.md` and `.pdf` files appear next to the video.

- [ ] **Step 3: Commit**

```bash
git add src/main/services/ExportService.ts
git commit -m "feat: add ExportService for Markdown and PDF generation"
```

---

### Task 15: AudioLoopDeck & ReviewCenter

**Files:**
- Create: `src/renderer/components/ReviewCenter/ReviewCenter.tsx`
- Create: `src/renderer/components/ReviewCenter/AudioLoopDeck.tsx`

- [ ] **Step 1: Implement AudioLoopDeck**

```tsx
// src/renderer/components/ReviewCenter/AudioLoopDeck.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Sentence } from '../../../types/transcript';

interface Props {
  sentences: Sentence[];
}

export function AudioLoopDeck({ sentences }: Props) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const current = sentences[index];

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current) return;

    function handleTimeUpdate() {
      if (video && video.currentTime >= current.endTime) {
        video.currentTime = current.startTime;
        video.play();
      }
    }

    video.currentTime = current.startTime;
    video.play();
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [index, current]);

  if (sentences.length === 0) {
    return <p style={{ color: '#64748b', fontSize: 13 }}>No sentences flagged for pronunciation review.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#94a3b8', fontSize: 13 }}>Looping: "{current.text}"</p>
      <p style={{ color: '#475569', fontSize: 11 }}>{index + 1} of {sentences.length}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>← Prev</button>
        <button onClick={() => setIndex(Math.min(sentences.length - 1, index + 1))} disabled={index === sentences.length - 1} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>Next →</button>
      </div>
      {/* Hidden video for audio loop */}
      <video ref={videoRef} src={`file://`} style={{ display: 'none' }} />
    </div>
  );
}
```

Note: The `src` for the hidden video must include the actual video path. Pass it as a prop from ReviewCenter:

Update `AudioLoopDeck` props to include `videoPath: string`, and set `src={`file://${videoPath}`}`.

- [ ] **Step 2: Implement ReviewCenter**

```tsx
// src/renderer/components/ReviewCenter/ReviewCenter.tsx
import React, { useState } from 'react';
import { useTranscriptStore } from '../../store/transcriptStore';
import { AudioLoopDeck } from './AudioLoopDeck';

export function ReviewCenter() {
  const { session, setMode } = useTranscriptStore();
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  if (!session) return null;

  const pronunciationSentences = session.transcript.filter(
    (s) => s.diagnostics.pronunciationFlagged
  );

  async function handleExport(format: 'markdown' | 'pdf') {
    try {
      const filePath = await window.api.exportSession(session!, format);
      setExportStatus(`Saved to ${filePath}`);
    } catch (e: any) {
      setExportStatus(`Export failed: ${e.message}`);
    }
  }

  return (
    <div style={{ padding: 32, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700 }}>Review Center</h2>
        <button onClick={() => setMode('review')} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>← Back</button>
      </div>

      <h3 style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>🔊 Pronunciation Loop</h3>
      <AudioLoopDeck sentences={pronunciationSentences} videoPath={session.videoPath} />

      <div style={{ marginTop: 40 }}>
        <h3 style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>📤 Export Notes</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => handleExport('markdown')} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid #6366f1', borderRadius: 8, padding: '8px 20px', color: '#818cf8', cursor: 'pointer', fontSize: 13 }}>Export Markdown</button>
          <button onClick={() => handleExport('pdf')} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', borderRadius: 8, padding: '8px 20px', color: '#34d399', cursor: 'pointer', fontSize: 13 }}>Export PDF</button>
        </div>
        {exportStatus && <p style={{ color: '#64748b', fontSize: 12, marginTop: 10 }}>{exportStatus}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Test full flow in dev**

```bash
npm run dev
```

1. Open a video → transcribe → Watch Mode
2. Press R on a few sentences → switch to Review Mode
3. Click a marked sentence → diagnose with Pronunciation → close
4. Go to Review Center → confirm AudioLoopDeck shows pronunciation sentences, loops audio
5. Export Markdown and PDF → verify files appear next to video

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/ReviewCenter/
git commit -m "feat: add ReviewCenter with AudioLoopDeck and Markdown/PDF export"
```

---

### Task 16: Run All Tests

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Fix any failures before continuing**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: all tests passing, app feature-complete"
```

---

## Done

The app is feature-complete when:
- [ ] New video → FFmpeg extracts audio → Whisper transcribes → Watch Mode loads
- [ ] R key marks the current sentence in real time, auto-saves
- [ ] Review Mode shows amber/green transcript, diagnostic menu works
- [ ] Vocabulary and Slang queries call LLM with correct context window
- [ ] Re-opening a known video skips processing and loads Review Mode
- [ ] AudioLoopDeck loops pronunciation-flagged sentences
- [ ] Export produces `.md` and `.pdf` next to the video file
- [ ] All unit and integration tests pass
