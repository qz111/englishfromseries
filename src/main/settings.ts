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
  const target = settingsPath();
  const tmp = target + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(settings, null, 2), 'utf-8');
  await fs.rename(tmp, target);
}
