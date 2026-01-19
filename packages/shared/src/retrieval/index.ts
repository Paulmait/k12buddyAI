// ============================================
// Retrieval Module - Public API
// ============================================

// Types
export type {
  RetrievableChunk,
  ScoredChunk,
  RetrievalOptions,
  RetrievalContext,
  RetrievalResult,
} from './types';

export { DEFAULT_RETRIEVAL_OPTIONS } from './types';

// Scorer utilities
export {
  tokenize,
  extractQueryTerms,
  scoreChunk,
  scoreChunks,
  containsMathContent,
  highlightMatches,
} from './scorer';

// Retriever utilities
export {
  retrieveChunks,
  formatChunksForPrompt,
  getRetrievedPageNumbers,
  buildCitations,
  hasMinimumContent,
  getRetrievalSummary,
} from './retriever';
