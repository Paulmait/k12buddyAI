/**
 * E2E Tests for Authentication Flow
 */

import { device, element, by, expect } from 'detox';

describe('Authentication', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Login', () => {
    it('should show login screen on fresh launch', async () => {
      await expect(element(by.id('login-screen'))).toBeVisible();
    });

    it('should show email and password inputs', async () => {
      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
    });

    it('should show error for invalid credentials', async () => {
      await element(by.id('email-input')).typeText('invalid@example.com');
      await element(by.id('password-input')).typeText('wrongpassword');
      await element(by.id('login-button')).tap();

      await expect(element(by.id('error-message'))).toBeVisible();
    });

    it('should navigate to home on successful login', async () => {
      await element(by.id('email-input')).typeText('test@example.com');
      await element(by.id('password-input')).typeText('testpassword123');
      await element(by.id('login-button')).tap();

      await expect(element(by.id('home-screen'))).toBeVisible();
    });
  });

  describe('Sign Up', () => {
    it('should navigate to signup screen', async () => {
      await element(by.id('signup-link')).tap();
      await expect(element(by.id('signup-screen'))).toBeVisible();
    });

    it('should show all required fields', async () => {
      await element(by.id('signup-link')).tap();

      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
      await expect(element(by.id('name-input'))).toBeVisible();
      await expect(element(by.id('grade-picker'))).toBeVisible();
    });

    it('should validate password requirements', async () => {
      await element(by.id('signup-link')).tap();
      await element(by.id('email-input')).typeText('new@example.com');
      await element(by.id('password-input')).typeText('short');
      await element(by.id('signup-button')).tap();

      await expect(element(by.text('Password must be at least 8 characters'))).toBeVisible();
    });
  });

  describe('Logout', () => {
    it('should logout user from profile screen', async () => {
      // First login
      await element(by.id('email-input')).typeText('test@example.com');
      await element(by.id('password-input')).typeText('testpassword123');
      await element(by.id('login-button')).tap();

      // Navigate to profile
      await element(by.id('profile-tab')).tap();

      // Logout
      await element(by.id('logout-button')).tap();

      // Should be back at login screen
      await expect(element(by.id('login-screen'))).toBeVisible();
    });
  });
});
