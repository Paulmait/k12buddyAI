/**
 * E2E Global Setup
 */

const detox = require('detox');
const config = require('../.detoxrc.js');

async function globalSetup() {
  await detox.globalInit();
}

module.exports = globalSetup;
