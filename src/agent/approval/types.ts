import { ApprovalRecord } from '../../database/repositories/approval.repository.js';

export interface NotificationAdapter {
  notify(merchantId: string, approval: ApprovalRecord): Promise<void>;
}
