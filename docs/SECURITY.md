# K12Buddy Security Guidelines

## Overview

K12Buddy handles sensitive educational data and AI API keys. This document outlines security best practices.

## Key Security Principles

### 1. Never Expose Secrets in Code

**NEVER commit these to version control:**
- Service role keys (`SUPABASE_SERVICE_ROLE_KEY`)
- AI API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- Any key that bypasses RLS or grants elevated access

**Safe for client-side (but still don't commit):**
- Supabase URL (public)
- Supabase anon key (designed for client use, respects RLS)

### 2. API Key Classification

| Key Type | Where to Store | Can be in Client? |
|----------|---------------|-------------------|
| `SUPABASE_URL` | `.env.local`, Dashboard | ✅ Yes |
| `SUPABASE_ANON_KEY` | `.env.local`, Dashboard | ✅ Yes (RLS protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secrets only | ❌ NEVER |
| `OPENAI_API_KEY` | Supabase Secrets only | ❌ NEVER |
| `ANTHROPIC_API_KEY` | Supabase Secrets only | ❌ NEVER |

### 3. Supabase Secrets Management

All sensitive API keys should be stored in Supabase Edge Function Secrets:

1. Go to Supabase Dashboard
2. Navigate to Edge Functions > Secrets
3. Add each secret key-value pair
4. Reference in Edge Functions via `Deno.env.get('KEY_NAME')`

```typescript
// In Edge Function - this is safe
const apiKey = Deno.env.get('OPENAI_API_KEY');

// NEVER do this in client code
// const apiKey = process.env.OPENAI_API_KEY; // ❌ WRONG
```

### 4. Row Level Security (RLS)

All user data tables have RLS enabled:

```sql
-- Example: Users can only see their own students
CREATE POLICY students_select ON students
  FOR SELECT USING (owner_user_id = auth.uid());
```

The anon key respects RLS, but the service role key bypasses it.

### 5. Client Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                     │
│  Only has: SUPABASE_URL + SUPABASE_ANON_KEY             │
│  - Authenticates users                                   │
│  - Queries data (RLS enforced)                          │
│  - Calls Edge Functions for AI                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase Edge Functions                 │
│  Has: SERVICE_ROLE_KEY + AI API Keys                    │
│  - Validates authentication                             │
│  - Checks entitlements                                  │
│  - Calls AI providers                                   │
│  - Verifies responses                                   │
│  - Logs usage                                           │
└─────────────────────────────────────────────────────────┘
```

### 6. Pre-commit Checklist

Before every commit, verify:

- [ ] No `.env` files (except `.env.example`)
- [ ] No API keys in code
- [ ] No service role keys anywhere
- [ ] `.gitignore` includes all secret patterns

### 7. Git Security Commands

Check for accidentally staged secrets:
```bash
# Search for potential API keys in staged files
git diff --cached | grep -iE "(api_key|secret|password|service_role)"

# Check git history for secrets (if already committed)
git log -p | grep -iE "(sk-|api_key|secret_key)"
```

### 8. Environment Setup

For local development:
1. Copy `.env.example` to `.env.local`
2. Fill in your Supabase URL and anon key
3. For AI keys, use Supabase Dashboard secrets

For production:
1. All secrets managed via Supabase Dashboard
2. No secrets in code or environment files
3. CI/CD uses GitHub Secrets for build vars

### 9. Incident Response

If a secret is accidentally committed:

1. **Immediately** rotate the compromised key
2. Remove from git history: `git filter-branch` or BFG Repo Cleaner
3. Force push to remote
4. Notify team members to re-clone
5. Document the incident

### 10. Security Contacts

For security issues, contact the repository owner immediately.

## Compliance Notes

- All AI responses are verified before display
- User data is isolated via RLS
- All API calls are logged for audit
- Children's data (COPPA) considerations apply
