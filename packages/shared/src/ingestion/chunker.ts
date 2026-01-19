// ============================================
// Text Chunker - Split text into retrieval-sized chunks
// ============================================

import type { TextChunk, ChunkerOptions, OCRResult, LayoutElement } from './types';

/**
 * Default chunker options
 */
export const DEFAULT_CHUNKER_OPTIONS: ChunkerOptions = {
  target_tokens: 450,
  min_tokens: 300,
  max_tokens: 600,
  overlap_tokens: 50,
  preserve_paragraphs: true,
  preserve_sentences: true,
};

/**
 * Rough token estimation (avg 4 chars per token for English)
 */
export function estimateTokens(text: string): number {
  // More accurate estimation considering:
  // - Whitespace-separated words
  // - Special characters and punctuation
  // - Numbers and symbols
  const words = text.split(/\s+/).filter(Boolean);
  const chars = text.length;

  // Hybrid approach: weighted average of word count and char/4
  // Words typically map 1:1 with tokens, but short words may combine
  // and long words split
  const wordEstimate = words.length * 1.3; // Most words are 1+ token
  const charEstimate = chars / 4;

  return Math.ceil((wordEstimate + charEstimate) / 2);
}

/**
 * Create SHA-256 hash of content for deduplication
 * Using a simple hash for browser/Node compatibility
 */
export function hashContent(content: string): string {
  // Simple FNV-1a hash - fast and deterministic
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  // Convert to hex string
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Chunk a single page's text content
 */
export function chunkPage(
  pageNumber: number,
  text: string,
  options: Partial<ChunkerOptions> = {}
): TextChunk[] {
  const opts = { ...DEFAULT_CHUNKER_OPTIONS, ...options };
  const chunks: TextChunk[] = [];

  // Clean and normalize text
  const cleanedText = cleanText(text);

  if (!cleanedText) {
    return [];
  }

  // Estimate total tokens
  const totalTokens = estimateTokens(cleanedText);

  // If text fits in one chunk, return it
  if (totalTokens <= opts.max_tokens) {
    chunks.push({
      page_number: pageNumber,
      chunk_index: 0,
      content: cleanedText,
      content_hash: hashContent(cleanedText),
      token_estimate: totalTokens,
    });
    return chunks;
  }

  // Split into semantic units (paragraphs or sentences)
  const units = opts.preserve_paragraphs
    ? splitIntoParagraphs(cleanedText)
    : opts.preserve_sentences
    ? splitIntoSentences(cleanedText)
    : [cleanedText];

  // Build chunks from units
  let currentContent = '';
  let currentTokens = 0;
  let chunkIndex = 0;

  for (const unit of units) {
    const unitTokens = estimateTokens(unit);

    // If single unit exceeds max, split it further
    if (unitTokens > opts.max_tokens) {
      // Flush current chunk first
      if (currentContent) {
        chunks.push(createChunk(pageNumber, chunkIndex++, currentContent, currentTokens));
        currentContent = '';
        currentTokens = 0;
      }

      // Split large unit
      const subChunks = splitLargeUnit(unit, opts);
      for (const subChunk of subChunks) {
        chunks.push(createChunk(pageNumber, chunkIndex++, subChunk.content, subChunk.tokens));
      }
      continue;
    }

    // Check if adding this unit would exceed target
    if (currentTokens + unitTokens > opts.target_tokens) {
      // If we have enough content, create a chunk
      if (currentTokens >= opts.min_tokens) {
        chunks.push(createChunk(pageNumber, chunkIndex++, currentContent, currentTokens));

        // Start new chunk with overlap
        const overlapContent = getOverlapContent(currentContent, opts.overlap_tokens);
        currentContent = overlapContent ? overlapContent + '\n\n' + unit : unit;
        currentTokens = estimateTokens(currentContent);
      } else {
        // Not enough content yet, keep adding
        currentContent = currentContent ? currentContent + '\n\n' + unit : unit;
        currentTokens += unitTokens;
      }
    } else {
      // Add to current chunk
      currentContent = currentContent ? currentContent + '\n\n' + unit : unit;
      currentTokens += unitTokens;
    }
  }

  // Don't forget the last chunk
  if (currentContent && currentTokens >= opts.min_tokens / 2) {
    chunks.push(createChunk(pageNumber, chunkIndex++, currentContent, currentTokens));
  } else if (currentContent && chunks.length > 0) {
    // Merge with previous chunk if too small
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk) {
      const mergedContent = lastChunk.content + '\n\n' + currentContent;
      const mergedTokens = estimateTokens(mergedContent);

      if (mergedTokens <= opts.max_tokens * 1.2) {
        // Allow slight overflow for merging
        chunks[chunks.length - 1] = createChunk(
          pageNumber,
          lastChunk.chunk_index,
          mergedContent,
          mergedTokens
        );
      } else {
        // Keep as separate small chunk
        chunks.push(createChunk(pageNumber, chunkIndex++, currentContent, currentTokens));
      }
    }
  }

  return chunks;
}

