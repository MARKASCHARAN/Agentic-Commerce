'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { PackagePlus, Upload, Search, Tag, DollarSign, Layers } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function CatalogPage() {
  const { merchantId } = useParams();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', merchantId, search],
    queryFn: () => api.get<{ products: any[] }>(`/factory/merchants/${merchantId}/products?search=${search}`),
    enabled: !!merchantId,
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Catalog Management</h2>
          <p className="text-zinc-400 mt-2">Manage products, pricing, and active status for this workspace.</p>
        </div>
        
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2.5 bg-zinc-900 border border-white/10 text-white rounded-lg hover:bg-zinc-800 font-medium transition-colors">
            <Upload size={18} className="mr-2 text-zinc-400" />
            Bulk Import
          </button>
          <button className="flex items-center px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 font-medium transition-colors">
            <PackagePlus size={18} className="mr-2" />
            Add Product
          </button>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl shadow-sm overflow-hidden flex flex-col backdrop-blur-sm">
        <div className="p-4 border-b border-white/5 flex gap-4 bg-black/20">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Search products by name or description..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/50 rounded-lg border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-black/40 border-b border-white/5 text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Product</th>
              <th className="px-6 py-4 font-semibold">Price</th>
              <th className="px-6 py-4 font-semibold">Inventory</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">Loading catalog...</td>
              </tr>
            ) : data?.products?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">No products found.</td>
              </tr>
            ) : (
              data?.products?.map((product: any, idx: number) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={product.id} 
                  className="hover:bg-white/5 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-start">
                      <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 mr-4 shrink-0 shadow-inner">
                        <Tag size={18} />
                      </div>
                      <div>
                        <p className="font-medium text-white group-hover:text-emerald-300 transition-colors">{product.name}</p>
                        <p className="text-xs text-zinc-500 font-mono mt-1">{product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-white font-medium">
                      <DollarSign size={14} className="text-zinc-500 mr-1" />
                      {(product.priceMinor / 100).toFixed(2)} <span className="text-zinc-500 ml-1 text-xs">{product.currency}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-zinc-300">
                      <Layers size={14} className="text-zinc-500 mr-1.5" />
                      {product.inventory?.[0]?.quantity || 0} in stock
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      product.active 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}>
                      {product.active ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors text-sm">
                      Edit
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
