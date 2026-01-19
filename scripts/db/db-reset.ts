/**
 * K-12Buddy Database Reset Script
 *
 * Resets the local Supabase database (DESTRUCTIVE!)
 * Usage: pnpm db:reset
 */

import { execSync } from 'child_process';
import path from 'path';
import readline from 'readline';

const SUPABASE_DIR = path.resolve(process.cwd(), '../../supabase');

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${message} (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('⚠️  K-12Buddy Database Reset\n');
  console.log('This will DESTROY all data in your local database.');
  console.log('This action cannot be undone.\n');

  const confirmed = await confirm('Are you sure you want to continue?');

  if (!confirmed) {
    console.log('\n❌ Reset cancelled.');
    process.exit(0);
  }

  console.log('\n🔄 Resetting database...');

  try {
    execSync('supabase db reset', {
      cwd: SUPABASE_DIR,
      stdio: 'inherit',
    });

    console.log('\n✅ Database reset successfully!');
    console.log('   All migrations have been re-applied.');
  } catch (error) {
    console.error('\n❌ Reset failed:', error);
    process.exit(1);
  }
}

main();
