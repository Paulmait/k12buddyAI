// ============================================
// Keyword Scorer - Score chunks by relevance
// ============================================

import type { RetrievableChunk, ScoredChunk } from './types';

/**
 * Common English stop words to filter out
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'for',
  'from', 'has', 'have', 'he', 'her', 'his', 'how', 'i', 'if',
  'in', 'is', 'it', 'its', 'just', 'me', 'my', 'no', 'not', 'of',
  'on', 'or', 'our', 'out', 'so', 'that', 'the', 'them', 'then',
  'there', 'these', 'they', 'this', 'to', 'up', 'us', 'was', 'we',
  'what', 'when', 'which', 'who', 'why', 'will', 'with', 'would',
  'you', 'your', 'can', 'does', 'did', 'been', 'being', 'could',
  'should', 'would', 'am', 'had', 'having', 'here', 'now', 'some',
  'very', 'any', 'own', 'same', 'other', 'such', 'than', 'too',
  'only', 'each', 'few', 'more', 'most', 'all', 'both', 'after',
  'before', 'above', 'below', 'between', 'into', 'through', 'during',
  'about', 'against', 'again', 'once', 'also', 'however', 'much',
]);

/**
 * Math-specific terms that should be preserved
 */
const MATH_TERMS = new Set([
  'add', 'addition', 'subtract', 'subtraction', 'multiply', 'multiplication',
  'divide', 'division', 'fraction', 'decimal', 'percent', 'percentage',
  'ratio', 'proportion', 'equation', 'variable', 'expression', 'term',
  'coefficient', 'constant', 'exponent', 'power', 'root', 'square',
  'cube', 'factor', 'multiple', 'prime', 'composite', 'even', 'odd',
  'positive', 'negative', 'integer', 'whole', 'natural', 'rational',
  'irrational', 'real', 'complex', 'absolute', 'value', 'greater',
  'less', 'equal', 'inequality', 'solve', 'simplify', 'evaluate',
  'graph', 'plot', 'coordinate', 'axis', 'origin', 'slope', 'intercept',
  'linear', 'quadratic', 'polynomial', 'function', 'domain', 'range',
  'input', 'output', 'area', 'perimeter', 'volume', 'surface', 'angle',
  'degree', 'radian', 'triangle', 'rectangle', 'square', 'circle',
  'radius', 'diameter', 'circumference', 'parallel', 'perpendicular',
  'congruent', 'similar', 'symmetry', 'reflection', 'rotation', 'translation',
  'mean', 'median', 'mode', 'range', 'average', 'probability', 'chance',
  'outcome', 'event', 'sample', 'data', 'statistics', 'frequency',
]);

/**
 * Tokenize text into terms for matching
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')  // Remove punctuation
    .split(/\s+/)                   // Split on whitespace
    .filter(term => term.length > 1) // Remove single chars
    .filter(term => !STOP_WORDS.has(term) || MATH_TERMS.has(term)); // Keep non-stop words or math terms
}

/**
 * Extract query terms for matching
 */
export function extractQueryTerms(query: string): string[] {
  const tokens = tokenize(query);
  const terms = new Set(tokens);

  // Add stemmed versions for common suffixes
  tokens.forEach(token => {
    // Simple suffix stripping (not a full stemmer)
    if (token.endsWith('ing') && token.length > 5) {
      terms.add(token.slice(0, -3));
    } else if (token.endsWith('ed') && token.length > 4) {
      terms.add(token.slice(0, -2));
    } else if (token.endsWith('s') && token.length > 3 && !token.endsWith('ss')) {
      terms.add(token.slice(0, -1));
    } else if (token.endsWith('ly') && token.length > 4) {
      terms.add(token.slice(0, -2));
    }
  });

  return Array.from(terms);
}

/**
 * Calculate TF (Term Frequency) for a term in content
 */
function calculateTF(term: string, contentTokens: string[]): number {
  const count = contentTokens.filter(t => t === term || t.includes(term) || term.includes(t)).length;
  return count / Math.max(contentTokens.length, 1);
}

/**
 * Calculate IDF (Inverse Document Frequency) approximation
 * Uses a simple heuristic based on term length and specificity
 */
function calculateIDFApprox(term: string): number {
  // Longer terms and math terms are more specific
  const lengthBoost = Math.min(term.length / 10, 1);
  const mathBoost = MATH_TERMS.has(term) ? 0.3 : 0;

  return 0.5 + lengthBoost + mathBoost;
}

/**
 * Score a single chunk against query terms
 */
export function scoreChunk(
  chunk: RetrievableChunk,
  queryTerms: string[],
  options?: {
    lessonBoost?: number;      // Boost if chunk matches target lesson
    pageProximityBoost?: number; // Boost based on page proximity
    targetLessonId?: string;
    currentPage?: number;
  }
): ScoredChunk {
  const contentTokens = tokenize(chunk.content);
  const matchedTerms: string[] = [];
  let score = 0;

  // Calculate TF-IDF-like score for each query term
  for (const term of queryTerms) {
    const tf = calculateTF(term, contentTokens);
    if (tf > 0) {
      const idf = calculateIDFApprox(term);
      score += tf * idf;
      matchedTerms.push(term);
    }
  }

  // Normalize by number of query terms
  if (queryTerms.length > 0) {
    score = score / queryTerms.length;
  }

  // Apply boosts
  if (options) {
    // Lesson match boost
    if (options.targetLessonId && chunk.lesson_id === options.targetLessonId) {
      score *= (1 + (options.lessonBoost ?? 0.3));
    }

    // Page proximity boost
    if (options.currentPage !== undefined && options.pageProximityBoost) {
      const distance = Math.abs(chunk.page_number - options.currentPage);
      const proximityFactor = Math.max(0, 1 - distance / 20); // Decays over 20 pages
      score *= (1 + proximityFactor * options.pageProximityBoost);
    }
  }

  return {
    chunk,
    score: Math.min(score, 1), // Cap at 1
    matched_terms: matchedTerms,
  };
}

/**
 * Score all chunks and return sorted by relevance
 */
export function scoreChunks(
  chunks: RetrievableChunk[],
  query: string,
  options?: {
    lessonBoost?: number;
    pageProximityBoost?: number;
    targetLessonId?: string;
    currentPage?: number;
  }
): ScoredChunk[] {
  const queryTerms = extractQueryTerms(query);

  const scored = chunks.map(chunk =>
    scoreChunk(chunk, queryTerms, options)
  );

  // Sort by score descending, then by page number for consistency
  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.001) {
      return b.score - a.score;
    }
    return a.chunk.page_number - b.chunk.page_number;
  });

  return scored;
}

/**
 * Check if content contains any math expressions
 */
export function containsMathContent(text: string): boolean {
  // Check for math operators and symbols
  const mathPatterns = [
    /[+\-*/=<>]/,           // Basic operators
    /\d+\s*[+\-*/]\s*\d+/,   // Expressions like "5 + 3"
    /\d+\/\d+/,              // Fractions like "1/2"
    /\^\d+/,                 // Exponents
    /sqrt|root/i,            // Root expressions
    /equation|formula/i,     // Math keywords
  ];

  return mathPatterns.some(pattern => pattern.test(text));
}

/**
 * Highlight matched terms in content
 */
export function highlightMatches(content: string, matchedTerms: string[]): string {
  let highlighted = content;

  for (const term of matchedTerms) {
    const regex = new RegExp(`\\b(${term}\\w*)\\b`, 'gi');
    highlighted = highlighted.replace(regex, '**$1**');
  }

  return highlighted;
}
