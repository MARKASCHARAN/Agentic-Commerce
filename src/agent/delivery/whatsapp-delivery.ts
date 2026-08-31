export interface DeliveryAdapter {
  sendPaymentLink(recipient: string, orderDetails: any, paymentLinkUrl: string): Promise<void>;
  sendApprovalRequest(recipient: string, approvalDetails: any): Promise<void>;
}

export class WhatsAppDelivery implements DeliveryAdapter {
  private isConfigured: boolean;

  constructor(private apiKey?: string, private phoneNumberId?: string) {
    this.isConfigured = !!apiKey && !!phoneNumberId;
  }

  async sendPaymentLink(recipient: string, orderDetails: any, paymentLinkUrl: string): Promise<void> {
    if (!this.isConfigured) {
      console.log(`[WhatsAppDelivery] Not configured. Would have sent payment link to ${recipient}`);
      return;
    }

    console.log(`[WhatsAppDelivery] Sending real WhatsApp message to ${recipient}...`);
    // Example integration using WhatsApp Cloud API
    // await fetch(`https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.apiKey}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     messaging_product: 'whatsapp',
    //     to: recipient,
    //     type: 'template',
    //     template: {
    //       name: 'payment_link',
    //       language: { code: 'en_US' },
    //       components: [
    //         {
    //           type: 'body',
    //           parameters: [
    //             { type: 'text', text: orderDetails.amountMinor / 100 },
    //             { type: 'text', text: paymentLinkUrl }
    //           ]
    //         }
    //       ]
    //     }
    //   })
    // });
  }

  async sendApprovalRequest(recipient: string, approvalDetails: any): Promise<void> {
    if (!this.isConfigured) {
      console.log(`[WhatsAppDelivery] Not configured. Would have sent approval request to ${recipient}`);
      return;
    }

    console.log(`[WhatsAppDelivery] Sending real WhatsApp approval request to ${recipient}...`);
    // Implementation for real WhatsApp API...
  }
}
