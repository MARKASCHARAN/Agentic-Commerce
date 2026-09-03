import { ApprovalRecord } from '../../../infrastructure/database/repositories/approval.repository.js';

export interface NotificationAdapter {
  notify(merchantId: string, approval: ApprovalRecord): Promise<void>;
}
