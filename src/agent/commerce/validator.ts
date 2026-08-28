import { CommerceMessageEnvelope, ProtocolVersion } from './protocol';
import { MerchantCapability, MerchantCapabilities } from '../intelligence/types';

export class CommerceProtocolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommerceProtocolValidationError';
  }
}

export class CommerceProtocolValidator {
  
  static validateEnvelope(envelope: CommerceMessageEnvelope) {
    if (envelope.protocolVersion !== ProtocolVersion) {
      throw new CommerceProtocolValidationError(`Unsupported protocol version: ${envelope.protocolVersion}`);
    }

    const now = new Date();
    const timestamp = new Date(envelope.timestamp);
    
    if (isNaN(timestamp.getTime())) {
      throw new CommerceProtocolValidationError(`Invalid timestamp format`);
    }

    // Future skew (max 5 minutes)
    if (timestamp.getTime() > now.getTime() + 5 * 60 * 1000) {
      throw new CommerceProtocolValidationError(`Timestamp is too far in the future`);
    }

    if (envelope.expiresAt) {
      const expiresAt = new Date(envelope.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        throw new CommerceProtocolValidationError(`Invalid expiresAt format`);
      }
      if (now.getTime() > expiresAt.getTime()) {
        throw new CommerceProtocolValidationError(`CommerceMessageExpired`);
      }
    }
  }

  static validateCapabilities(messageType: string, capabilities: MerchantCapabilities) {
    const requiredCapabilities = this.getRequiredCapabilities(messageType);
    for (const cap of requiredCapabilities) {
      if (!capabilities.has(cap)) {
        throw new CommerceProtocolValidationError(`UnauthorizedCommerceAction: Missing capability '${cap}' for message type '${messageType}'`);
      }
    }
  }

  private static getRequiredCapabilities(messageType: string): MerchantCapability[] {
    switch (messageType) {
      case 'QUOTE':
        return ['quote.create'];
      case 'OFFER':
        return ['offer.create'];
      case 'COUNTER_OFFER':
        return ['negotiation.create'];
      case 'ORDER_CREATE':
        return ['order.create'];
      case 'PAYMENT_REQUEST':
        return ['payment.create'];
      case 'CANCEL':
        return ['order.create']; // Simplified
      default:
        // DISCOVER, QUOTE_REQUEST, ACCEPT, REJECT can be initiated by buyer or are generally accessible
        return [];
    }
  }
}
