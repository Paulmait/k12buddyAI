// ============================================
// TOC Parser - Parse OCR output into units/lessons
// ============================================

import type {
  OCRResult,
  ParsedTOC,
  ParsedTOCEntry,
  ParsedUnit,
  ParsedLesson,
} from './types';

/**
 * Common patterns for detecting TOC structure
 */
const UNIT_PATTERNS = [
  /^(?:unit|chapter|module|section)\s*(\d+)[:\s.-]*(.+)/i,
  /^(\d+)\s*[:\s.-]+\s*(.+)/i, // "1. Introduction" or "1: Introduction"
];

const LESSON_PATTERNS = [
  /^(?:lesson|topic|section)\s*(\d+(?:\.\d+)?)[:\s.-]*(.+)/i,
  /^(\d+\.\d+)\s*[:\s.-]+\s*(.+)/i, // "1.1 Basic Concepts"
];

const PAGE_NUMBER_PATTERNS = [
  /\.{2,}\s*(\d+)\s*$/,          // "Introduction .... 5"
  /\s+(\d+)\s*$/,                // "Introduction 5"
  /\s*[-–—]\s*(\d+)\s*$/,        // "Introduction - 5"
  /\s*\|\s*(\d+)\s*$/,           // "Introduction | 5"
];

/**
 * Parse raw TOC text into structured units and lessons
 */
export function parseTOC(ocrResults: OCRResult[]): ParsedTOC {
  // Filter to only TOC pages
  const tocPages = ocrResults.filter((r) => r.doc_type === 'toc');

  if (tocPages.length === 0) {
    return { entries: [], units: [], orphan_lessons: [] };
  }

  // Combine all TOC text, preserving line structure
  const combinedText = tocPages
    .sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0))
    .map((p) => p.raw_text)
    .join('\n');

  // Parse into entries
  const entries = parseTextToEntries(combinedText);

  // Build unit/lesson hierarchy
  return buildHierarchy(entries);
}

/**
 * Parse raw text lines into TOC entries
 */
function parseTextToEntries(text: string): ParsedTOCEntry[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const entries: ParsedTOCEntry[] = [];

  for (const line of lines) {
    const entry = parseLine(line);
    if (entry) {
      entries.push(entry);
    }
  }

  // Fill in page_end values based on next entry's page_start
  for (let i = 0; i < entries.length - 1; i++) {
    const current = entries[i];
    const next = entries[i + 1];
    if (current && next && !current.page_end && next.page_start > 0) {
      current.page_end = next.page_start - 1;
    }
  }

  return entries;
}

/**
 * Parse a single TOC line
 */
function parseLine(line: string): ParsedTOCEntry | null {
  // Skip obvious non-content lines
  if (line.length < 3) return null;
  if (/^(?:table\s+of\s+contents|contents|index)/i.test(line)) return null;

  // Extract page number first
  let pageStart = 0;
  let cleanedLine = line;

  for (const pattern of PAGE_NUMBER_PATTERNS) {
    const match = line.match(pattern);
    if (match && match[1]) {
      pageStart = parseInt(match[1], 10);
      cleanedLine = line.replace(pattern, '').trim();
      break;
    }
  }

  // Skip if no page number found (likely not a TOC entry)
  if (pageStart === 0) return null;

  // Try to match unit patterns
  for (const pattern of UNIT_PATTERNS) {
    const match = cleanedLine.match(pattern);
    if (match && match[1] && match[2]) {
      return {
        type: 'unit',
        number: parseInt(match[1], 10),
        title: cleanTitle(match[2]),
        page_start: pageStart,
      };
    }
  }

  // Try to match lesson patterns
  for (const pattern of LESSON_PATTERNS) {
    const match = cleanedLine.match(pattern);
    if (match && match[1] && match[2]) {
      const numberStr = match[1];
      const parts = numberStr.split('.');
      const lessonNum = parts.length > 1 ? parseInt(parts[1] ?? '0', 10) : parseInt(parts[0] ?? '0', 10);
      const parentNum = parts.length > 1 ? parseInt(parts[0] ?? '0', 10) : undefined;

      return {
        type: 'lesson',
        number: lessonNum,
        title: cleanTitle(match[2]),
        page_start: pageStart,
        parent_number: parentNum,
      };
    }
  }

  // If we have a page number but no recognized pattern, treat as lesson
  if (pageStart > 0 && cleanedLine.length > 0) {
    return {
      type: 'lesson',
      number: 0, // Unknown number
      title: cleanTitle(cleanedLine),
      page_start: pageStart,
    };
  }

  return null;
}

