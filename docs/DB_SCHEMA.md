# K-12Buddy Database Schema

## Overview

The K-12Buddy database is built on Supabase (PostgreSQL) with Row-Level Security (RLS) enabled for all user data tables.

## Entity Relationship

```
auth.users
    │
    ├── profiles (1:1)
    │
    ├── students (1:N, via owner_user_id)
    │       │
    │       ├── student_textbooks (N:M with textbooks)
    │       ├── student_mastery (1:N)
    │       └── chat_sessions (1:N)
    │               │
    │               └── chat_messages (1:N)
    │                       │
    │                       └── message_citations (1:N)
    │
    ├── textbooks (1:N, via owner_user_id)
    │       │
    │       ├── textbook_units (1:N)
    │       │       │
    │       │       └── textbook_lessons (1:N)
    │       │               │
    │       │               └── lesson_standards (N:M with state_standards)
    │       │
    │       ├── textbook_chunks (1:N)
    │       ├── textbook_images (1:N)
    │       └── ingestions (1:N)
    │
    ├── entitlements (1:1)
    ├── subscriptions (1:N)
    ├── usage_counters (1:N per period)
    └── ai_runs (1:N)
```

## Core Tables

### `profiles`
Extends auth.users with additional profile information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK, FK) | References auth.users.id |
| email | VARCHAR(255) | User email |
| display_name | VARCHAR(100) | Display name |
| avatar_url | VARCHAR(500) | Profile picture URL |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### `students`
Student profiles managed by a parent/teacher account.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Student ID |
| owner_user_id | UUID (FK) | Parent/teacher user ID |
| user_id | UUID (FK) | Optional linked auth user |
| name | VARCHAR(100) | Student name |
| grade | grade_level | K, 1-12 |
| state | VARCHAR(2) | US state code |
| county | VARCHAR(100) | County name |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### `textbooks`
Curriculum textbooks uploaded and processed by users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Textbook ID |
| owner_user_id | UUID (FK) | Owner user ID |
| title | VARCHAR(500) | Textbook title |
| publisher | VARCHAR(200) | Publisher name |
| isbn13 | VARCHAR(13) | ISBN-13 |
| subject | subject_type | math, english, science, etc. |
| grade_levels | grade_level[] | Array of applicable grades |
| state | VARCHAR(2) | State curriculum alignment |
| edition_year | INTEGER | Publication year |
| cover_image_path | VARCHAR(500) | Storage path to cover image |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

## Content Tables

### `textbook_units`
Table of contents - chapters/units.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unit ID |
| textbook_id | UUID (FK) | Parent textbook |
| unit_number | INTEGER | Sequential unit number |
| title | VARCHAR(500) | Unit title |
| page_start | INTEGER | Starting page |
| page_end | INTEGER | Ending page |
| created_at | TIMESTAMPTZ | Creation timestamp |

### `textbook_lessons`
Table of contents - lessons within units.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Lesson ID |
| textbook_id | UUID (FK) | Parent textbook |
| unit_id | UUID (FK) | Parent unit (optional) |
| lesson_number | INTEGER | Sequential lesson number |
| title | VARCHAR(500) | Lesson title |
| page_start | INTEGER | Starting page |
| page_end | INTEGER | Ending page |
| created_at | TIMESTAMPTZ | Creation timestamp |

### `textbook_chunks`
Chunked text content for retrieval.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Chunk ID |
| textbook_id | UUID (FK) | Parent textbook |
| lesson_id | UUID (FK) | Associated lesson (optional) |
| page_number | INTEGER | Source page number |
| chunk_index | INTEGER | Order within page |
| content | TEXT | Chunk text content |
| content_hash | VARCHAR(64) | SHA-256 hash for deduplication |
| token_estimate | INTEGER | Estimated token count |
| embedding_id | VARCHAR(100) | External vector store ID |
| created_at | TIMESTAMPTZ | Creation timestamp |

### `ingestions`
Tracks OCR processing of uploaded images.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Ingestion ID |
| textbook_id | UUID (FK) | Parent textbook |
| upload_type | upload_type | cover, toc, page, etc. |
| storage_path | VARCHAR(500) | Path in Supabase Storage |
| status | ingestion_status | pending, processing, completed, failed |
| page_number | INTEGER | Detected page number |
| ocr_result | JSONB | Raw OCR JSON output |
| error_message | TEXT | Error details if failed |
| created_at | TIMESTAMPTZ | Creation timestamp |
| processed_at | TIMESTAMPTZ | Processing completion time |

## Chat Tables

