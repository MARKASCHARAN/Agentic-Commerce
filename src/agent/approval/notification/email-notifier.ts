import { NotificationAdapter } from '../types.js';
import { ApprovalRecord } from '../../../database/repositories/approval.repository.js';
import { env } from '../../../config/env.js';

export class EmailNotifier implements NotificationAdapter {
  async notify(merchantId: string, approval: ApprovalRecord): Promise<void> {
    const payload = approval.payload as any;
    const toolName = payload?.toolName || 'Unknown Action';
    const amountMinor = payload?.input?.amountMinor;
    const amountStr = amountMinor ? `₹${(amountMinor / 100).toFixed(2)}` : 'N/A';

    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const approveUrl = `${baseUrl}/api/approvals/${approval.token}/approve`;
    const rejectUrl = `${baseUrl}/api/approvals/${approval.token}/reject`;

    const emailBody = `
===================================================
📩 NEW MERCHANT EMAIL
===================================================
To: merchant_${merchantId}@agentic-commerce.com
Subject: [ACTION REQUIRED] Approval Needed for ${toolName}

Your AI Agent requires your approval to proceed with an action.

Action: ${toolName}
Amount: ${amountStr}
Session ID: ${payload?.context?.sessionId || 'Unknown'}

Click one of the secure links below to decide:
✅ [APPROVE] ${approveUrl}
❌ [REJECT] ${rejectUrl}

(These links expire in 24 hours)
===================================================`;

    console.log(emailBody);
    
    // In a real production system, we would integrate SendGrid, Resend, or Nodemailer here.
    // e.g. await sendGrid.send({ to, subject, html: emailBody });
  }
}
