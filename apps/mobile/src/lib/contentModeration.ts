/**
 * Content Moderation for K-12 Safety
 * Filters inappropriate content before sending to AI and validates AI responses
 */

// Categories of content to moderate
export type ContentCategory =
  | 'profanity'
  | 'violence'
  | 'adult'
  | 'hate_speech'
  | 'personal_info'
  | 'external_links'
  | 'off_topic';

export interface ModerationResult {
  safe: boolean;
  flagged: boolean;
  categories: ContentCategory[];
  sanitizedContent?: string;
  warnings: string[];
}

// Patterns that should be flagged
const PROFANITY_PATTERNS = [
  // Basic profanity filter - in production, use a comprehensive word list
  /\b(damn|hell|crap)\b/gi, // Mild - just flag, don't block
];

const BLOCKED_PATTERNS = [
  // Personal information patterns
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
  /\b\d{3}[-]?\d{2}[-]?\d{4}\b/, // SSN patterns
  /\b\d{5}(-\d{4})?\b/, // ZIP codes
  /\bpassword\s*[:=]\s*\S+/i, // Password sharing
];

const EXTERNAL_LINK_PATTERN = /https?:\/\/[^\s]+/gi;

// Off-topic patterns (not related to learning)
const OFF_TOPIC_PATTERNS = [
  /\b(video\s*game|fortnite|minecraft|roblox|tiktok|instagram|snapchat)\b/i,
  /\b(buy|sell|purchase|money|dollar|payment)\b/i,
  /\b(date|boyfriend|girlfriend|crush)\b/i,
];

// Age-appropriate subject topics
const LEARNING_TOPICS = [
  'math',
  'science',
  'english',
  'reading',
  'writing',
  'history',
  'geography',
  'homework',
  'study',
  'learn',
  'question',
  'help',
  'explain',
  'understand',
  'solve',
  'answer',
  'problem',
  'equation',
  'fraction',
  'multiply',
  'divide',
  'add',
  'subtract',
  'grammar',
  'vocabulary',
  'spelling',
  'essay',
  'book',
  'chapter',
];

/**
 * Moderate user input content
 */
export function moderateUserInput(content: string): ModerationResult {
  const result: ModerationResult = {
    safe: true,
    flagged: false,
    categories: [],
    warnings: [],
    sanitizedContent: content,
  };

  const lowerContent = content.toLowerCase();

  // Check for personal information (BLOCK)
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      result.safe = false;
      result.categories.push('personal_info');
      result.warnings.push(
        'Please do not share personal information like phone numbers, emails, or addresses.'
      );
    }
  }

  // Check for external links (WARN)
  if (EXTERNAL_LINK_PATTERN.test(content)) {
    result.flagged = true;
    result.categories.push('external_links');
    result.warnings.push('External links are not allowed for safety reasons.');
    // Remove links from content
    result.sanitizedContent = content.replace(EXTERNAL_LINK_PATTERN, '[link removed]');
  }

  // Check for profanity (WARN - mild words are flagged but allowed for educational context)
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(content)) {
      result.flagged = true;
      if (!result.categories.includes('profanity')) {
        result.categories.push('profanity');
      }
    }
  }

  // Check if content is related to learning
  const isLearningRelated = LEARNING_TOPICS.some(topic =>
    lowerContent.includes(topic)
  );

  // Check for off-topic content
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(content) && !isLearningRelated) {
      result.flagged = true;
      if (!result.categories.includes('off_topic')) {
        result.categories.push('off_topic');
        result.warnings.push(
          "Let's focus on your schoolwork! I'm here to help with learning."
        );
      }
    }
  }

  return result;
}

/**
 * Moderate AI response content
 */
export function moderateAIResponse(content: string): ModerationResult {
  const result: ModerationResult = {
    safe: true,
    flagged: false,
    categories: [],
    warnings: [],
    sanitizedContent: content,
  };

  // Check for any content that shouldn't be in AI responses
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      result.safe = false;
      result.categories.push('personal_info');
      // Remove matching content
      result.sanitizedContent = content.replace(pattern, '[removed]');
    }
  }

  // Check for external links
  if (EXTERNAL_LINK_PATTERN.test(content)) {
    result.flagged = true;
    result.categories.push('external_links');
    // Remove links
    result.sanitizedContent = content.replace(EXTERNAL_LINK_PATTERN, '[link removed for safety]');
  }

  return result;
}

/**
 * Check if content is appropriate for the student's grade level
 */
export function isAgeAppropriate(content: string, grade: string): boolean {
  // K-5: More strict filtering
  const elementaryGrades = ['K', '1', '2', '3', '4', '5'];
  const isElementary = elementaryGrades.includes(grade);

  if (isElementary) {
    // Additional checks for younger students
    const complexPatterns = [
      /\bdeath|die|kill\b/i,
      /\bwar|battle|fight\b/i, // Except in historical context
      /\bdrink|smoke|drug\b/i,
    ];

    for (const pattern of complexPatterns) {
      if (pattern.test(content)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Generate a safe response when content is blocked
 */
export function getSafeResponse(categories: ContentCategory[]): string {
  if (categories.includes('personal_info')) {
    return "I noticed you might be sharing personal information. For your safety, please don't share things like phone numbers, emails, or addresses. Let's focus on your learning question instead!";
  }

  if (categories.includes('off_topic')) {
    return "I'm here to help you learn! Let's focus on your schoolwork. What subject do you need help with today?";
  }

  if (categories.includes('external_links')) {
    return "I can't open external links, but I'd be happy to help you with any learning questions you have!";
  }

  return "I'm your learning buddy! Let's work on your studies together. What would you like help with?";
}

/**
 * Report content for manual review
 */
export interface ContentReport {
  id: string;
  content: string;
  userId: string;
  sessionId: string;
  categories: ContentCategory[];
  timestamp: string;
  action: 'blocked' | 'flagged' | 'allowed';
}

export function createContentReport(
  content: string,
  userId: string,
  sessionId: string,
  moderationResult: ModerationResult
): ContentReport {
  return {
    id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content: content.substring(0, 500), // Limit stored content
    userId,
    sessionId,
    categories: moderationResult.categories,
    timestamp: new Date().toISOString(),
    action: !moderationResult.safe
      ? 'blocked'
      : moderationResult.flagged
        ? 'flagged'
        : 'allowed',
  };
}

export default {
  moderateUserInput,
  moderateAIResponse,
  isAgeAppropriate,
  getSafeResponse,
  createContentReport,
};
