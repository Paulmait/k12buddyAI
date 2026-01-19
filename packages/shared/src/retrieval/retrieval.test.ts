import { describe, it, expect } from 'vitest';
import {
  tokenize,
  extractQueryTerms,
  scoreChunk,
  scoreChunks,
  containsMathContent,
  highlightMatches,
} from './scorer';
import {
  retrieveChunks,
  formatChunksForPrompt,
  getRetrievedPageNumbers,
  buildCitations,
  hasMinimumContent,
  getRetrievalSummary,
} from './retriever';
import type { RetrievableChunk } from './types';

// Sample chunks for testing
const sampleChunks: RetrievableChunk[] = [
  {
    id: 'chunk-1',
    textbook_id: 'textbook-1',
    lesson_id: 'lesson-1',
    page_number: 10,
    chunk_index: 0,
    content: 'Addition is the process of combining two or more numbers to find their sum. For example, 5 + 3 = 8.',
    token_estimate: 25,
  },
  {
    id: 'chunk-2',
    textbook_id: 'textbook-1',
    lesson_id: 'lesson-1',
    page_number: 11,
    chunk_index: 0,
    content: 'Subtraction is the inverse of addition. When we subtract, we find the difference between numbers. For example, 8 - 3 = 5.',
    token_estimate: 30,
  },
  {
    id: 'chunk-3',
    textbook_id: 'textbook-1',
    lesson_id: 'lesson-2',
    page_number: 20,
    chunk_index: 0,
    content: 'Multiplication is repeated addition. When you multiply 3 × 4, you add 3 four times: 3 + 3 + 3 + 3 = 12.',
    token_estimate: 30,
  },
  {
    id: 'chunk-4',
    textbook_id: 'textbook-1',
    lesson_id: 'lesson-2',
    page_number: 21,
    chunk_index: 0,
    content: 'Division is the inverse of multiplication. It splits a number into equal parts.',
    token_estimate: 20,
  },
  {
    id: 'chunk-5',
    textbook_id: 'textbook-2',
    lesson_id: null,
    page_number: 5,
    chunk_index: 0,
    content: 'The water cycle describes how water moves through the environment through evaporation, condensation, and precipitation.',
    token_estimate: 25,
  },
];

describe('Tokenizer', () => {
  it('should tokenize simple text', () => {
    const tokens = tokenize('Hello world');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
  });

  it('should remove stop words', () => {
    const tokens = tokenize('This is a test of the system');
    expect(tokens).not.toContain('this');
    expect(tokens).not.toContain('is');
    expect(tokens).not.toContain('the');
    expect(tokens).toContain('test');
    expect(tokens).toContain('system');
  });

  it('should preserve math terms that might look like stop words', () => {
    const tokens = tokenize('Add the numbers to find the sum');
    expect(tokens).toContain('add');
    expect(tokens).toContain('numbers');
    expect(tokens).toContain('sum');
  });

  it('should handle punctuation', () => {
    const tokens = tokenize('The answer is five plus three equals eight');
    expect(tokens).toContain('answer');
    expect(tokens).toContain('equals');
    expect(tokens).toContain('five');
    expect(tokens).toContain('three');
    expect(tokens).toContain('eight');
  });
});

describe('Query Term Extraction', () => {
  it('should extract terms from query', () => {
    const terms = extractQueryTerms('How do I add fractions?');
    expect(terms).toContain('add');
    expect(terms).toContain('fractions');
  });

  it('should handle stemmed versions', () => {
    const terms = extractQueryTerms('multiplying numbers');
    expect(terms).toContain('multiplying');
    expect(terms).toContain('multiply'); // Stemmed version
  });
});

describe('Chunk Scoring', () => {
  it('should score relevant chunks higher', () => {
    const queryTerms = extractQueryTerms('addition');

    const additionScore = scoreChunk(sampleChunks[0]!, queryTerms);
    const waterCycleScore = scoreChunk(sampleChunks[4]!, queryTerms);

    expect(additionScore.score).toBeGreaterThan(waterCycleScore.score);
    expect(additionScore.matched_terms).toContain('addition');
  });

  it('should track matched terms', () => {
    const queryTerms = extractQueryTerms('addition subtraction');

    const score = scoreChunk(sampleChunks[1]!, queryTerms);
    expect(score.matched_terms).toContain('subtraction');
    expect(score.matched_terms).toContain('addition');
  });

  it('should boost lesson matches', () => {
    const queryTerms = extractQueryTerms('numbers');

    const withBoost = scoreChunk(sampleChunks[0]!, queryTerms, {
      targetLessonId: 'lesson-1',
      lessonBoost: 0.5,
    });

    const withoutBoost = scoreChunk(sampleChunks[0]!, queryTerms);

    expect(withBoost.score).toBeGreaterThan(withoutBoost.score);
  });
});

describe('Score Chunks (Batch)', () => {
  it('should score and sort multiple chunks', () => {
    const scored = scoreChunks(sampleChunks, 'addition');

    expect(scored.length).toBe(sampleChunks.length);
    // Chunks mentioning addition should score higher than unrelated chunks
    const additionChunks = scored.filter(s =>
      s.chunk.content.toLowerCase().includes('addition')
    );
    const unrelatedChunk = scored.find(s => s.chunk.id === 'chunk-5'); // Water cycle
    expect(additionChunks[0]?.score).toBeGreaterThan(unrelatedChunk?.score ?? 0);
  });

  it('should rank related content higher', () => {
    const scored = scoreChunks(sampleChunks, 'multiplication repeated addition');

    // Multiplication chunk should rank high
    const topChunkIds = scored.slice(0, 3).map(s => s.chunk.id);
    expect(topChunkIds).toContain('chunk-3');
  });
});

