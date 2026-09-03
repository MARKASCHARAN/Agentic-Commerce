import { NotificationAdapter } from '../types.js';
import { ApprovalRecord } from '../../../../infrastructure/database/repositories/approval.repository.js';
import { env } from '../../../../config/env.js';

export class WhatsAppNotifier implements NotificationAdapter {
  async notify(merchantId: string, approval: ApprovalRecord): Promise<void> {
    const payload = approval.payload as any;
    const toolName = payload?.toolName || 'Unknown Action';
    const amountMinor = payload?.input?.amountMinor;
    const amountStr = amountMinor ? `₹${(amountMinor / 100).toFixed(2)}` : 'N/A';

    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const approveUrl = `${baseUrl}/api/approvals/${approval.token}/approve`;
    const rejectUrl = `${baseUrl}/api/approvals/${approval.token}/reject`;

    const whatsAppMessage = `
===================================================
📱 NEW WHATSAPP MESSAGE
===================================================
To: WhatsApp Business [Merchant ${merchantId}]
AI Agent requests approval for: *${toolName}*

Amount: ${amountStr}
Session: ${payload?.context?.sessionId || 'Unknown'}

Reply using the links below:
✅ Approve: ${approveUrl}
❌ Reject: ${rejectUrl}
===================================================`;

    console.log(whatsAppMessage);
    
    // In a real production system, we would integrate Twilio or WhatsApp Business API here.
    // e.g. await twilio.messages.create({ to, from, body: whatsAppMessage });
  }
}
