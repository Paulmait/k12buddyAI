// ============================================
// Retriever - Main retrieval logic
// ============================================

import type {
  RetrievableChunk,
  ScoredChunk,
  RetrievalOptions,
  RetrievalContext,
  RetrievalResult,
} from './types';
import { DEFAULT_RETRIEVAL_OPTIONS } from './types';
import { scoreChunks, extractQueryTerms } from './scorer';

/**
 * Retrieve relevant chunks for a query
 * This is a deterministic keyword-based retrieval - no embeddings
 */
export function retrieveChunks(
  chunks: RetrievableChunk[],
  context: RetrievalContext,
  options: Partial<RetrievalOptions> = {}
): RetrievalResult {
  const opts = { ...DEFAULT_RETRIEVAL_OPTIONS, ...options };

  // Filter chunks to the target textbook
  let filteredChunks = chunks.filter(c => c.textbook_id === context.textbook_id);

  // Optionally filter by page range
  if (opts.page_range) {
    filteredChunks = filteredChunks.filter(
      c => c.page_number >= opts.page_range!.start && c.page_number <= opts.page_range!.end
    );
  }

  // Score all chunks
  const scored = scoreChunks(filteredChunks, context.query, {
    targetLessonId: context.lesson_id,
    currentPage: context.current_page,
    lessonBoost: 0.3,
    pageProximityBoost: opts.boost_recent_pages ? 0.2 : 0,
  });

  // Filter by minimum score
  const aboveThreshold = scored.filter(s => s.score >= opts.min_score);

  // Select top-K while respecting token budget
  const selected = selectWithTokenBudget(aboveThreshold, opts.top_k, opts.max_tokens);

  // Calculate total tokens
  const totalTokens = selected.reduce(
    (sum, s) => sum + (s.chunk.token_estimate ?? estimateTokens(s.chunk.content)),
    0
  );

  return {
    chunks: selected,
    total_tokens: totalTokens,
    query_terms: extractQueryTerms(context.query),
  };
}

/**
 * Select top chunks while respecting token budget
 */
function selectWithTokenBudget(
  scored: ScoredChunk[],
  topK: number,
  maxTokens: number
): ScoredChunk[] {
  const selected: ScoredChunk[] = [];
  let tokenCount = 0;

  for (const item of scored) {
    if (selected.length >= topK) break;

    const chunkTokens = item.chunk.token_estimate ?? estimateTokens(item.chunk.content);

    if (tokenCount + chunkTokens <= maxTokens) {
      selected.push(item);
      tokenCount += chunkTokens;
    }
  }

  return selected;
}

/**
 * Simple token estimation (used as fallback)
 */
function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  const chars = text.length;
  const wordEstimate = words.length * 1.3;
  const charEstimate = chars / 4;
  return Math.ceil((wordEstimate + charEstimate) / 2);
}

/**
 * Format retrieved chunks for inclusion in AI prompt
 */
export function formatChunksForPrompt(
  scoredChunks: ScoredChunk[],
  options?: {
    includePageNumbers?: boolean;
    includeScores?: boolean;
    maxCharsPerChunk?: number;
  }
): string {
  const opts = {
    includePageNumbers: true,
    includeScores: false,
    maxCharsPerChunk: 1500,
    ...options,
  };

  if (scoredChunks.length === 0) {
    return 'No relevant textbook content found for this query.';
  }

  const chunks = scoredChunks.map((item, index) => {
    let content = item.chunk.content;

    // Truncate if needed
    if (content.length > opts.maxCharsPerChunk) {
      content = content.slice(0, opts.maxCharsPerChunk) + '...';
    }

    const parts: string[] = [];

    // Header
    if (opts.includePageNumbers) {
      parts.push(`[Page ${item.chunk.page_number}]`);
    }
    if (opts.includeScores) {
      parts.push(`(relevance: ${(item.score * 100).toFixed(0)}%)`);
    }

    return `--- Excerpt ${index + 1} ${parts.join(' ')} ---\n${content}`;
  });

  return chunks.join('\n\n');
}

/**
 * Get page numbers from retrieved chunks (for citations)
 */
export function getRetrievedPageNumbers(scoredChunks: ScoredChunk[]): number[] {
  const pages = new Set(scoredChunks.map(s => s.chunk.page_number));
  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Build citation references from chunks
 */
export function buildCitations(
  scoredChunks: ScoredChunk[]
): Array<{
  chunk_id: string;
  page_number: number;
  relevance_score: number;
}> {
  return scoredChunks.map(s => ({
    chunk_id: s.chunk.id,
    page_number: s.chunk.page_number,
    relevance_score: s.score,
  }));
}

/**
 * Check if retrieval found sufficient content
 */
export function hasMinimumContent(
  result: RetrievalResult,
  minChunks: number = 1,
  minScore: number = 0.2
): boolean {
  if (result.chunks.length < minChunks) return false;

  // Check if at least one chunk has decent relevance
  return result.chunks.some(c => c.score >= minScore);
}

/**
 * Get a summary of what was retrieved (for debugging/logging)
 */
export function getRetrievalSummary(result: RetrievalResult): string {
  const pageNumbers = getRetrievedPageNumbers(result.chunks);
  const avgScore = result.chunks.length > 0
    ? result.chunks.reduce((sum, c) => sum + c.score, 0) / result.chunks.length
    : 0;

  return [
    `Found ${result.chunks.length} chunks`,
    `from pages: ${pageNumbers.join(', ') || 'none'}`,
    `avg relevance: ${(avgScore * 100).toFixed(0)}%`,
    `total tokens: ${result.total_tokens}`,
    `query terms: ${result.query_terms.join(', ')}`,
  ].join(', ');
}
