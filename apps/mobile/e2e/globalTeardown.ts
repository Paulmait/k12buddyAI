/**
 * E2E Global Teardown
 */

const detox = require('detox');

async function globalTeardown() {
  await detox.globalCleanup();
}

module.exports = globalTeardown;
