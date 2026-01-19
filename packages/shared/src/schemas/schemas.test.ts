import { describe, it, expect } from 'vitest';
import {
  GradeSchema,
  SubjectSchema,
  CreateStudentSchema,
  ChatRequestSchema,
  OCRResponseSchema,
  VerifyResponseSchema,
  StudentContextSchema,
  EntitlementCheckResponseSchema,
} from './index';

describe('Grade Schema', () => {
  it('accepts valid grades', () => {
    expect(GradeSchema.parse('K')).toBe('K');
    expect(GradeSchema.parse('5')).toBe('5');
    expect(GradeSchema.parse('12')).toBe('12');
  });

  it('rejects invalid grades', () => {
    expect(() => GradeSchema.parse('13')).toThrow();
    expect(() => GradeSchema.parse('0')).toThrow();
    expect(() => GradeSchema.parse('')).toThrow();
  });
});

describe('Subject Schema', () => {
  it('accepts valid subjects', () => {
    expect(SubjectSchema.parse('math')).toBe('math');
    expect(SubjectSchema.parse('science')).toBe('science');
  });

  it('rejects invalid subjects', () => {
    expect(() => SubjectSchema.parse('art')).toThrow();
    expect(() => SubjectSchema.parse('')).toThrow();
  });
});

describe('CreateStudent Schema', () => {
  it('validates a complete student creation request', () => {
    const valid = {
      name: 'John Doe',
      grade: '5',
      state: 'CA',
      county: 'Los Angeles',
    };
    expect(CreateStudentSchema.parse(valid)).toEqual(valid);
  });

  it('accepts without optional county', () => {
    const valid = {
      name: 'Jane Doe',
      grade: 'K',
      state: 'NY',
    };
    expect(CreateStudentSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid state code', () => {
    const invalid = {
      name: 'Test',
      grade: '5',
      state: 'California', // should be 2 chars
    };
    expect(() => CreateStudentSchema.parse(invalid)).toThrow();
  });
});

describe('StudentContext Schema', () => {
  it('validates a complete context', () => {
    const context = {
      student_id: '123e4567-e89b-12d3-a456-426614174000',
      grade: '5',
      state: 'CA',
      subject: 'math',
      response_style: 'explain',
      difficulty: 'average',
    };
    expect(StudentContextSchema.parse(context)).toMatchObject(context);
  });

  it('accepts all response styles', () => {
    const baseContext = {
      student_id: '123e4567-e89b-12d3-a456-426614174000',
      grade: '5',
      state: 'CA',
      subject: 'math',
      difficulty: 'average',
    };

    const styles = ['explain', 'hint', 'practice', 'check_answer', 'review'];
    styles.forEach(style => {
      expect(StudentContextSchema.parse({ ...baseContext, response_style: style })).toBeDefined();
    });
  });
});

describe('ChatRequest Schema', () => {
  it('validates a chat request', () => {
    const request = {
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      message: 'How do I solve this equation?',
      context: {
        student_id: '123e4567-e89b-12d3-a456-426614174001',
        grade: '8',
        state: 'TX',
        subject: 'math',
        response_style: 'hint',
        difficulty: 'average',
      },
    };
    expect(ChatRequestSchema.parse(request)).toMatchObject(request);
  });

  it('rejects empty message', () => {
    const request = {
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      message: '',
      context: {
        student_id: '123e4567-e89b-12d3-a456-426614174001',
        grade: '8',
        state: 'TX',
        subject: 'math',
        response_style: 'explain',
        difficulty: 'average',
      },
    };
    expect(() => ChatRequestSchema.parse(request)).toThrow();
  });
});

describe('OCRResponse Schema', () => {
  it('validates OCR response', () => {
    const response = {
      doc_type: 'page',
      isbn13: null,
      title: null,
      publisher: null,
      edition: null,
      page_number: 42,
      raw_text: 'Chapter 5: Fractions\n\nA fraction represents...',
      confidence: 0.95,
    };
    expect(OCRResponseSchema.parse(response)).toMatchObject(response);
  });

  it('accepts cover with isbn', () => {
    const response = {
      doc_type: 'cover',
      isbn13: '9781234567890',
      title: 'Math Grade 5',
      publisher: 'Education Press',
      edition: '3rd Edition',
      page_number: null,
      raw_text: 'Math Grade 5',
      confidence: 0.92,
    };
    expect(OCRResponseSchema.parse(response)).toMatchObject(response);
  });
});

describe('VerifyResponse Schema', () => {
  it('validates passing verification', () => {
    const response = {
      ok: true,
      issues: [],
      required_action: 'none',
    };
    expect(VerifyResponseSchema.parse(response)).toMatchObject(response);
  });

  it('validates failing verification', () => {
    const response = {
      ok: false,
      issues: ['Claim not supported by textbook', 'Grade level too advanced'],
      required_action: 'ask_for_scan',
      missing_info_request: 'Please scan page 45 to verify this information.',
    };
    expect(VerifyResponseSchema.parse(response)).toMatchObject(response);
  });
});

describe('EntitlementCheckResponse Schema', () => {
  it('validates entitlement response', () => {
    const response = {
      tier: 'starter',
      limits: {
        ai_queries_per_day: 50,
        scans_per_month: 25,
        pages_ingested_per_month: 250,
      },
      usage: {
        ai_queries_today: 10,
        ai_queries_remaining: 40,
        scans_this_month: 5,
        scans_remaining: 20,
        pages_this_month: 50,
        pages_remaining: 200,
      },
      expires_at: '2024-02-19T00:00:00Z',
    };
    expect(EntitlementCheckResponseSchema.parse(response)).toMatchObject(response);
  });

  it('validates free tier with no expiry', () => {
    const response = {
      tier: 'free',
      limits: {
        ai_queries_per_day: 3,
        scans_per_month: 2,
        pages_ingested_per_month: 10,
      },
      usage: {
        ai_queries_today: 1,
        ai_queries_remaining: 2,
        scans_this_month: 0,
        scans_remaining: 2,
        pages_this_month: 0,
        pages_remaining: 10,
      },
      expires_at: null,
    };
    expect(EntitlementCheckResponseSchema.parse(response)).toMatchObject(response);
  });
});
