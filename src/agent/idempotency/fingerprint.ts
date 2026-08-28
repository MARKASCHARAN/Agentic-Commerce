import { createHash } from 'crypto';

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

export function generateRequestFingerprint(requestData: any): string {
  const canonicalData = canonicalize(requestData);
  const serialized = JSON.stringify(canonicalData);
  return createHash('sha256').update(serialized || '').digest('hex');
}
