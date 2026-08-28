import { createHash } from 'crypto';

/**
 * Deterministically sorts an object's keys recursively so that
 * equivalent JSON payloads produce the exact same serialized string.
 */
function canonicalize(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  if (typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(canonicalize);
  }

  const sortedKeys = Object.keys(data).sort();
  const sortedObj: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = canonicalize(data[key]);
  }
  return sortedObj;
}

/**
 * Generates a SHA-256 hash representing the deterministic fingerprint of a request.
 */
export function generateRequestFingerprint(requestData: any): string {
  const canonicalData = canonicalize(requestData);
  const serialized = JSON.stringify(canonicalData);
  return createHash('sha256').update(serialized || '').digest('hex');
}
