/**
 * Input Validation Schemas using Zod
 * Ensures data integrity and type safety
 */

import { z } from 'zod';

// ============ Common Schemas ============

// Grade level validation
export const GradeSchema = z.enum([
  'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
]);

// Subject validation
export const SubjectSchema = z.enum([
  'math', 'english', 'science', 'social_studies', 'reading', 'writing'
]);

// Response style validation
export const ResponseStyleSchema = z.enum([
  'explain', 'hint', 'practice', 'review'
]);

// Difficulty validation
export const DifficultySchema = z.enum([
  'struggling', 'average', 'advanced'
]);

// ============ User Input Schemas ============

// Chat message input
export const ChatMessageInputSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message is too long (max 2000 characters)')
    .refine(
      (val) => !val.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/),
      'Please do not include phone numbers'
    )
    .refine(
      (val) => !val.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/),
      'Please do not include email addresses'
    ),
  mode: ResponseStyleSchema.optional(),
});

// Profile update input
export const ProfileUpdateSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name is too long (max 50 characters)')
    .regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .optional(),
  grade: GradeSchema.optional(),
  preferredSubjects: z.array(SubjectSchema).optional(),
  learningStyle: z.enum(['visual', 'auditory', 'reading', 'kinesthetic']).optional(),
});

// Onboarding input
export const OnboardingInputSchema = z.object({
  grade: GradeSchema,
  subjects: z.array(SubjectSchema).min(1, 'Please select at least one subject'),
  learningStyle: z.enum(['visual', 'auditory', 'reading', 'kinesthetic']),
});

// Report content input
export const ReportContentSchema = z.object({
  contentId: z.string().uuid(),
  reason: z
    .string()
    .min(10, 'Please provide more detail about the issue')
    .max(500, 'Description is too long'),
  category: z.enum([
    'inappropriate',
    'incorrect',
    'offensive',
    'personal_info',
    'other'
  ]),
});

// Settings input
export const SettingsSchema = z.object({
  notifications: z.object({
    streakReminders: z.boolean(),
    badgeNotifications: z.boolean(),
    dailyChallenges: z.boolean(),
    quietHoursStart: z.number().min(0).max(23).optional(),
    quietHoursEnd: z.number().min(0).max(23).optional(),
  }).optional(),
  accessibility: z.object({
    highContrast: z.boolean(),
    largeText: z.boolean(),
    reduceMotion: z.boolean(),
  }).optional(),
  feedback: z.object({
    haptics: z.boolean(),
    sounds: z.boolean(),
    soundVolume: z.number().min(0).max(1),
  }).optional(),
});

// ============ API Request Schemas ============

// Chat request
export const ChatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  context: z.object({
    studentId: z.string().uuid(),
    grade: GradeSchema,
    state: z.string().min(2).max(50),
    county: z.string().max(100).optional(),
    subject: SubjectSchema,
    responseStyle: ResponseStyleSchema,
    difficulty: DifficultySchema,
    textbookId: z.string().uuid().optional(),
    chapter: z.string().max(100).optional(),
    lesson: z.string().max(100).optional(),
  }),
});

// OCR request
export const OCRRequestSchema = z.object({
  imageBase64: z
    .string()
    .min(100, 'Image data is too small')
    .max(10000000, 'Image is too large (max 10MB)'),
  sessionId: z.string().uuid().optional(),
});

// ============ Validation Utilities ============

export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  errors: { field: string; message: string }[];
};

/**
 * Validate input against a schema
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return { success: false, errors };
}

/**
 * Validate and throw if invalid
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): T {
  return schema.parse(input);
}

/**
 * Get first error message from validation result
 */
export function getFirstError<T>(result: ValidationResult<T>): string | null {
  if (result.success) return null;
  return result.errors[0]?.message || 'Validation failed';
}

/**
 * Check if input is valid without getting data
 */
export function isValid<T>(schema: z.ZodSchema<T>, input: unknown): boolean {
  return schema.safeParse(input).success;
}

// ============ Pre-built Validators ============

export const Validators = {
  chatMessage: (message: string) => validate(ChatMessageInputSchema, { message }),
  profile: (data: unknown) => validate(ProfileUpdateSchema, data),
  onboarding: (data: unknown) => validate(OnboardingInputSchema, data),
  reportContent: (data: unknown) => validate(ReportContentSchema, data),
  settings: (data: unknown) => validate(SettingsSchema, data),
  chatRequest: (data: unknown) => validate(ChatRequestSchema, data),
  ocrRequest: (data: unknown) => validate(OCRRequestSchema, data),

  // Simple validators
  isValidGrade: (grade: string) => isValid(GradeSchema, grade),
  isValidSubject: (subject: string) => isValid(SubjectSchema, subject),
  isValidEmail: (email: string) => z.string().email().safeParse(email).success,
};

export default Validators;
