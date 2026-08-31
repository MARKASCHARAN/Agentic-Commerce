import { PrismaClient } from '@prisma/client';

export interface DiscoveryConstraints {
  category?: string;
  maxPriceMinor?: number;
  currency?: string;
}

export class MerchantDiscoveryService {
  constructor(private prisma: PrismaClient) {}

  async discoverMerchants(query: string, constraints?: DiscoveryConstraints) {
    // For Phase 6, we're building a deterministic discovery engine.
    // In a real production system, this would use a vector database (e.g. pgvector)
    // or Elasticsearch to match natural language queries against merchant catalogs.
    // Here, we'll do a simple ILIKE search against active merchants' products.
    
    // First, find all active merchants
    const activeMerchants = await this.prisma.merchant.findMany();

    const eligibleMerchants = [];

    // Filter based on inventory and query matching
    for (const merchant of activeMerchants) {
      const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 3);
      
      const orConditions = searchTerms.length > 0 
        ? searchTerms.map(term => ({
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { description: { contains: term, mode: 'insensitive' as const } }
            ]
          }))
        : [];

      // Add constraints if present
      const whereClause: any = {
        merchantId: merchant.id,
        AND: orConditions.length > 0 ? orConditions : undefined
      };

      if (constraints?.maxPriceMinor) {
        whereClause.priceMinor = { lte: constraints.maxPriceMinor };
      }

      const matchingProducts = await this.prisma.product.findMany({
        where: whereClause,
        take: 10
      });

      // Filter by inventory
      const productsWithInventory = [];
      for (const product of matchingProducts) {
        const inventory = await this.prisma.inventory.findUnique({
          where: { productId: product.id }
        });
        if (inventory && inventory.quantity > 0) {
          productsWithInventory.push(product);
        }
      }

      if (productsWithInventory.length > 0) {
        // Find agent ID by querying Agent where owner = merchant.id
        const agent = await this.prisma.agent.findFirst({
          where: { owner: merchant.id }
        });
        
        eligibleMerchants.push({
          merchantId: merchant.id,
          agentId: agent ? agent.id : `agent_${merchant.id}`,
          name: merchant.name,
          matchingProducts: productsWithInventory
        });
      }
    }

    return eligibleMerchants;
  }
}
