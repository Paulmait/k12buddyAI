// ============================================
// Ingestion Pipeline - Public API
// ============================================

// Types
export type {
  OCRResult,
  LayoutElement,
  ParsedTOCEntry,
  ParsedTOC,
  ParsedUnit,
  ParsedLesson,
  TextChunk,
  ChunkerOptions,
  IngestionJob,
  CoverMetadata,
  UnitInsert,
  LessonInsert,
  ChunkInsert,
} from './types';

// TOC Parser
export { parseTOC, parseCover } from './toc-parser';

// Chunker
export {
  chunkPage,
  chunkPages,
  estimateTokens,
  hashContent,
  DEFAULT_CHUNKER_OPTIONS,
} from './chunker';
