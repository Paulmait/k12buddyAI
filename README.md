# K-12 Buddy Learning

AI-powered learning interface for K-12 students with curriculum-aligned tutoring.

## Project Structure

```
k12buddylearning/
├── apps/
│   └── mobile/          # Expo React Native app
├── packages/
│   └── shared/          # Shared types and utilities
└── supabase/
    ├── functions/       # Edge Functions (AI endpoints)
    └── migrations/      # Database migrations
```

## Tech Stack

- **App**: Expo / React Native with Expo Router
- **Backend**: Supabase (Postgres + Edge Functions)
- **AI**: OpenAI (OCR) + Anthropic Claude (Tutoring)
- **Storage**: Supabase Storage for images

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase CLI
- Expo CLI

### Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up Supabase**
   ```bash
   # Start local Supabase
   pnpm --filter supabase dev

   # Run migrations
   pnpm db:migrate
   ```

3. **Configure environment**
   ```bash
   # Copy example env files
   cp apps/mobile/.env.example apps/mobile/.env
   cp supabase/.env.example supabase/.env

   # Fill in your API keys
   ```

4. **Start the app**
   ```bash
   pnpm dev
   ```

## Development Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Expo development server |
| `pnpm dev:backend` | Start local Supabase |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run unit tests |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:reset` | Reset local database |

## Gated Delivery Process

This project follows a gated delivery approach:

1. **typecheck** - `pnpm -r typecheck`
2. **lint** - `pnpm -r lint`
3. **unit_tests** - `pnpm -r test`
4. **db_migrations** - `pnpm db:migrate && pnpm db:verify`
5. **integration_smoke** - `pnpm test:integration`
6. **e2e_golden_path** - `pnpm test:e2e`

All gates must pass before proceeding to the next development step.

## AI Routing Rules

| Function | Primary Provider | Fallback |
|----------|-----------------|----------|
| Tutoring (chat) | Anthropic Claude | OpenAI |
| OCR | OpenAI (GPT-4o Vision) | - |
| Content Verification | Anthropic Claude | OpenAI |

## Database Schema

Core tables:
- `students` - Student profiles linked to auth
- `textbooks` - Curriculum textbooks by state/subject
- `textbook_chunks` - Chunked content for retrieval
- `chat_sessions` - Tutoring sessions
- `chat_messages` - Individual messages
- `ai_runs` - Audit log of all AI calls

## License

Private - All rights reserved