describe('Chunk Retrieval', () => {
  it('should retrieve chunks for a textbook', () => {
    const result = retrieveChunks(sampleChunks, {
      query: 'addition',
      textbook_id: 'textbook-1',
    });

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks.every(c => c.chunk.textbook_id === 'textbook-1')).toBe(true);
  });

  it('should respect top_k limit', () => {
    const result = retrieveChunks(sampleChunks, {
      query: 'math',
      textbook_id: 'textbook-1',
    }, {
      top_k: 2,
    });

    expect(result.chunks.length).toBeLessThanOrEqual(2);
  });

  it('should respect token budget', () => {
    const result = retrieveChunks(sampleChunks, {
      query: 'addition subtraction',
      textbook_id: 'textbook-1',
    }, {
      max_tokens: 50, // Very tight budget
    });

    expect(result.total_tokens).toBeLessThanOrEqual(50);
  });

  it('should filter by page range', () => {
    const result = retrieveChunks(sampleChunks, {
      query: 'math',
      textbook_id: 'textbook-1',
    }, {
      page_range: { start: 10, end: 15 },
    });

    result.chunks.forEach(c => {
      expect(c.chunk.page_number).toBeGreaterThanOrEqual(10);
      expect(c.chunk.page_number).toBeLessThanOrEqual(15);
    });
  });

  it('should include query terms in result', () => {
    const result = retrieveChunks(sampleChunks, {
      query: 'How do I add numbers?',
      textbook_id: 'textbook-1',
    });

    expect(result.query_terms).toContain('add');
    expect(result.query_terms).toContain('numbers');
  });
});

describe('Format Chunks for Prompt', () => {
  it('should format chunks with page numbers', () => {
    const scored = scoreChunks(sampleChunks.slice(0, 2), 'addition');
    const formatted = formatChunksForPrompt(scored);

    expect(formatted).toContain('[Page');
    expect(formatted).toContain('--- Excerpt 1');
  });

  it('should handle empty chunks', () => {
    const formatted = formatChunksForPrompt([]);
    expect(formatted).toContain('No relevant');
  });

  it('should truncate long content', () => {
    const longChunk: RetrievableChunk = {
      id: 'long-chunk',
      textbook_id: 'tb-1',
      lesson_id: null,
      page_number: 1,
      chunk_index: 0,
      content: 'word '.repeat(1000),
    };

    const scored = scoreChunks([longChunk], 'word');
    const formatted = formatChunksForPrompt(scored, { maxCharsPerChunk: 100 });

    expect(formatted).toContain('...');
  });
});

describe('Citation Building', () => {
  it('should build citations from scored chunks', () => {
    const scored = scoreChunks(sampleChunks.slice(0, 2), 'addition');
    const citations = buildCitations(scored);

    expect(citations.length).toBe(2);
    expect(citations[0]).toHaveProperty('chunk_id');
    expect(citations[0]).toHaveProperty('page_number');
    expect(citations[0]).toHaveProperty('relevance_score');
  });
});

describe('Page Number Extraction', () => {
  it('should extract unique page numbers', () => {
    const scored = scoreChunks(sampleChunks.slice(0, 3), 'math');
    const pages = getRetrievedPageNumbers(scored);

    expect(pages).toEqual([10, 11, 20]);
  });
});

describe('Content Sufficiency Check', () => {
  it('should detect insufficient content', () => {
    const result = retrieveChunks(sampleChunks, {
      query: 'quantum physics', // Not in our sample data
      textbook_id: 'textbook-1',
    });

    expect(hasMinimumContent(result, 1, 0.5)).toBe(false);
  });

  it('should confirm sufficient content', () => {
    const result = retrieveChunks(sampleChunks, {
      query: 'addition',
      textbook_id: 'textbook-1',
    });

    expect(hasMinimumContent(result, 1, 0.1)).toBe(true);
  });
});

describe('Retrieval Summary', () => {
  it('should generate readable summary', () => {
    const result = retrieveChunks(sampleChunks, {
      query: 'addition',
      textbook_id: 'textbook-1',
    });

    const summary = getRetrievalSummary(result);

    expect(summary).toContain('Found');
    expect(summary).toContain('chunks');
    expect(summary).toContain('pages:');
    expect(summary).toContain('tokens');
  });
});

describe('Math Content Detection', () => {
  it('should detect math expressions', () => {
    expect(containsMathContent('5 + 3 = 8')).toBe(true);
    expect(containsMathContent('1/2 of the pie')).toBe(true);
    expect(containsMathContent('The equation shows')).toBe(true);
  });

  it('should not false positive on regular text', () => {
    expect(containsMathContent('The water cycle is important')).toBe(false);
  });
});

describe('Match Highlighting', () => {
  it('should highlight matched terms', () => {
    const highlighted = highlightMatches(
      'Addition is the process of adding numbers',
      ['addition', 'adding']
    );

    expect(highlighted).toContain('**Addition**');
    expect(highlighted).toContain('**adding**');
  });
});
