/**
 * Cloudflare Turnstile token verification
 * @param {string} token - Turnstile token from client
 * @param {string} [remoteip] - Optional client IP address
 * @returns {Promise<boolean>}
 */
async function verifyRecaptcha(token, remoteip) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    // If no key is configured, warn but bypass for local dev environment
    console.warn('TURNSTILE_SECRET_KEY is not set. Bypassing Turnstile verification.');
    return true;
  }
  if (!token) return false;

  try {
    const payload = {
      secret: secretKey,
      response: token,
    };
    if (remoteip) {
      payload.remoteip = remoteip;
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!data.success) {
      console.warn('Turnstile verification failed:', data['error-codes'] || data);
    }
    return Boolean(data.success);
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}

module.exports = {
  verifyRecaptcha,
};