/**
 * Chunk multiple pages' OCR results
 */
export function chunkPages(
  ocrResults: OCRResult[],
  options: Partial<ChunkerOptions> = {}
): TextChunk[] {
  const allChunks: TextChunk[] = [];

  // Sort by page number
  const sortedPages = ocrResults
    .filter((r) => r.doc_type === 'page' && r.page_number !== null)
    .sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0));

  for (const page of sortedPages) {
    // Use layout-aware text if available
    const text = page.layout
      ? extractTextFromLayout(page.layout)
      : page.raw_text;

    const pageChunks = chunkPage(page.page_number!, text, options);
    allChunks.push(...pageChunks);
  }

  return allChunks;
}

/**
 * Create a TextChunk object
 */
function createChunk(
  pageNumber: number,
  chunkIndex: number,
  content: string,
  tokenEstimate: number
): TextChunk {
  return {
    page_number: pageNumber,
    chunk_index: chunkIndex,
    content: content.trim(),
    content_hash: hashContent(content),
    token_estimate: tokenEstimate,
  };
}

/**
 * Clean and normalize text
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\t/g, ' ')              // Replace tabs with spaces
    .replace(/\u00A0/g, ' ')          // Replace non-breaking spaces
    .replace(/ +/g, ' ')              // Collapse multiple spaces
    .replace(/\n{3,}/g, '\n\n')       // Collapse multiple newlines
    .trim();
}

/**
 * Split text into paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries while preserving abbreviations
  const sentences: string[] = [];
  let current = '';

  // Simple sentence splitter - handles most cases
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z])/);

  for (const part of parts) {
    if (current) {
      current += ' ' + part;
    } else {
      current = part;
    }

    // Check if this looks like a complete sentence
    if (/[.!?]$/.test(current.trim())) {
      sentences.push(current.trim());
      current = '';
    }
  }

  // Don't forget remaining text
  if (current) {
    sentences.push(current.trim());
  }

  return sentences.filter((s) => s.length > 0);
}

/**
 * Split a large unit (paragraph/sentence) into smaller pieces
 */
function splitLargeUnit(
  text: string,
  options: ChunkerOptions
): Array<{ content: string; tokens: number }> {
  const results: Array<{ content: string; tokens: number }> = [];

  // First try splitting by sentences if we were preserving paragraphs
  if (options.preserve_paragraphs) {
    const sentences = splitIntoSentences(text);
    if (sentences.length > 1) {
      let current = '';
      let currentTokens = 0;

      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);

        if (currentTokens + sentenceTokens > options.target_tokens && currentTokens > 0) {
          results.push({ content: current, tokens: currentTokens });
          current = sentence;
          currentTokens = sentenceTokens;
        } else {
          current = current ? current + ' ' + sentence : sentence;
          currentTokens += sentenceTokens;
        }
      }

      if (current) {
        results.push({ content: current, tokens: currentTokens });
      }

      return results;
    }
  }

  // Fall back to word-level splitting
  const words = text.split(/\s+/);
  let current = '';
  let currentTokens = 0;

  for (const word of words) {
    const wordTokens = estimateTokens(word);

    if (currentTokens + wordTokens > options.target_tokens && currentTokens > 0) {
      results.push({ content: current, tokens: currentTokens });
      current = word;
      currentTokens = wordTokens;
    } else {
      current = current ? current + ' ' + word : word;
      currentTokens += wordTokens;
    }
  }

  if (current) {
    results.push({ content: current, tokens: currentTokens });
  }

  return results;
}

/**
 * Get overlap content from the end of a chunk
 */
function getOverlapContent(text: string, targetTokens: number): string {
  if (targetTokens <= 0) return '';

  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return '';

  // Take sentences from the end until we reach target tokens
  let overlap = '';
  let tokens = 0;

  for (let i = sentences.length - 1; i >= 0 && tokens < targetTokens; i--) {
    const sentence = sentences[i];
    if (!sentence) continue;
    const sentenceTokens = estimateTokens(sentence);

    if (tokens + sentenceTokens <= targetTokens * 1.5) {
      overlap = sentence + (overlap ? ' ' + overlap : '');
      tokens += sentenceTokens;
    } else {
      break;
    }
  }

  return overlap;
}

/**
 * Extract text from layout elements in order
 */
function extractTextFromLayout(layout: LayoutElement[]): string {
  return layout
    .map((element) => {
      switch (element.type) {
        case 'heading':
          return `## ${element.content}\n`;
        case 'equation':
          return `[Equation: ${element.content}]`;
        case 'figure':
          return `[Figure: ${element.content}]`;
        case 'table':
          return `[Table: ${element.content}]`;
        case 'list':
          return element.content;
        default:
          return element.content;
      }
    })
    .join('\n\n');
}
