/**
 * E2E Tests for Chat Flow
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Chat', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Login first
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('testpassword123');
    await element(by.id('login-button')).tap();
    // Navigate to chat
    await element(by.id('chat-tab')).tap();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await element(by.id('chat-tab')).tap();
  });

  describe('Chat Interface', () => {
    it('should show chat screen', async () => {
      await expect(element(by.id('chat-screen'))).toBeVisible();
    });

    it('should show message input', async () => {
      await expect(element(by.id('message-input'))).toBeVisible();
    });

    it('should show send button', async () => {
      await expect(element(by.id('send-button'))).toBeVisible();
    });
  });

  describe('Sending Messages', () => {
    it('should send a message', async () => {
      await element(by.id('message-input')).typeText('What is 2 + 2?');
      await element(by.id('send-button')).tap();

      await expect(element(by.text('What is 2 + 2?'))).toBeVisible();
    });

    it('should show loading indicator while waiting for response', async () => {
      await element(by.id('message-input')).typeText('Help me with math');
      await element(by.id('send-button')).tap();

      await expect(element(by.id('loading-indicator'))).toBeVisible();
    });

    it('should receive AI response', async () => {
      await element(by.id('message-input')).typeText('What is the capital of France?');
      await element(by.id('send-button')).tap();

      await waitFor(element(by.id('assistant-message')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should disable send button when input is empty', async () => {
      await element(by.id('message-input')).clearText();

      // Check if button is disabled (not tappable or visually disabled)
      await expect(element(by.id('send-button'))).toHaveLabel('Send (disabled)');
    });
  });

  describe('Subject Selection', () => {
    it('should show subject picker', async () => {
      await element(by.id('subject-picker')).tap();

      await expect(element(by.text('Math'))).toBeVisible();
      await expect(element(by.text('Science'))).toBeVisible();
      await expect(element(by.text('English'))).toBeVisible();
    });

    it('should change subject context', async () => {
      await element(by.id('subject-picker')).tap();
      await element(by.text('Science')).tap();

      await expect(element(by.id('current-subject'))).toHaveText('Science');
    });
  });

  describe('Chat History', () => {
    it('should persist messages', async () => {
      await element(by.id('message-input')).typeText('Test persistence');
      await element(by.id('send-button')).tap();

      // Reload app
      await device.reloadReactNative();
      await element(by.id('chat-tab')).tap();

      // Message should still be visible
      await expect(element(by.text('Test persistence'))).toBeVisible();
    });

    it('should allow scrolling through history', async () => {
      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        await element(by.id('message-input')).typeText(`Message ${i}`);
        await element(by.id('send-button')).tap();
        await waitFor(element(by.id('assistant-message')))
          .toBeVisible()
          .withTimeout(10000);
      }

      // Scroll up
      await element(by.id('message-list')).scroll(500, 'up');

      // Earlier messages should be visible
      await expect(element(by.text('Message 0'))).toBeVisible();
    });
  });
});
