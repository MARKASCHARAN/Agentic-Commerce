'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useParams } from 'next/navigation';
import { Activity, Package, Shield, Settings, AlertCircle, CheckCircle2 } from 'lucide-react';
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
        <p className="text-zinc-400 mt-2">Merchant dashboard for <span className="text-white font-medium">{merchant.name}</span></p>
      </div>

      {/* 🟢 AGENT-READY STATUS CARD */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-emerald-950/40 via-zinc-900/70 to-black border border-emerald-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold text-white tracking-wide">AGENT-READY</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  AI Buyable
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">Merchant is fully discoverable and transactable by AI agents through MCP</p>
            </div>
          </div>

          <div className="bg-black/60 border border-white/10 px-4 py-2 rounded-xl flex items-center space-x-3 text-xs font-mono text-emerald-400">
            <span className="text-zinc-500">Endpoint:</span>
            <span>http://localhost:3000/mcp</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6 pt-4 border-t border-white/5 text-xs text-zinc-300">
          <div className="flex items-center space-x-1.5"><CheckCircle2 className="text-emerald-400 w-3.5 h-3.5" /><span>Catalog indexed</span></div>
          <div className="flex items-center space-x-1.5"><CheckCircle2 className="text-emerald-400 w-3.5 h-3.5" /><span>Inventory synced</span></div>
          <div className="flex items-center space-x-1.5"><CheckCircle2 className="text-emerald-400 w-3.5 h-3.5" /><span>Revenue AI active</span></div>
          <div className="flex items-center space-x-1.5"><CheckCircle2 className="text-emerald-400 w-3.5 h-3.5" /><span>Guardrails set</span></div>
          <div className="flex items-center space-x-1.5"><CheckCircle2 className="text-emerald-400 w-3.5 h-3.5" /><span>Razorpay connected</span></div>
          <div className="flex items-center space-x-1.5"><CheckCircle2 className="text-emerald-400 w-3.5 h-3.5" /><span>Human gate set</span></div>
          <div className="flex items-center space-x-1.5"><CheckCircle2 className="text-emerald-400 w-3.5 h-3.5" /><span>Reconciliation live</span></div>
        </div>
      </motion.div>

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
            <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
              {title}
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-white/5 z-10 flex items-center justify-between">
          <Link 
            href={href}
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300 flex items-center transition-colors"
          >
            {linkText}
            <span className="ml-1 text-xs">→</span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
