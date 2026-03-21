import fs from 'fs/promises';
import path from 'path';
import { Session } from '../../types/transcript';

export class SessionStore {
  private saveQueue: Promise<void> = Promise.resolve();
  private readonly userDataPath: string;

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
  }

  private get indexPath(): string {
    return path.join(this.userDataPath, 'session-index.json');
  }

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

  async listPaths(): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  removePath(videoPath: string): void {
    this.saveQueue = this.saveQueue.then(() => this._removeFromIndex(videoPath));
  }

  private async _write(session: Session): Promise<void> {
    // Write session file (atomic)
    const dest = this.sessionPath(session.videoPath);
    const tmp = `${dest}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(session, null, 2), 'utf-8');
    await fs.rename(tmp, dest);

    // Update index: remove existing entry + push to end (most recent last)
    const paths = await this.listPaths();
    const updated = paths.filter((p) => p !== session.videoPath);
    updated.push(session.videoPath);
    await this._writeIndex(updated);
  }

  private async _removeFromIndex(videoPath: string): Promise<void> {
    const paths = await this.listPaths();
    await this._writeIndex(paths.filter((p) => p !== videoPath));
  }

  private async _writeIndex(paths: string[]): Promise<void> {
    await fs.mkdir(this.userDataPath, { recursive: true });
    const tmp = `${this.indexPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(paths, null, 2), 'utf-8');
    await fs.rename(tmp, this.indexPath);
  }
}
