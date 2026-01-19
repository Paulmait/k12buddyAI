// ============================================
// Retrieval Types
// ============================================

/**
 * Chunk with metadata for retrieval
 */
export interface RetrievableChunk {
  id: string;
  textbook_id: string;
  lesson_id: string | null;
  page_number: number;
  chunk_index: number;
  content: string;
  token_estimate?: number;
}

/**
 * Scored chunk after retrieval ranking
 */
export interface ScoredChunk {
  chunk: RetrievableChunk;
  score: number;
  matched_terms: string[];
}

/**
 * Retrieval query options
 */
export interface RetrievalOptions {
  /** Maximum number of chunks to return */
  top_k: number;
  /** Minimum score threshold (0-1) */
  min_score: number;
  /** Maximum total tokens across all chunks */
  max_tokens: number;
  /** Prefer chunks from specific lesson */
  lesson_id?: string;
  /** Prefer chunks from specific page range */
  page_range?: {
    start: number;
    end: number;
  };
  /** Boost recent/nearby pages */
  boost_recent_pages?: boolean;
}

/**
 * Default retrieval options
 */
export const DEFAULT_RETRIEVAL_OPTIONS: RetrievalOptions = {
  top_k: 5,
  min_score: 0.1,
  max_tokens: 2000,
  boost_recent_pages: false,
};

/**
 * Retrieval context for a chat query
 */
export interface RetrievalContext {
  query: string;
  textbook_id: string;
  lesson_id?: string;
  current_page?: number;
}

/**
 * Retrieval result
 */
export interface RetrievalResult {
  chunks: ScoredChunk[];
  total_tokens: number;
  query_terms: string[];
}
