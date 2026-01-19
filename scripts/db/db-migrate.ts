/**
 * K-12Buddy Database Migration Script
 *
 * Runs Supabase migrations using the CLI
 * Usage: pnpm db:migrate
 */

import { execSync } from 'child_process';
import path from 'path';

const SUPABASE_DIR = path.resolve(process.cwd(), '../../supabase');

async function main() {
  console.log('🔄 Running K-12Buddy database migrations...\n');

  try {
    // Check if Supabase CLI is available
    try {
      execSync('supabase --version', { stdio: 'pipe' });
    } catch {
      console.error('❌ Supabase CLI not found. Please install it:');
      console.error('   npm install -g supabase');
      process.exit(1);
    }

    // Run migrations
    console.log('📦 Applying migrations...');
    execSync(`supabase db push`, {
      cwd: SUPABASE_DIR,
      stdio: 'inherit',
    });

    console.log('\n✅ Migrations applied successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
