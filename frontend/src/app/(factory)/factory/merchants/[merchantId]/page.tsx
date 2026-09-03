'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useParams } from 'next/navigation';
import { Activity, Package, Shield, Settings, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function MerchantOverviewPage() {
  const { merchantId } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: () => api.get<{ merchant: any }>(`/factory/merchants/${merchantId}`),
    enabled: !!merchantId,
  });

  if (isLoading) return <div className="p-12 text-center text-zinc-500">Loading merchant details...</div>;
  if (!data?.merchant) return <div className="p-12 text-center text-red-500">Merchant not found.</div>;

  const merchant = data.merchant;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Overview</h2>
        <p className="text-zinc-400 mt-2">Control plane dashboard for <span className="text-white font-medium">{merchant.name}</span></p>
      </div>

      {merchant.status !== 'ACTIVE' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start backdrop-blur-sm"
        >
          <AlertCircle className="text-amber-500 mr-3 mt-0.5" size={20} />
          <div>
            <h4 className="text-sm font-semibold text-amber-400">Merchant is {merchant.status || 'Inactive'}</h4>
            <p className="text-sm text-amber-500/80 mt-1">
              Agent activities are suspended. You can resume operations from the Settings tab.
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OverviewCard 
          title="Catalog & Inventory" 
          description="Manage products, pricing, and stock levels." 
          icon={<Package className="text-indigo-400" size={24} />} 
          href={`/factory/merchants/${merchantId}/catalog`} 
          linkText="Manage Catalog"
          idx={0}
        />
        <OverviewCard 
          title="Policies & Guardrails" 
          description="Set agent boundaries, discount limits, and autonomy thresholds." 
          icon={<Shield className="text-emerald-400" size={24} />} 
          href={`/factory/merchants/${merchantId}/policies`} 
          linkText="Configure Policies"
          idx={1}
        />
        <OverviewCard 
          title="Revenue Operations" 
          description="Track agent-driven upsells, cross-sells, and converted opportunities." 
          icon={<Activity className="text-cyan-400" size={24} />} 
          href={`/factory/merchants/${merchantId}/revenue`} 
          linkText="View Revenue"
          idx={2}
        />
        <OverviewCard 
          title="Merchant Settings" 
          description="Manage credentials, pause operations, or update profile." 
          icon={<Settings className="text-zinc-400" size={24} />} 
          href={`/factory/merchants/${merchantId}/settings`} 
          linkText="Edit Settings"
          idx={3}
        />
      </div>
    </div>
  );
}

function OverviewCard({ title, description, icon, href, linkText, idx }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
    >
      <div className="bg-zinc-900/50 border border-white/5 hover:border-emerald-500/30 rounded-2xl p-6 shadow-sm flex flex-col h-full transition-all group backdrop-blur-sm relative overflow-hidden">
        {/* Hover gradient effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className="flex items-start mb-6 z-10">
          <div className="p-3 bg-black/40 border border-white/5 rounded-xl mr-4 shadow-inner">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white group-hover:text-emerald-300 transition-colors">{title}</h3>
            <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="mt-auto pt-4 border-t border-white/5 z-10">
          <Link href={href} className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center">
            {linkText} <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
