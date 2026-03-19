import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../main/ipc/channels';
import { Session, AppSettings, LLMRequest } from '../types/transcript';

contextBridge.exposeInMainWorld('api', {
  openVideoDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.OPEN_VIDEO_DIALOG),

  loadSession: (videoPath: string): Promise<Session | null> =>
    ipcRenderer.invoke(IPC.LOAD_SESSION, videoPath),

  saveSession: (session: Session): Promise<void> =>
    ipcRenderer.invoke(IPC.SAVE_SESSION, session),

  startTranscription: (videoPath: string): Promise<import('../types/transcript').Sentence[]> =>
    ipcRenderer.invoke(IPC.START_TRANSCRIPTION, videoPath),

  callLLM: (req: LLMRequest): Promise<string> =>
    ipcRenderer.invoke(IPC.CALL_LLM, req),

  exportSession: (session: Session, format: 'markdown' | 'pdf'): Promise<string> =>
    ipcRenderer.invoke(IPC.EXPORT_SESSION, session, format),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.GET_SETTINGS),

  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke(IPC.SAVE_SETTINGS, settings),

  onTranscriptionProgress: (cb: (progress: number) => void): void => {
    ipcRenderer.on(IPC.TRANSCRIPTION_PROGRESS, (_e, p) => cb(p));
  },
});
