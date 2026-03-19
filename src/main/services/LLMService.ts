import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { LLMRequest, AppSettings } from '../../types/transcript';

export class LLMService {
  buildPrompt(req: LLMRequest): string {
    if (req.type === 'vocabulary') {
      return [
        `Context sentence: "${req.currentSentence}"`,
        `Selected word: "${req.selectedWord}"`,
        '',
        `Explain what "${req.selectedWord}" means in the context of this specific sentence.`,
        'Be concise. Provide one example sentence. English only.',
      ].join('\n');
    }

    // slang / idiom
    const lines: string[] = [];
    if (req.prevSentence) lines.push(`Previous sentence: "${req.prevSentence}"`);
    lines.push(`Current sentence: "${req.currentSentence}"`);
    if (req.nextSentence) lines.push(`Next sentence: "${req.nextSentence}"`);
    lines.push(`Selected phrase: "${req.selectedWord}"`);
    lines.push('');
    lines.push(
      `Explain what "${req.selectedWord}" means in this conversational context, including any cultural nuance or idiomatic usage. Be concise. Provide one example sentence. English only.`
    );
    return lines.join('\n');
  }

  async explain(req: LLMRequest, settings: AppSettings): Promise<string> {
    const prompt = this.buildPrompt(req);

    const timeout = AbortSignal.timeout(30_000);

    if (settings.llmProvider === 'openai') {
      const client = new OpenAI({ apiKey: settings.openaiApiKey });
      const response = await client.chat.completions.create(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
        },
        { signal: timeout }
      );
      return response.choices[0].message.content ?? '';
    }

    // anthropic
    const client = new Anthropic({ apiKey: settings.anthropicApiKey });
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: timeout }
    );
    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }
}
