import { ApprovalRepository, ApprovalRecord } from '../../../infrastructure/database/repositories/approval.repository.js';
import { NotificationAdapter } from './types.js';

export class ApprovalEngine {
  private notifiers: NotificationAdapter[] = [];

  constructor(private readonly approvalRepository: ApprovalRepository) {}

  registerNotifier(notifier: NotificationAdapter) {
    this.notifiers.push(notifier);
  }

  async requireApproval(merchantId: string, entityType: string, entityId: string, payload: any): Promise<ApprovalRecord> {
    const approval = await this.approvalRepository.create(entityType, entityId, 'PENDING', payload);
    
    // Broadcast to all registered notifiers asynchronously
    Promise.allSettled(
      this.notifiers.map(notifier => notifier.notify(merchantId, approval))
    ).catch(e => console.error('Failed to notify merchant of approval request:', e));

    return approval;
  }
}
