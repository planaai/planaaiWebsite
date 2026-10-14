/**
 * Systematic Test Suite for Cloudflare Turnstile Verification
 * Tests edge cases, parameter forwarding, error handling, and security invariants.
 */
const assert = require('node:assert');
const test = require('node:test');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { verifyRecaptcha } = require('../utils/recaptcha');

test('1. [Edge Case] verifyRecaptcha with missing or empty token', async () => {
  // Must return false without throwing or calling external network
  const nullToken = await verifyRecaptcha(null);
  assert.strictEqual(nullToken, false, 'null token must return false');

  const emptyToken = await verifyRecaptcha('');
  assert.strictEqual(emptyToken, false, 'empty token must return false');

  const undefinedToken = await verifyRecaptcha(undefined);
  assert.strictEqual(undefinedToken, false, 'undefined token must return false');
});

test('2. [Dev Bypass] verifyRecaptcha when TURNSTILE_SECRET_KEY is absent', async () => {
  const originalKey = process.env.TURNSTILE_SECRET_KEY;
  try {
    delete process.env.TURNSTILE_SECRET_KEY;
    const result = await verifyRecaptcha('any-token');
    assert.strictEqual(result, true, 'missing key should bypass and return true in dev');
  } finally {
    process.env.TURNSTILE_SECRET_KEY = originalKey;
  }
});

test('3. [Dynamic Env Evaluation] verifyRecaptcha dynamically reads process.env', async () => {
  const originalKey = process.env.TURNSTILE_SECRET_KEY;
  try {
    // Override key dynamically
    process.env.TURNSTILE_SECRET_KEY = 'custom_mock_key';
    let requestedBody = null;
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
      requestedBody = JSON.parse(options.body);
      return {
        json: async () => ({ success: true })
      };
    };

    const res = await verifyRecaptcha('mock_token_123', '203.0.113.195');
    assert.strictEqual(res, true);
    assert.strictEqual(requestedBody.secret, 'custom_mock_key', 'Secret must match dynamically loaded env');
    assert.strictEqual(requestedBody.response, 'mock_token_123', 'Response token must match argument');
    assert.strictEqual(requestedBody.remoteip, '203.0.113.195', 'remoteip must be forwarded');

    global.fetch = originalFetch;
  } finally {
    process.env.TURNSTILE_SECRET_KEY = originalKey;
  }
});

test('4. [Live Cloudflare API] verifyRecaptcha with actual secret key and invalid token', async () => {
  assert.ok(process.env.TURNSTILE_SECRET_KEY, 'TURNSTILE_SECRET_KEY must be configured in .env');

  // Query actual Cloudflare endpoint with an intentionally invalid token
  const result = await verifyRecaptcha('invalid_token_for_testing', '127.0.0.1');
  
  // Real Cloudflare Turnstile endpoint must reject this token and return false
  assert.strictEqual(result, false, 'Invalid token must be rejected by Cloudflare');
});

test('5. [Network / HTTP Exception Recovery] verifyRecaptcha handles network failure gracefully', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => {
      throw new Error('Simulated DNS/Network Failure');
    };

    const result = await verifyRecaptcha('some_token');
    assert.strictEqual(result, false, 'Network exception must be caught and return false');
  } finally {
    global.fetch = originalFetch;
  }
});

test('6. [Auth Integration] registerUser rejects registration when Turnstile verification fails', async () => {
  const { registerUser } = require('../services/authService');
  
  await assert.rejects(
    async () => {
      await registerUser({
        username: 'test_user_turnstile',
        password: 'password123',
        turnstileToken: 'fake_bot_token'
      }, '127.0.0.1');
    },
    (err) => {
      assert.match(err.message, /보안 인증 실패/, 'Should reject with security verification failure');
      return true;
    }
  );
});
