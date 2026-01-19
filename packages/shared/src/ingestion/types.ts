// ============================================
// Ingestion Pipeline Types
// ============================================

/**
 * Raw OCR result from vision model
 */
export interface OCRResult {
  doc_type: 'cover' | 'toc' | 'page' | 'unknown';
  isbn13: string | null;
  title: string | null;
  publisher: string | null;
  edition: string | null;
  page_number: number | null;
  raw_text: string;
  layout?: LayoutElement[];
  confidence: number;
}

export interface LayoutElement {
  type: 'heading' | 'paragraph' | 'list' | 'equation' | 'figure' | 'table';
  content: string;
  bbox?: number[];
}

/**
 * Parsed TOC entry before database insertion
 */
export interface ParsedTOCEntry {
  type: 'unit' | 'lesson';
  number: number;
  title: string;
  page_start: number;
  page_end?: number;
  parent_number?: number; // For lessons, refers to unit number
}

/**
 * Parsed TOC structure
 */
export interface ParsedTOC {
  entries: ParsedTOCEntry[];
  units: ParsedUnit[];
  orphan_lessons: ParsedLesson[]; // Lessons without a parent unit
}

export interface ParsedUnit {
  unit_number: number;
  title: string;
  page_start: number;
  page_end?: number;
  lessons: ParsedLesson[];
}

export interface ParsedLesson {
  lesson_number: number;
  title: string;
  page_start: number;
  page_end?: number;
}

/**
 * Text chunk ready for database insertion
 */
export interface TextChunk {
  page_number: number;
  chunk_index: number;
  content: string;
  content_hash: string;
  token_estimate: number;
}

/**
 * Chunker configuration options
 */
export interface ChunkerOptions {
  target_tokens: number; // Target chunk size in tokens (default: 450)
  min_tokens: number; // Minimum chunk size (default: 300)
  max_tokens: number; // Maximum chunk size (default: 600)
  overlap_tokens: number; // Overlap between chunks (default: 50)
  preserve_paragraphs: boolean; // Try to keep paragraphs intact
  preserve_sentences: boolean; // Try to keep sentences intact
}

/**
 * Ingestion job tracking
 */
export interface IngestionJob {
  textbook_id: string;
  upload_type: 'cover' | 'toc' | 'page';
  storage_path: string;
  page_number?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  ocr_result?: OCRResult;
  processed_at?: string;
}

/**
 * Cover metadata extracted from OCR
 */
export interface CoverMetadata {
  title: string | null;
  publisher: string | null;
  isbn13: string | null;
  edition: string | null;
  confidence: number;
}

/**
 * Database insertion types
 */
export interface UnitInsert {
  id: string;
  textbook_id: string;
  unit_number: number;
  title: string;
  page_start: number;
  page_end: number | null;
}

export interface LessonInsert {
  id: string;
  textbook_id: string;
  unit_id: string | null;
  lesson_number: number;
  title: string;
  page_start: number;
  page_end: number | null;
}

export interface ChunkInsert {
  id: string;
  textbook_id: string;
  lesson_id: string | null;
  page_number: number;
  chunk_index: number;
  content: string;
  content_hash: string;
  token_estimate: number;
}
