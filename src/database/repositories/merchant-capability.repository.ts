import { prisma } from '../prisma/prisma';
import { MerchantCapability } from '../../agent/intelligence/types';

export class MerchantCapabilityRepository {
  async getCapabilities(merchantId: string): Promise<MerchantCapability[]> {
    const records = await prisma.merchantCapability.findMany({
      where: { merchantId },
      select: { capability: true },
    });
    
    return records.map(r => r.capability as MerchantCapability);
  }

  async addCapability(merchantId: string, capability: MerchantCapability): Promise<void> {
    await prisma.merchantCapability.upsert({
      where: {
        merchantId_capability: {
          merchantId,
          capability,
        }
      },
      update: {},
      create: {
        merchantId,
        capability,
      }
    });
  }

  async setCapabilities(merchantId: string, capabilities: MerchantCapability[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Clear existing
      await tx.merchantCapability.deleteMany({
        where: { merchantId }
      });

      // Insert new
      if (capabilities.length > 0) {
        await tx.merchantCapability.createMany({
          data: capabilities.map(capability => ({
            merchantId,
            capability
          }))
        });
      }
    });
  }
}
