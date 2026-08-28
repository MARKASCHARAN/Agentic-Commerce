export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';

export interface IdempotencyRecord {
  id: string;
  idempotencyKey: string;
  scope: string;
  requestFingerprint: string;
  status: IdempotencyStatus;
  result?: any;
  error?: any;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
