export interface CatalogItem {
  id: string;
  merchantId: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  active: boolean;
}

export interface InventoryItem {
  productId: string;
  quantity: number;
}

export interface CatalogProvider {
  search(merchantId: string, query: string): Promise<CatalogItem[]>;
  get(merchantId: string, productId: string): Promise<CatalogItem | null>;
  getRelatedProducts(merchantId: string, productId: string): Promise<CatalogItem[]>;
}

export interface InventoryProvider {
  check(merchantId: string, productId: string): Promise<InventoryItem | null>;
}