### `chat_sessions`
Tutoring chat sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Session ID |
| student_id | UUID (FK) | Student using the chat |
| textbook_id | UUID (FK) | Active textbook |
| lesson_id | UUID (FK) | Active lesson |
| response_style | response_style | explain, hint, practice, etc. |
| difficulty | difficulty_level | struggling, average, advanced |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last activity timestamp |

### `chat_messages`
Individual messages in chat sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Message ID |
| session_id | UUID (FK) | Parent session |
| role | message_role | user, assistant, system |
| content | TEXT | Message content |
| verified | BOOLEAN | Verification status |
| created_at | TIMESTAMPTZ | Creation timestamp |

### `message_citations`
Citations linking messages to textbook chunks.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Citation ID |
| message_id | UUID (FK) | Parent message |
| chunk_id | UUID (FK) | Referenced chunk |
| page_number | INTEGER | Page number for display |
| relevance_score | FLOAT | Retrieval relevance (0-1) |
| created_at | TIMESTAMPTZ | Creation timestamp |

## AI & Analytics Tables

### `ai_runs`
Audit log of all AI API calls.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Run ID |
| user_id | UUID (FK) | User who triggered |
| student_id | UUID (FK) | Associated student |
| session_id | UUID (FK) | Associated chat session |
| run_type | ai_run_type | chat, ocr, verify |
| provider | ai_provider | openai, anthropic |
| model | VARCHAR(100) | Model identifier |
| input_tokens | INTEGER | Input token count |
| output_tokens | INTEGER | Output token count |
| latency_ms | INTEGER | Response latency |
| status | ai_run_status | pending, running, completed, failed |
| error | TEXT | Error message if failed |
| created_at | TIMESTAMPTZ | Creation timestamp |

### `student_mastery`
Tracks student progress per standard/lesson.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Mastery record ID |
| student_id | UUID (FK) | Student |
| standard_id | UUID (FK) | State standard |
| lesson_id | UUID (FK) | Textbook lesson |
| mastery_level | NUMERIC(5,2) | Mastery percentage (0-100) |
| last_practiced_at | TIMESTAMPTZ | Last practice time |
| practice_count | INTEGER | Total practice attempts |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

## Billing Tables

### `plans`
Subscription plan definitions.

| Column | Type | Description |
|--------|------|-------------|
| plan_id | UUID (PK) | Plan ID |
| tier | plan_tier | free, starter, pro, family |
| name | VARCHAR(50) | Display name |
| is_family | BOOLEAN | Multi-student plan |
| limits | JSONB | Usage limits |
| created_at | TIMESTAMPTZ | Creation timestamp |

### `entitlements`
Effective entitlements per user.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID (PK, FK) | User ID |
| effective_tier | plan_tier | Current plan tier |
| expires_at | TIMESTAMPTZ | Expiration (null = never) |
| source | VARCHAR(20) | storekit, admin, trial, free |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### `usage_counters`
Usage tracking per billing period.

| Column | Type | Description |
|--------|------|-------------|
| usage_id | UUID (PK) | Record ID |
| user_id | UUID (FK) | User ID |
| period_start | DATE | Period start date |
| period_end | DATE | Period end date |
| ai_queries | INTEGER | AI query count |
| scans | INTEGER | Scan count |
| pages_ingested | INTEGER | Pages processed |
| updated_at | TIMESTAMPTZ | Last update timestamp |

## Helper Functions

### `get_effective_plan(user_id UUID)`
Returns the user's current plan tier and limits.

### `get_current_usage(user_id UUID)`
Gets or creates the current period's usage record.

### `increment_usage(user_id UUID, ai_queries INT, scans INT, pages INT)`
Atomically increments usage counters.

## Row-Level Security

All user data tables have RLS enabled with policies that:
- Allow users to read/write only their own data
- Use `owner_user_id` for hierarchical ownership (students, textbooks)
- Allow service role to bypass RLS for admin operations
- Public read access for reference data (plans, standards, products)

## Enums

| Enum | Values |
|------|--------|
| grade_level | K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 |
| subject_type | math, english, science, social_studies, reading, writing |
| response_style | explain, hint, practice, check_answer, review |
| difficulty_level | struggling, average, advanced |
| ai_provider | openai, anthropic |
| ai_run_type | chat, ocr, verify |
| ai_run_status | pending, running, completed, failed |
| message_role | user, assistant, system |
| upload_type | cover, toc, page, question, assignment |
| ingestion_status | pending, processing, completed, failed |
| plan_tier | free, starter, pro, family |
| subscription_status | active, grace, expired, revoked, canceled |
| billing_event_type | purchase, renewal, cancel, restore, verify_fail, upgrade, downgrade |
