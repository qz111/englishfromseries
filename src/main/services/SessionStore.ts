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
