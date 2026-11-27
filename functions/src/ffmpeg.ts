import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

/** Runs ffmpeg. Resolves with what it wrote to stderr; rejects with the end of it if ffmpeg fails. */
export function ffmpeg(args: string[], onStdout?: (chunk: Buffer) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg isn’t available on this platform.'));
    const child = spawn(ffmpegPath as unknown as string, ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', (chunk: Buffer) => onStdout?.(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      log += chunk.toString();
      // Keep only the end; a long render logs a lot of progress.
      if (log.length > 200_000) log = log.slice(-100_000);
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(log) : reject(new Error(`ffmpeg failed (${code}): ${log.slice(-1500)}`))));
  });
}
