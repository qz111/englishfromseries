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
    store = new SessionStore(tmpDir);
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
    await new Promise((r) => setTimeout(r, 100));
    const loaded = await store.load(videoPath);
    expect(loaded).toEqual(session);
  });

  it('session path follows <video>.session.json convention', () => {
    const videoPath = '/some/path/friends-s01e01.mp4';
    expect(store.sessionPath(videoPath)).toBe('/some/path/friends-s01e01.mp4.session.json');
  });

  // --- Index tests ---

  it('listPaths returns empty array when no index exists', async () => {
    expect(await store.listPaths()).toEqual([]);
  });

  it('save registers the videoPath in the index', async () => {
    const videoPath = path.join(tmpDir, 'video.mp4');
    store.save(makeSession(videoPath));
    await new Promise((r) => setTimeout(r, 100));
    expect(await store.listPaths()).toContain(videoPath);
  });

  it('save moves an existing path to the end (most recent last)', async () => {
    const p1 = path.join(tmpDir, 'v1.mp4');
    const p2 = path.join(tmpDir, 'v2.mp4');
    store.save(makeSession(p1));
    store.save(makeSession(p2));
    store.save(makeSession(p1)); // re-open p1
    await new Promise((r) => setTimeout(r, 200));
    const paths = await store.listPaths();
    expect(paths[paths.length - 1]).toBe(p1);
    expect(paths[paths.length - 2]).toBe(p2);
  });

  it('removePath removes the entry from the index', async () => {
    const videoPath = path.join(tmpDir, 'video.mp4');
    store.save(makeSession(videoPath));
    await new Promise((r) => setTimeout(r, 100));
    store.removePath(videoPath);
    await new Promise((r) => setTimeout(r, 100));
    expect(await store.listPaths()).not.toContain(videoPath);
  });

  it('removePath on a non-existent path does not throw', async () => {
    store.removePath(path.join(tmpDir, 'ghost.mp4'));
    await new Promise((r) => setTimeout(r, 100));
    expect(await store.listPaths()).toEqual([]);
  });
});
