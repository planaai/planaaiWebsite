import fpPromise from '@fingerprintjs/fingerprintjs';

let fpCache: string | null = null;

export const getDeviceFingerprint = async (): Promise<string | null> => {
  if (fpCache) return fpCache;
  if (typeof window === 'undefined') return null;

  try {
    const fp = await fpPromise.load();
    const result = await fp.get();
    fpCache = result.visitorId;
    return fpCache;
  } catch (error) {
    console.error('Failed to generate device fingerprint:', error);
    return null;
  }
};
