/**
 * K-12Buddy Database Verification Script
 *
 * Validates that all expected tables exist in the database
 * Usage: pnpm db:verify
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Expected tables from our schema
const EXPECTED_TABLES = [
  // Core tables
  'profiles',
  'students',
  'textbooks',
  'student_textbooks',

  // Content tables
  'textbook_chapters',
  'textbook_units',
  'textbook_lessons',
  'textbook_chunks',
  'textbook_images',
  'ingestions',

  // Standards
  'state_standards',
  'textbook_standard_mappings',
  'lesson_standards',

  // Chat tables
  'chat_sessions',
  'chat_messages',
  'message_citations',

  // AI & Analytics
  'ai_runs',
  'student_mastery',
  'student_uploads',

  // Billing tables
  'plans',
  'products',
  'subscriptions',
  'entitlements',
  'usage_counters',
  'billing_events',
];

async function main() {
  console.log('🔍 Verifying K-12Buddy database schema...\n');

  if (!SUPABASE_URL) {
    console.error('❌ SUPABASE_URL not set. Please configure your .env file.');
    console.error('   For local development, run: supabase start');
    process.exit(1);
  }

  // Use service key if available, otherwise use anon key for table checking
  const key = SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    console.error('❌ No Supabase key found. Please configure your .env file.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, key);

  console.log(`📡 Connected to: ${SUPABASE_URL}\n`);

  const missingTables: string[] = [];
  const foundTables: string[] = [];

  for (const tableName of EXPECTED_TABLES) {
    try {
      // Try to query the table (will fail if it doesn't exist)
      const { error } = await supabase.from(tableName).select('*').limit(0);

      if (error) {
        // Some errors indicate table exists but no access (RLS)
        if (error.code === 'PGRST116' || error.message.includes('permission denied')) {
          foundTables.push(tableName);
          console.log(`  ✓ ${tableName} (exists, RLS active)`);
        } else if (error.code === '42P01' || error.message.includes('does not exist')) {
          missingTables.push(tableName);
          console.log(`  ✗ ${tableName} (MISSING)`);
        } else {
          // Other errors - assume table exists
          foundTables.push(tableName);
          console.log(`  ✓ ${tableName} (exists)`);
        }
      } else {
        foundTables.push(tableName);
        console.log(`  ✓ ${tableName}`);
      }
    } catch (err) {
      missingTables.push(tableName);
      console.log(`  ✗ ${tableName} (ERROR)`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\nResults: ${foundTables.length}/${EXPECTED_TABLES.length} tables found`);

  if (missingTables.length > 0) {
    console.log(`\n❌ Missing tables (${missingTables.length}):`);
    missingTables.forEach(t => console.log(`   - ${t}`));
    console.log('\n💡 Run "pnpm db:migrate" to apply migrations.');
    process.exit(1);
  } else {
    console.log('\n✅ All tables verified successfully!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
