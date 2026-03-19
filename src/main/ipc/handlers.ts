import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC } from './channels';
import { SessionStore } from '../services/SessionStore';
import { loadSettings, saveSettings } from '../settings';
import { Session, AppSettings } from '../../types/transcript';

const sessionStore = new SessionStore();

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

  ipcMain.handle(IPC.START_TRANSCRIPTION, async () => {
    // Placeholder — implemented in Task 8 (WhisperService)
    throw new Error('WhisperService not yet implemented');
  });

  ipcMain.handle(IPC.CALL_LLM, async () => {
    // Placeholder — implemented in Task 9 (LLMService)
    throw new Error('LLMService not yet implemented');
  });

  ipcMain.handle(IPC.EXPORT_SESSION, async () => {
    // Placeholder — implemented in Task 14 (ExportService)
    throw new Error('ExportService not yet implemented');
  });

  ipcMain.handle(IPC.GET_SETTINGS, async () => loadSettings());

  ipcMain.handle(IPC.SAVE_SETTINGS, async (_e, settings: AppSettings) => saveSettings(settings));
}
