export class CommerceClient {
  constructor(private baseUrl: string, private buyerId: string) {}

  async sendRequest(message: string, merchantId: string, sessionId: string) {
    const res = await fetch(`${this.baseUrl}/v1/protocol/requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Buyer-Id': this.buyerId
      },
      body: JSON.stringify({
        message,
        merchantId,
        sessionId,
        constraints: {}
      })
    });

    if (!res.ok) {
      throw new Error(`[CommerceClient] sendRequest failed: ${await res.text()}`);
    }

    return res.json();
  }

  async counterOffer(offerId: string, targetTotalMinor: number) {
    const res = await fetch(`${this.baseUrl}/v1/protocol/offers/${offerId}/counter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Buyer-Id': this.buyerId
      },
      body: JSON.stringify({
        targetTotalMinor
      })
    });

    if (!res.ok) {
      throw new Error(`[CommerceClient] counterOffer failed: ${await res.text()}`);
    }

    return res.json();
  }

  async acceptOffer(offerId: string) {
    const res = await fetch(`${this.baseUrl}/v1/protocol/offers/${offerId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Buyer-Id': this.buyerId
      }
    });

    if (!res.ok) {
      throw new Error(`[CommerceClient] acceptOffer failed: ${await res.text()}`);
    }

    return res.json();
  }

  async getAuditLog(merchantId: string, sessionId: string) {
    const res = await fetch(`${this.baseUrl}/internal/merchant/${merchantId}/audit/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`[CommerceClient] getAuditLog failed: ${await res.text()}`);
    }

    return res.json();
  }
}
