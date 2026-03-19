import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath = require('ffmpeg-static') as string;

export class FFmpegService {
  async extractAudio(videoPath: string): Promise<string> {
    const audioPath = path.join(os.tmpdir(), `efs-audio-${Date.now()}.wav`);
    await this._run([
      '-i', videoPath,
      '-vn',          // no video
      '-ar', '16000', // 16kHz sample rate (Whisper optimal)
      '-ac', '1',     // mono
      '-y',           // overwrite output if exists
      audioPath,
    ]);
    return audioPath;
  }

  private _run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited ${code}: ${stderr}`));
      });
    });
  }
}