/**
 * Clean up title text
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\.+$/, '')  // Remove trailing dots
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Build unit/lesson hierarchy from flat entries
 */
function buildHierarchy(entries: ParsedTOCEntry[]): ParsedTOC {
  const units: ParsedUnit[] = [];
  const orphanLessons: ParsedLesson[] = [];
  let currentUnit: ParsedUnit | null = null;

  for (const entry of entries) {
    if (entry.type === 'unit') {
      // Save previous unit
      if (currentUnit) {
        units.push(currentUnit);
      }

      // Start new unit
      currentUnit = {
        unit_number: entry.number,
        title: entry.title,
        page_start: entry.page_start,
        page_end: entry.page_end,
        lessons: [],
      };
    } else if (entry.type === 'lesson') {
      const lesson: ParsedLesson = {
        lesson_number: entry.number,
        title: entry.title,
        page_start: entry.page_start,
        page_end: entry.page_end,
      };

      // Check if lesson belongs to a specific unit
      if (entry.parent_number !== undefined) {
        // Find or create the parent unit
        let parentUnit = units.find((u) => u.unit_number === entry.parent_number);
        if (!parentUnit && currentUnit?.unit_number === entry.parent_number) {
          parentUnit = currentUnit;
        }

        if (parentUnit) {
          parentUnit.lessons.push(lesson);
        } else {
          orphanLessons.push(lesson);
        }
      } else if (currentUnit) {
        // Add to current unit
        currentUnit.lessons.push(lesson);
      } else {
        // No current unit, orphan lesson
        orphanLessons.push(lesson);
      }
    }
  }

  // Don't forget the last unit
  if (currentUnit) {
    units.push(currentUnit);
  }

  // Update unit page_end based on last lesson or next unit
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (unit && !unit.page_end) {
      // Use last lesson's page_end if available
      if (unit.lessons.length > 0) {
        const lastLesson = unit.lessons[unit.lessons.length - 1];
        if (lastLesson?.page_end) {
          unit.page_end = lastLesson.page_end;
        }
      }
      // Or use next unit's page_start - 1
      const nextUnit = units[i + 1];
      if (!unit.page_end && nextUnit) {
        unit.page_end = nextUnit.page_start - 1;
      }
    }
  }

  return { entries, units, orphan_lessons: orphanLessons };
}

/**
 * Extract cover metadata from OCR result
 */
export function parseCover(ocrResult: OCRResult): {
  title: string | null;
  publisher: string | null;
  isbn13: string | null;
  edition: string | null;
} {
  return {
    title: ocrResult.title,
    publisher: ocrResult.publisher,
    isbn13: normalizeISBN(ocrResult.isbn13),
    edition: ocrResult.edition,
  };
}

/**
 * Normalize ISBN-13 format
 */
function normalizeISBN(isbn: string | null): string | null {
  if (!isbn) return null;

  // Remove all non-digit characters except X (for ISBN-10 checksum)
  const cleaned = isbn.replace(/[^0-9X]/gi, '');

  // Check for valid ISBN-13 (13 digits)
  if (cleaned.length === 13 && /^\d{13}$/.test(cleaned)) {
    return cleaned;
  }

  // Check for ISBN-10 and convert to ISBN-13
  if (cleaned.length === 10) {
    return convertISBN10to13(cleaned);
  }

  return null;
}

/**
 * Convert ISBN-10 to ISBN-13
 */
function convertISBN10to13(isbn10: string): string | null {
  if (isbn10.length !== 10) return null;

  // Add 978 prefix and drop the last digit (old checksum)
  const base = '978' + isbn10.slice(0, 9);

  // Calculate new checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const char = base[i];
    if (char === undefined) return null;
    const digit = parseInt(char, 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;

  return base + checksum.toString();
}
