import { describe, it, expect } from 'vitest';
import { LLMService } from '../../src/main/services/LLMService';
import { LLMRequest } from '../../src/types/transcript';

describe('LLMService — prompt building', () => {
  const service = new LLMService();

  it('vocabulary prompt contains only current sentence', () => {
    const prompt = service.buildPrompt({
      sentenceId: 's_001',
      selectedWord: 'moot',
      type: 'vocabulary',
      currentSentence: "That's a moot point.",
      prevSentence: 'Previous sentence.',
      nextSentence: 'Next sentence.',
    });
    expect(prompt).toContain("That's a moot point.");
    expect(prompt).toContain('moot');
    expect(prompt).not.toContain('Previous sentence.');
    expect(prompt).not.toContain('Next sentence.');
  });

  it('slang prompt includes prev, current, and next sentences', () => {
    const prompt = service.buildPrompt({
      sentenceId: 's_001',
      selectedWord: 'moo point',
      type: 'slang',
      currentSentence: "It's a moo point.",
      prevSentence: 'I mean.',
      nextSentence: "Like a cow's opinion.",
    });
    expect(prompt).toContain("It's a moo point.");
    expect(prompt).toContain('I mean.');
    expect(prompt).toContain("Like a cow's opinion.");
  });

  it('slang prompt omits prev sentence when undefined', () => {
    const prompt = service.buildPrompt({
      sentenceId: 's_001',
      selectedWord: 'moo point',
      type: 'slang',
      currentSentence: "It's a moo point.",
      nextSentence: "Like a cow's opinion.",
    });
    expect(prompt).not.toContain('Previous sentence:');
    expect(prompt).toContain("It's a moo point.");
  });

  it('slang prompt omits next sentence when undefined', () => {
    const prompt = service.buildPrompt({
      sentenceId: 's_001',
      selectedWord: 'moo point',
      type: 'slang',
      currentSentence: "It's a moo point.",
    });
    expect(prompt).not.toContain('Next sentence:');
  });
});
