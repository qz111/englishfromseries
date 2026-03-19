import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import { IPC } from './channels';
import { SessionStore } from '../services/SessionStore';
import { loadSettings, saveSettings } from '../settings';
import { Session, AppSettings, LLMRequest } from '../../types/transcript';
import { FFmpegService } from '../services/FFmpegService';
import { WhisperService } from '../services/WhisperService';
import { LLMService } from '../services/LLMService';
import { ExportService } from '../services/ExportService';

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
    try {
      const sentences = await whisperService.transcribe(
        audioPath,
        settings.whisperApiKey,
        (p) => mainWindow.webContents.send(IPC.TRANSCRIPTION_PROGRESS, p)
      );
      return sentences;
    } finally {
      fs.unlink(audioPath).catch(() => {});
    }
  });

  ipcMain.handle(IPC.CALL_LLM, async (_e, req: LLMRequest) => {
    const settings = await loadSettings();
    return llmService.explain(req, settings);
  });

  ipcMain.handle(IPC.EXPORT_SESSION, async (_e, session: Session, format: 'markdown' | 'pdf') => {
    return exportService.export(session, format);
  });

  ipcMain.handle(IPC.GET_SETTINGS, async () => loadSettings());

  ipcMain.handle(IPC.SAVE_SETTINGS, async (_e, settings: AppSettings) => saveSettings(settings));
}
