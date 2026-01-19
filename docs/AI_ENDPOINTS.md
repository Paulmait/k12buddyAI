# K-12Buddy AI Endpoints

## Overview

All AI operations are routed through Supabase Edge Functions. The client NEVER calls AI providers directly.

## Provider Routing

| Function | Primary Provider | Fallback | Use Case |
|----------|-----------------|----------|----------|
| ai_chat | Anthropic Claude | OpenAI GPT-4o | Tutoring responses |
| ai_ocr | OpenAI GPT-4o Vision | - | Text extraction from images |
| ai_verify | Anthropic Claude | OpenAI GPT-4o | Response verification |

## Endpoints

### `POST /functions/v1/ai_chat`

AI-powered tutoring with curriculum-bounded responses.

**Request**:
```typescript
{
  session_id: string;       // UUID of chat session
  message: string;          // User's question/message
  context: {
    student_id: string;     // UUID
    grade: Grade;           // K, 1-12
    state: string;          // 2-letter state code
    subject: Subject;       // math, science, etc.
    textbook_id?: string;   // Active textbook UUID
    lesson_id?: string;     // Active lesson UUID
    response_style: ResponseStyle;  // explain, hint, practice, etc.
    difficulty: Difficulty; // struggling, average, advanced
  };
  attached_image_path?: string;  // Storage path if image attached
}
```

**Response**:
```typescript
{
  message: {
    id: string;
    session_id: string;
    role: 'assistant';
    content: string;
    verified: boolean;
    created_at: string;
  };
  citations: Array<{
    id: string;
    message_id: string;
    chunk_id: string;
    page_number: number;
    relevance_score: number;
  }>;
  check_for_understanding?: string;
  verification?: {
    ok: boolean;
    issues?: string[];
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
  };
}
```

**Flow**:
1. Validate authentication and student ownership
2. Check usage entitlements (deny if limit exceeded)
3. Retrieve relevant textbook chunks
4. Build prompt with context, chunks, and mode instructions
5. Call Claude (primary) or GPT-4o (fallback)
6. Run verification pass
7. If verification fails, regenerate or request scan
8. Save message, citations, and ai_run to DB
9. Increment usage counters
10. Return response

---

### `POST /functions/v1/ai_ocr`

Extract text and structure from textbook images.

**Request**:
```typescript
{
  student_id: string;       // UUID - for ownership validation
  textbook_id?: string;     // UUID - if processing for a textbook
  image_path: string;       // Storage path to image
  doc_type?: 'cover' | 'toc' | 'page';  // Hint for processing
}
```

**Response**:
```typescript
{
  doc_type: 'cover' | 'toc' | 'page' | 'unknown';
  isbn13: string | null;
  title: string | null;
  publisher: string | null;
  edition: string | null;
  page_number: number | null;
  raw_text: string;
  layout?: Array<{
    type: 'heading' | 'paragraph' | 'list' | 'equation' | 'figure' | 'table';
    content: string;
    bbox?: number[];  // Bounding box coordinates
  }>;
  confidence: number;  // 0-1
  usage: {
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
  };
}
```

**System Prompt**:
```
You are K-12Buddy OCR Extractor. Extract text EXACTLY from the image.
Return strict JSON with doc_type, isbn13, title, publisher, edition,
page_number, raw_text, layout[], confidence.
Do not add explanations. If unsure, set null. Preserve math symbols.
```

---

### `POST /functions/v1/ai_verify`

Verify that a response is curriculum-bounded and appropriate.

**Request**:
```typescript
{
  message_id: string;       // UUID of message to verify
  response_content: string; // The response text to verify
  context: StudentContext;  // Same as chat context
  retrieved_chunks: Array<{
    chunk_id: string;
    page_number: number;
    content: string;
  }>;
}
```

**Response**:
```typescript
{
  ok: boolean;
  issues: string[];
  required_action?: 'none' | 'regenerate' | 'ask_for_scan';
  missing_info_request?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
  };
}
```

**System Prompt**:
```
You are K-12Buddy Answer Verifier. Return strict JSON: ok, issues[],
required_action, missing_info_request.
If any claim is unsupported by retrieved chunks, ok=false and
ask_for_scan or regenerate.
Ensure citations match available pages and language matches grade.
```

---

### `POST /functions/v1/entitlements_get`

Get user's current tier and usage remaining.

**Request**: None (uses auth token)

**Response**:
```typescript
{
  tier: 'free' | 'starter' | 'pro' | 'family';
  limits: {
    ai_queries_per_day: number;
    scans_per_month: number;
    pages_ingested_per_month: number;
    students_max?: number;
  };
  usage: {
    ai_queries_today: number;
    ai_queries_remaining: number;
    scans_this_month: number;
    scans_remaining: number;
    pages_this_month: number;
    pages_remaining: number;
  };
  expires_at: string | null;
}
```

---

### `POST /functions/v1/iap_verify`

Verify App Store purchase and update entitlements.

**Request**:
```typescript
{
  platform: 'ios';
  transaction_id: string;
  receipt_data?: string;  // For legacy receipt validation
  signed_transaction?: string;  // For StoreKit 2
}
```

**Response**:
```typescript
{
  success: boolean;
  tier: string;
  expires_at: string;
  error?: string;
}
```

---

## Authentication

All endpoints require a valid Supabase auth token:

```typescript
const { data } = await supabase.functions.invoke('ai_chat', {
  body: { ... },
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});
```

The Edge Functions extract the user ID from the token and validate ownership of all referenced resources.

## Rate Limiting

Basic rate limiting is implemented per user:

| Tier | Requests/minute | AI queries/day |
|------|-----------------|----------------|
| Free | 10 | 3 |
| Starter | 30 | 50 |
| Pro | 60 | 200 |
| Family | 60 | 200 per student |

Exceeding limits returns:
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```

## Error Responses

All errors follow this format:

```typescript
{
  error: string;          // Human-readable message
  code?: string;          // Error code for programmatic handling
  details?: any;          // Additional context
}
```

Common error codes:
- `UNAUTHORIZED` - Invalid or missing auth token
- `FORBIDDEN` - User doesn't own the resource
- `RATE_LIMITED` - Too many requests
- `QUOTA_EXCEEDED` - Usage limit reached
- `INVALID_REQUEST` - Malformed request body
- `PROVIDER_ERROR` - AI provider returned an error
- `VERIFICATION_FAILED` - Response failed verification

## Logging

Every AI call is logged to the `ai_runs` table:

```sql
INSERT INTO ai_runs (
  user_id, student_id, session_id,
  run_type, provider, model,
  input_tokens, output_tokens, latency_ms,
  status, error
) VALUES (...);
```

This enables:
- Usage tracking for billing
- Performance monitoring
- Debugging failed requests
- Audit trail for compliance

## Safety Guarantees

1. **Curriculum-bounded**: Responses only use retrieved textbook chunks
2. **Grade-appropriate**: Language adapted to student's grade level
3. **Verified**: All tutoring responses pass verification
4. **No hallucination**: If content isn't supported, request page scan
5. **Citation required**: Every claim must reference a page number
6. **No direct answers**: Hint/explain modes guide, don't solve
