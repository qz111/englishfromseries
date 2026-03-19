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
