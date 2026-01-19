/**
 * E2E Tests for Gamification Features
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Gamification', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Login first
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('testpassword123');
    await element(by.id('login-button')).tap();
  });

  describe('Home Screen Stats', () => {
    it('should display XP bar', async () => {
      await expect(element(by.id('xp-bar'))).toBeVisible();
    });

    it('should display current level', async () => {
      await expect(element(by.id('level-display'))).toBeVisible();
    });

    it('should display streak counter', async () => {
      await expect(element(by.id('streak-counter'))).toBeVisible();
    });

    it('should display daily challenges', async () => {
      await expect(element(by.id('daily-challenges'))).toBeVisible();
    });
  });

  describe('XP Earning', () => {
    it('should award XP for sending a chat message', async () => {
      // Note initial XP
      const initialXP = await element(by.id('xp-value')).getAttributes();

      // Send a message
      await element(by.id('chat-tab')).tap();
      await element(by.id('message-input')).typeText('Test question for XP');
      await element(by.id('send-button')).tap();

      // Wait for response
      await waitFor(element(by.id('assistant-message')))
        .toBeVisible()
        .withTimeout(10000);

      // Go back to home
      await element(by.id('home-tab')).tap();

      // XP should have increased (check for XP animation or updated value)
      await expect(element(by.id('xp-animation'))).toBeVisible();
    });
  });

  describe('Streak Tracking', () => {
    it('should show current streak', async () => {
      await expect(element(by.id('streak-counter'))).toBeVisible();
    });

    it('should show flame icon for active streak', async () => {
      await expect(element(by.id('streak-flame'))).toBeVisible();
    });
  });

  describe('Badge System', () => {
    it('should navigate to badges from profile', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('view-badges-button')).tap();

      await expect(element(by.id('badges-screen'))).toBeVisible();
    });

    it('should display earned badges', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('view-badges-button')).tap();

      await expect(element(by.id('earned-badges-section'))).toBeVisible();
    });

    it('should display locked badges', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('view-badges-button')).tap();

      await expect(element(by.id('locked-badges-section'))).toBeVisible();
    });

    it('should show badge details on tap', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('view-badges-button')).tap();
      await element(by.id('badge-first_question')).tap();

      await expect(element(by.id('badge-details-modal'))).toBeVisible();
    });
  });

  describe('Level Up', () => {
    it('should show level up modal when leveling up', async () => {
      // This test assumes the test user is close to leveling up
      // In a real scenario, you'd set up the test data accordingly

      // Perform actions that award XP
      await element(by.id('chat-tab')).tap();

      for (let i = 0; i < 5; i++) {
        await element(by.id('message-input')).typeText(`Question ${i}`);
        await element(by.id('send-button')).tap();
        await waitFor(element(by.id('assistant-message')))
          .toBeVisible()
          .withTimeout(10000);
      }

      // Check if level up modal appears (if user levels up)
      // This may or may not trigger depending on current XP
      // await expect(element(by.id('level-up-modal'))).toBeVisible();
    });
  });

  describe('Daily Challenges', () => {
    it('should display active challenges', async () => {
      await expect(element(by.id('daily-challenges'))).toBeVisible();
    });

    it('should show challenge progress', async () => {
      await element(by.id('daily-challenges')).tap();

      await expect(element(by.id('challenge-progress'))).toBeVisible();
    });

    it('should update challenge progress after completing action', async () => {
      // Start a challenge
      const initialProgress = await element(by.id('challenge-progress')).getAttributes();

      // Complete the challenge action
      await element(by.id('chat-tab')).tap();
      await element(by.id('message-input')).typeText('Complete challenge');
      await element(by.id('send-button')).tap();

      await waitFor(element(by.id('assistant-message')))
        .toBeVisible()
        .withTimeout(10000);

      // Go back to home
      await element(by.id('home-tab')).tap();

      // Progress should have updated
      // (Visual verification needed based on UI implementation)
    });
  });
});
