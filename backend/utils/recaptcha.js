const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

async function verifyRecaptcha(token) {
  if (!TURNSTILE_SECRET_KEY) {
    // If no key is configured, warn but bypass for local dev environment
    console.warn('TURNSTILE_SECRET_KEY is not set. Bypassing Turnstile verification.');
    return true;
  }
  if (!token) return false;

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}

module.exports = {
  verifyRecaptcha,
};
