/**
 * E2E Test Initialization
 */

import { device, beforeAll, afterAll } from 'detox';

beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    permissions: {
      camera: 'YES',
      notifications: 'YES',
    },
  });
});

afterAll(async () => {
  await device.terminateApp();
});
