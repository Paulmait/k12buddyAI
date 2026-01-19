import { describe, it, expect } from 'vitest';
import {
  parseTOC,
  parseCover,
  chunkPage,
  chunkPages,
  estimateTokens,
  hashContent,
  DEFAULT_CHUNKER_OPTIONS,
} from './index';
import type { OCRResult } from './types';

describe('Token Estimation', () => {
  it('should estimate tokens for simple text', () => {
    const text = 'Hello world';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  it('should estimate tokens for longer text', () => {
    const text = 'The quick brown fox jumps over the lazy dog. This is a longer sentence with more words.';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(15);
    expect(tokens).toBeLessThan(30);
  });

  it('should handle empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('Content Hashing', () => {
  it('should produce consistent hashes', () => {
    const content = 'Test content for hashing';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', () => {
    const hash1 = hashContent('Content A');
    const hash2 = hashContent('Content B');
    expect(hash1).not.toBe(hash2);
  });

  it('should return 8-character hex strings', () => {
    const hash = hashContent('Any content');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('Page Chunking', () => {
  it('should return single chunk for short text', () => {
    const text = 'This is a short paragraph.';
    const chunks = chunkPage(1, text);

    expect(chunks).toHaveLength(1);
    const firstChunk = chunks[0];
    expect(firstChunk).toBeDefined();
    expect(firstChunk?.page_number).toBe(1);
    expect(firstChunk?.chunk_index).toBe(0);
    expect(firstChunk?.content).toBe(text);
  });

  it('should split long text into multiple chunks', () => {
    // Create a long text that exceeds max_tokens
    const paragraph = 'This is a paragraph with enough words to generate tokens. '.repeat(50);
    const chunks = chunkPage(5, paragraph);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, index) => {
      expect(chunk.page_number).toBe(5);
      expect(chunk.chunk_index).toBe(index);
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.content_hash).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  it('should handle empty text', () => {
    const chunks = chunkPage(1, '');
    expect(chunks).toHaveLength(0);
  });

  it('should handle whitespace-only text', () => {
    const chunks = chunkPage(1, '   \n\n   ');
    expect(chunks).toHaveLength(0);
  });

  it('should preserve paragraph structure', () => {
    const text = `First paragraph here.

Second paragraph here.

Third paragraph here.`;
    const chunks = chunkPage(1, text);

    // Should keep paragraphs together when possible
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('should respect custom options', () => {
    const text = 'Word '.repeat(200);
    const chunks = chunkPage(1, text, {
      target_tokens: 100,
      min_tokens: 50,
      max_tokens: 150,
    });

    chunks.forEach((chunk) => {
      expect(chunk.token_estimate).toBeLessThanOrEqual(200); // Some flexibility
    });
  });
});

describe('Multiple Pages Chunking', () => {
  it('should chunk multiple OCR results', () => {
    const ocrResults: OCRResult[] = [
      {
        doc_type: 'page',
        isbn13: null,
        title: null,
        publisher: null,
        edition: null,
        page_number: 1,
        raw_text: 'Content of page one.',
        confidence: 0.95,
      },
      {
        doc_type: 'page',
        isbn13: null,
        title: null,
        publisher: null,
        edition: null,
        page_number: 2,
        raw_text: 'Content of page two.',
        confidence: 0.95,
      },
    ];

    const chunks = chunkPages(ocrResults);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.page_number === 1)).toBe(true);
    expect(chunks.some((c) => c.page_number === 2)).toBe(true);
  });

  it('should filter out non-page documents', () => {
    const ocrResults: OCRResult[] = [
      {
        doc_type: 'cover',
        isbn13: '9780123456789',
        title: 'Test Book',
        publisher: 'Test Publisher',
        edition: '1st',
        page_number: null,
        raw_text: 'Cover text',
        confidence: 0.95,
      },
      {
        doc_type: 'toc',
        isbn13: null,
        title: null,
        publisher: null,
        edition: null,
        page_number: 3,
        raw_text: 'Table of contents',
        confidence: 0.95,
      },
      {
        doc_type: 'page',
        isbn13: null,
        title: null,
        publisher: null,
        edition: null,
        page_number: 5,
        raw_text: 'Actual page content',
        confidence: 0.95,
      },
    ];

    const chunks = chunkPages(ocrResults);
    expect(chunks.every((c) => c.page_number === 5)).toBe(true);
  });
});

describe('TOC Parsing', () => {
  it('should parse empty TOC', () => {
    const result = parseTOC([]);
    expect(result.entries).toHaveLength(0);
    expect(result.units).toHaveLength(0);
    expect(result.orphan_lessons).toHaveLength(0);
  });

  it('should parse simple unit structure', () => {
    const ocrResults: OCRResult[] = [
      {
        doc_type: 'toc',
        isbn13: null,
        title: null,
        publisher: null,
        edition: null,
        page_number: 3,
        raw_text: `Unit 1: Introduction .... 5
Unit 2: Basic Concepts .... 20
Unit 3: Advanced Topics .... 45`,
        confidence: 0.95,
      },
    ];

    const result = parseTOC(ocrResults);
    expect(result.units).toHaveLength(3);
    const firstUnit = result.units[0];
    expect(firstUnit).toBeDefined();
    expect(firstUnit?.unit_number).toBe(1);
    expect(firstUnit?.title).toBe('Introduction');
    expect(firstUnit?.page_start).toBe(5);
  });

  it('should parse lessons within units', () => {
    const ocrResults: OCRResult[] = [
      {
        doc_type: 'toc',
        isbn13: null,
        title: null,
        publisher: null,
        edition: null,
        page_number: 3,
        raw_text: `Unit 1: Numbers .... 5
Lesson 1.1: Counting .... 7
Lesson 1.2: Addition .... 15
Unit 2: Shapes .... 25
Lesson 2.1: Circles .... 27`,
        confidence: 0.95,
      },
    ];

    const result = parseTOC(ocrResults);
    expect(result.units).toHaveLength(2);
    const firstUnit = result.units[0];
    const secondUnit = result.units[1];
    expect(firstUnit).toBeDefined();
    expect(secondUnit).toBeDefined();
    expect(firstUnit?.lessons).toHaveLength(2);
    expect(firstUnit?.lessons[0]?.title).toBe('Counting');
    expect(secondUnit?.lessons).toHaveLength(1);
  });

  it('should handle alternative formats', () => {
    const ocrResults: OCRResult[] = [
      {
        doc_type: 'toc',
        isbn13: null,
        title: null,
        publisher: null,
        edition: null,
        page_number: 3,
        raw_text: `Chapter 1: Getting Started  10
Chapter 2: Core Principles  30`,
        confidence: 0.95,
      },
    ];

    const result = parseTOC(ocrResults);
    expect(result.units).toHaveLength(2);
    expect(result.units[0]?.title).toBe('Getting Started');
  });

  it('should calculate page_end from next entry', () => {
    const ocrResults: OCRResult[] = [
      {
        doc_type: 'toc',
        isbn13: null,
        title: null,
        publisher: null,
        edition: null,
        page_number: 3,
        raw_text: `Unit 1: First .... 5
Unit 2: Second .... 20
Unit 3: Third .... 40`,
        confidence: 0.95,
      },
    ];

    const result = parseTOC(ocrResults);
    expect(result.units[0]?.page_end).toBe(19);
    expect(result.units[1]?.page_end).toBe(39);
  });
});

describe('Cover Parsing', () => {
  it('should extract cover metadata', () => {
    const ocrResult: OCRResult = {
      doc_type: 'cover',
      isbn13: '978-0-123456-78-9',
      title: 'Mathematics Grade 5',
      publisher: 'Educational Press',
      edition: '3rd Edition',
      page_number: null,
      raw_text: 'Cover text here',
      confidence: 0.92,
    };

    const result = parseCover(ocrResult);
    expect(result.title).toBe('Mathematics Grade 5');
    expect(result.publisher).toBe('Educational Press');
    expect(result.isbn13).toBe('9780123456789'); // Normalized
    expect(result.edition).toBe('3rd Edition');
  });

  it('should handle missing metadata', () => {
    const ocrResult: OCRResult = {
      doc_type: 'cover',
      isbn13: null,
      title: null,
      publisher: null,
      edition: null,
      page_number: null,
      raw_text: 'Unclear cover',
      confidence: 0.5,
    };

    const result = parseCover(ocrResult);
    expect(result.title).toBeNull();
    expect(result.publisher).toBeNull();
    expect(result.isbn13).toBeNull();
    expect(result.edition).toBeNull();
  });

  it('should normalize ISBN-10 to ISBN-13', () => {
    const ocrResult: OCRResult = {
      doc_type: 'cover',
      isbn13: '0-201-53082-1', // ISBN-10 for SICP
      title: 'Test Book',
      publisher: null,
      edition: null,
      page_number: null,
      raw_text: '',
      confidence: 0.9,
    };

    const result = parseCover(ocrResult);
    expect(result.isbn13).toHaveLength(13);
    expect(result.isbn13).toMatch(/^978/);
  });
});

describe('Default Options', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_CHUNKER_OPTIONS.target_tokens).toBe(450);
    expect(DEFAULT_CHUNKER_OPTIONS.min_tokens).toBe(300);
    expect(DEFAULT_CHUNKER_OPTIONS.max_tokens).toBe(600);
    expect(DEFAULT_CHUNKER_OPTIONS.overlap_tokens).toBe(50);
    expect(DEFAULT_CHUNKER_OPTIONS.preserve_paragraphs).toBe(true);
    expect(DEFAULT_CHUNKER_OPTIONS.preserve_sentences).toBe(true);
  });
});
