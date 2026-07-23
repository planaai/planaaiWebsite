const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET_KEY) {
    // If no key is configured, warn but bypass for local dev environment
    console.warn('RECAPTCHA_SECRET_KEY is not set. Bypassing reCAPTCHA verification.');
    return true;
  }
  if (!token) return false;

  try {
    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });
    
    const data = await response.json();
    return data.success;
  } catch (err) {
    console.error('reCAPTCHA verification error:', err);
    return false;
  }
}

module.exports = {
  verifyRecaptcha,
};
