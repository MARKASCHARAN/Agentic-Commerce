import { MerchantCapability, MerchantCapabilities } from './types';

export class StaticMerchantCapabilities implements MerchantCapabilities {
  private capabilities: Set<MerchantCapability>;

  constructor(capabilities: MerchantCapability[]) {
    this.capabilities = new Set(capabilities);
  }

  has(capability: MerchantCapability): boolean {
    return this.capabilities.has(capability);
  }

  getAll(): MerchantCapability[] {
    return Array.from(this.capabilities);
  }
}

export class MerchantCapabilityResolver {
  
  private readonly configMap: Map<string, MerchantCapability[]> = new Map([
    ['merchant-d2c', ['catalog', 'inventory', 'pricing', 'order.create', 'payment.create']],
    
    ['merchant-saas', ['subscriptions', 'usage', 'pricing', 'payment.create', 'order.create']],
    
    ['merchant-b2b', ['catalog', 'inventory', 'pricing', 'negotiation', 'quote.create', 'offer.create', 'negotiation.create', 'order.create', 'payment.create']],
  ]);

  async resolve(merchantId: string): Promise<MerchantCapabilities> {
    const caps = this.configMap.get(merchantId) || [];
    return new StaticMerchantCapabilities(caps);
  }
}
