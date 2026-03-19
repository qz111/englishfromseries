import fs from 'fs/promises';
import path from 'path';
import { BrowserWindow } from 'electron';
import { Session } from '../../types/transcript';

export class ExportService {
  async export(session: Session, format: 'markdown' | 'pdf'): Promise<string> {
    const md = this.buildMarkdown(session);
    const dir = path.dirname(session.videoPath);
    const base = path.basename(session.videoPath, path.extname(session.videoPath));
    const mdPath = path.join(dir, `${base}-notes.md`);

    await fs.writeFile(mdPath, md, 'utf-8');

    if (format === 'pdf') {
      return this.exportPdf(md, dir, base);
    }
    return mdPath;
  }

  buildMarkdown(session: Session): string {
    const lines: string[] = [
      `# English Learning Notes`,
      `**Video:** ${path.basename(session.videoPath)}`,
      `**Date:** ${new Date(session.createdAt).toLocaleDateString()}`,
      '',
      '---',
      '',
    ];

    const marked = session.transcript.filter((s) => s.isMarkedByUser);

    // Vocabulary & Slang section
    const withQueries = marked.filter((s) => s.diagnostics.vocabularyQueries.length > 0);
    if (withQueries.length > 0) {
      lines.push('## Vocabulary & Slang Notes', '');
      for (const s of withQueries) {
        lines.push(`> "${s.text}"`, '');
        for (const q of s.diagnostics.vocabularyQueries) {
          lines.push(`**${q.selectedWord}** *(${q.type})*`);
          lines.push(q.aiExplanation, '');
        }
      }
    }

    // Pronunciation section
    const pronunciation = marked.filter((s) => s.diagnostics.pronunciationFlagged);
    if (pronunciation.length > 0) {
      lines.push('## Pronunciation Review', '');
      for (const s of pronunciation) {
        lines.push(`- [${s.startTime.toFixed(1)}s] "${s.text}"`);
      }
    }

    return lines.join('\n');
  }

  private async exportPdf(md: string, dir: string, base: string): Promise<string> {
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
    const escaped = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html><body><pre style="font-family:sans-serif;white-space:pre-wrap;padding:32px;font-size:14px;line-height:1.6">${escaped}</pre></body></html>`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await win.webContents.printToPDF({});
    win.close();
    const pdfPath = path.join(dir, `${base}-notes.pdf`);
    await fs.writeFile(pdfPath, pdfBuffer);
    return pdfPath;
  }
}
