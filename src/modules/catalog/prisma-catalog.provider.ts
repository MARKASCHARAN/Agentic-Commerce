import { PrismaClient } from '@prisma/client';
import { CatalogProvider, InventoryProvider, CatalogItem, InventoryItem } from './types';

export class PrismaCatalogProvider implements CatalogProvider, InventoryProvider {
  constructor(private readonly prisma: PrismaClient) { }

  async search(merchantId: string, query: string): Promise<CatalogItem[]> {
    const raw = (query || '').trim();
    if (!raw) return [];

    // Helper to safely strip common plural endings without corrupting words like "shoes"
    const normalizeWord = (word: string): string => {
      const w = word.toLowerCase();
      if (w.endsWith('ies') && w.length > 4) {
        return w.slice(0, -3) + 'y';
      }
      if (w.endsWith('es') && !w.endsWith('shoes') && !w.endsWith('buses') && w.length > 4) {
        return w.slice(0, -2);
      }
      if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('is') && !w.endsWith('us') && !w.endsWith('shoes') && w.length > 3) {
        return w.slice(0, -1);
      }
      return w;
    };

    // Extract raw words and normalized variants
    const rawWords = raw.toLowerCase().replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(w => w.length > 0);
    if (rawWords.length === 0) return [];

    const searchVariants = new Set<string>();
    for (const w of rawWords) {
      searchVariants.add(w);
      const norm = normalizeWord(w);
      if (norm) searchVariants.add(norm);
    }

    const searchTerms = Array.from(searchVariants);

    // Build Prisma OR filters for all candidate terms
    const termConditions = searchTerms.flatMap(term => [
      { name: { contains: term, mode: 'insensitive' as const } },
      { description: { contains: term, mode: 'insensitive' as const } }
    ]);

    // Fetch exact matches first to ensure they are never truncated by limits
    const exactMatches = await this.prisma.product.findMany({
      where: {
        merchantId,
        active: true,
        OR: [
          { name: { contains: raw, mode: 'insensitive' as const } },
          { description: { contains: raw, mode: 'insensitive' as const } }
        ]
      },
      take: 20
    });

    // Fetch token candidates to support multi-word / plural matches
    const tokenCandidates = await this.prisma.product.findMany({
      where: {
        merchantId,
        active: true,
        OR: termConditions
      },
      take: 50
    });

    // Combine and deduplicate
    const candidateMap = new Map<string, typeof exactMatches[0]>();
    for (const p of [...exactMatches, ...tokenCandidates]) {
      candidateMap.set(p.id, p);
    }
    const candidates = Array.from(candidateMap.values());

    if (candidates.length === 0) return [];

    // Score and rank candidates by token relevance
    const scored = candidates.map(product => {
      let score = 0;
      let tokensMatched = 0;
      const nameLower = product.name.toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      const rawLower = raw.toLowerCase();

      // Exact full query match gets top priority in score
      if (nameLower.includes(rawLower)) score += 100;
      if (descLower.includes(rawLower)) score += 50;

      // Word & normalized token matches
      for (const w of rawWords) {
        let tokenMatched = false;
        const norm = normalizeWord(w);
        // Exact word boundary match gets higher priority
        const wordRegex = new RegExp(`\\b${w}\\b`, 'i');
        
        if (wordRegex.test(nameLower)) { score += 30; tokenMatched = true; }
        else if (nameLower.includes(w)) { score += 20; tokenMatched = true; }
        else if (norm && nameLower.includes(norm)) { score += 15; tokenMatched = true; }

        if (wordRegex.test(descLower)) { score += 15; tokenMatched = true; }
        else if (descLower.includes(w)) { score += 10; tokenMatched = true; }
        else if (norm && descLower.includes(norm)) { score += 5; tokenMatched = true; }

        if (tokenMatched) tokensMatched++;
      }

      return { product, score, tokensMatched };
    });

    // Sort by tokensMatched descending, then score descending, then deterministic tiebreaker
    scored.sort((a, b) => {
      if (a.tokensMatched !== b.tokensMatched) return b.tokensMatched - a.tokensMatched;
      if (a.score !== b.score) return b.score - a.score;
      return a.product.name.localeCompare(b.product.name);
    });

    return scored.slice(0, 20).map(s => s.product);
  }

  async get(merchantId: string, productId: string): Promise<CatalogItem | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || product.merchantId !== merchantId || !product.active) {
      return null;
    }

    return product;
  }

  async check(merchantId: string, productId: string): Promise<InventoryItem | null> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId }
    });

    if (!inventory || inventory.merchantId !== merchantId) {
      return null;
    }

    return {
      productId: inventory.productId,
      quantity: inventory.quantity
    };
  }

  async getRelatedProducts(merchantId: string, productId: string): Promise<CatalogItem[]> {
    const product = await this.get(merchantId, productId);
    if (!product || !product.description) {
      return [];
    }

    const match = product.description.match(/<!--\s*rel:\s*(\[[^\]]*\])\s*-->/);
    if (!match) {
      return [];
    }

    try {
      const relIds: string[] = JSON.parse(match[1]);
      if (!Array.isArray(relIds) || relIds.length === 0) {
        return [];
      }

      const relatedProducts = await this.prisma.product.findMany({
        where: {
          id: { in: relIds },
          merchantId,
          active: true
        }
      });
      return relatedProducts;
    } catch {
      return [];
    }
  }
}
