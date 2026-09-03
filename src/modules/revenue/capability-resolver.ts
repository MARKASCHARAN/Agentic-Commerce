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

import { MerchantCapabilityRepository } from '../../infrastructure/database/repositories/merchant-capability.repository';

export class MerchantCapabilityResolver {
  private repository: MerchantCapabilityRepository;

  constructor(repository?: MerchantCapabilityRepository) {
    this.repository = repository || new MerchantCapabilityRepository();
  }

  async resolve(merchantId: string): Promise<MerchantCapabilities> {
    const caps = await this.repository.getCapabilities(merchantId);
    return new StaticMerchantCapabilities(caps);
  }
}
