import { NotificationAdapter } from '../types.js';
import { ApprovalRecord } from '../../../database/repositories/approval.repository.js';
import { env } from '../../../config/env.js';
import { Resend } from 'resend';

export class ResendNotifier implements NotificationAdapter {
  private resend: Resend | null = null;
  private defaultFromEmail = 'onboarding@resend.dev'; // Resend testing default

  constructor() {
    if (env.providers.resendApiKey) {
      this.resend = new Resend(env.providers.resendApiKey);
    }
  }

  async notify(merchantId: string, approval: ApprovalRecord): Promise<void> {
    const payload = approval.payload as any;
    const toolName = payload?.toolName || 'Unknown Action';
    const amountMinor = payload?.input?.amountMinor || payload?.input?.proposedPriceMinor;
    const amountStr = amountMinor ? `₹${(amountMinor / 100).toFixed(2)}` : 'N/A';

    const baseUrl = env.server.host || 'http://localhost:3000'; // We'll assume localhost for now
    const approveUrl = `http://localhost:3000/api/approvals/${approval.token}/approve`;
    const rejectUrl = `http://localhost:3000/api/approvals/${approval.token}/reject`;

    const htmlBody = `
      <h2>Approval Needed for ${toolName}</h2>
      <p>Your AI Agent requires your approval to proceed with an action.</p>
      <ul>
        <li><strong>Action:</strong> ${toolName}</li>
        <li><strong>Amount:</strong> ${amountStr}</li>
        <li><strong>Session ID:</strong> ${payload?.context?.sessionId || 'Unknown'}</li>
      </ul>
      <p>Click one of the secure links below to decide:</p>
      <a href="${approveUrl}" style="padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">APPROVE</a>
      <a href="${rejectUrl}" style="padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin-left: 10px;">REJECT</a>
    `;

    console.log(`[ResendNotifier] Preparing approval email for merchant_${merchantId}...`);
    
    if (!this.resend) {
      console.log(`[ResendNotifier] RESEND_API_KEY not set. Simulating email:\n${htmlBody}`);
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.defaultFromEmail,
        to: `merchant_${merchantId}@agentic-commerce.com`,
        subject: `[ACTION REQUIRED] Approval Needed for ${toolName}`,
        html: htmlBody,
      });
      console.log(`[ResendNotifier] Successfully sent approval email.`);
    } catch (error) {
      console.error(`[ResendNotifier] Error sending approval email:`, error);
    }
  }

  async sendPaymentLink(buyerEmail: string, orderDetails: any, paymentLinkUrl: string): Promise<void> {
    const htmlBody = `
      <h2>Your order is ready</h2>
      <p>Please complete your payment using the secure link below.</p>
      <ul>
        <li><strong>Total:</strong> ₹${(orderDetails.amountMinor / 100).toFixed(2)}</li>
      </ul>
      <a href="${paymentLinkUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Pay Now</a>
    `;

    console.log(`[ResendNotifier] Preparing payment link email for ${buyerEmail}...`);
    
    if (!this.resend) {
      console.log(`[ResendNotifier] RESEND_API_KEY not set. Simulating email:\n${htmlBody}`);
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.defaultFromEmail,
        to: buyerEmail,
        subject: `Complete your payment — ₹${(orderDetails.amountMinor / 100).toFixed(2)}`,
        html: htmlBody,
      });
      console.log(`[ResendNotifier] Successfully sent payment link email.`);
    } catch (error) {
      console.error(`[ResendNotifier] Error sending payment link email:`, error);
    }
  }
}
