// ============================================
// Test Helpers
// Exportable utilities for integration testing
// ============================================

export {
  serviceClient,
  anonClient,
  TEST_USER,
  trackResource,
  createTestUser,
  createTestStudent,
  createTestTextbook,
  createTestChunks,
  createTestSession,
} from './setup.js';

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options?: {
    timeout?: number;
    interval?: number;
  }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;
  const interval = options?.interval ?? 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random string for test data
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Create sample textbook content for testing
 */
export function createSampleMathContent(): Array<{
  page_number: number;
  content: string;
}> {
  return [
    {
      page_number: 1,
      content: `Chapter 1: Introduction to Numbers

      Numbers are everywhere! We use them to count, measure, and describe quantities.
      In this chapter, you will learn about different types of numbers and how to use them.`,
    },
    {
      page_number: 5,
      content: `Understanding Addition

      Addition is one of the four basic operations in mathematics. When we add numbers together,
      we are finding the total or sum. For example: 3 + 2 = 5. The numbers being added are called
      addends, and the result is called the sum.`,
    },
    {
      page_number: 6,
      content: `Addition Strategies

      There are many ways to add numbers:
      1. Counting on: Start with the larger number and count up.
      2. Using a number line: Visualize the addition.
      3. Making ten: Group numbers to make ten first.
      4. Doubles: Learn doubles facts (2+2, 3+3, etc.)`,
    },
    {
      page_number: 10,
      content: `Understanding Subtraction

      Subtraction is the inverse of addition. When we subtract, we find the difference between
      two numbers. For example: 8 - 3 = 5. We can check subtraction by using addition:
      5 + 3 = 8.`,
    },
    {
      page_number: 15,
      content: `Word Problems

      Word problems help us apply math to real-world situations. Follow these steps:
      1. Read the problem carefully
      2. Identify what you need to find
      3. Choose the operation (add or subtract)
      4. Solve and check your answer`,
    },
    {
      page_number: 20,
      content: `Introduction to Multiplication

      Multiplication is repeated addition. When we multiply 3 × 4, we are adding 3 four times:
      3 + 3 + 3 + 3 = 12. The numbers being multiplied are called factors, and the result
      is called the product.`,
    },
    {
      page_number: 25,
      content: `Division Basics

      Division is the inverse of multiplication. When we divide, we split a number into equal
      groups. For example: 12 ÷ 3 = 4 means 12 split into 3 equal groups gives 4 in each group.`,
    },
    {
      page_number: 30,
      content: `Fractions Introduction

      A fraction represents a part of a whole. The top number (numerator) tells how many parts
      we have, and the bottom number (denominator) tells how many equal parts the whole is
      divided into. For example, 3/4 means 3 out of 4 equal parts.`,
    },
  ];
}

/**
 * Assert that an error response matches expected format
 */
export function assertErrorResponse(
  error: unknown,
  expectedCode?: string
): void {
  expect(error).toBeDefined();

  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (expectedCode) {
      expect((error as { code: string }).code).toBe(expectedCode);
    }
  }
}
