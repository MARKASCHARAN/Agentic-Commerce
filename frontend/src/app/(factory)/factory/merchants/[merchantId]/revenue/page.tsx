'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { TrendingUp, Clock, CheckCircle, Zap, Tag, ShoppingBag, Filter, X, Eye, ShieldCheck, Sparkles, ArrowUp } from 'lucide-react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function RevenuePage() {
  const { merchantId } = useParams();
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedOpportunity, setSelectedOpportunity] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['revenue', merchantId],
    queryFn: () => api.get<{ opportunities: any[], metrics: any }>(`/factory/merchants/${merchantId}/opportunities`),
    enabled: !!merchantId,
  });

  const currencySymbol = '₹';

  const filteredOpportunities = data?.opportunities?.filter((opp) => {
    if (selectedType === 'ALL') return true;
    return opp.type === selectedType;
  }) || [];

  const totalGMV = Number(data?.metrics?.revenueGeneratedMinor || 0) / 100;
  const upliftRevenue = Number(data?.metrics?.opportunityUpliftMinor || 0) / 100;
  const totalSavings = Number(data?.metrics?.totalNegotiationSavingsMinor || 0) / 100;
  const baseRevenue = Math.max(0, totalGMV - upliftRevenue);

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center">
          <Sparkles className="text-emerald-400 mr-3" size={28} />
          Revenue Intelligence Operations
        </h2>
        <p className="text-zinc-400 mt-1">Real-time breakdown of total agent GMV, cross-sell uplifts, and margin protection savings.</p>
      </div>

      {/* Hero Financial Impact Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-black border border-white/10 rounded-3xl p-8 relative overflow-hidden shadow-2xl backdrop-blur-xl"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                Live Agent Performance
              </span>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
                {currencySymbol}{totalGMV.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Total Gross Merchandise Volume (GMV) Processed & Captured by AI Agent</p>
            </div>

            <div className="flex items-center space-x-3 bg-black/50 border border-white/10 p-3.5 rounded-2xl">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <TrendingUp size={22} />
              </div>
              <div>
                <span className="text-xs text-zinc-400">Agent Conversion Rate</span>
                <p className="text-lg font-bold text-white">{data?.metrics?.conversionRate || 0}%</p>
              </div>
            </div>
          </div>

          {/* 3 Main Revenue Financial Drivers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/60 border border-white/10 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400 font-medium">Base Direct Sales</span>
                <ShoppingBag size={16} className="text-indigo-400" />
              </div>
              <p className="text-xl font-bold text-white">
                {currencySymbol}{baseRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">Direct catalog purchases</p>
            </div>

            <div className="bg-cyan-950/30 border border-cyan-500/30 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-cyan-300 font-medium flex items-center">
                  <Zap size={14} className="mr-1" /> Cross-Sell & Upsell Uplift
                </span>
                <ArrowUp size={16} className="text-cyan-400" />
              </div>
              <p className="text-xl font-bold text-cyan-400">
                +{currencySymbol}{upliftRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-cyan-300/70 mt-1">Extra revenue added by AI recommendations</p>
            </div>

            <div className="bg-purple-950/30 border border-purple-500/30 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-purple-300 font-medium flex items-center">
                  <ShieldCheck size={14} className="mr-1" /> Protected Margin Savings
                </span>
                <CheckCircle size={16} className="text-purple-400" />
              </div>
              <p className="text-xl font-bold text-purple-400">
                +{currencySymbol}{totalSavings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-purple-300/70 mt-1">Profit saved by discount guardrails</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Opportunity Type Breakdown Row (Larger & Featured Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <BreakdownCard 
          title="Cross-Sells Detected"
          count={data?.metrics?.crossSellCount || 0}
          badgeColor="border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
          icon={<Zap size={22} className="text-cyan-400" />}
          desc="Add-on product pairs (e.g. Fast Charger, Protection Case)"
        />
        <BreakdownCard 
          title="Upsells Detected"
          count={data?.metrics?.upsellCount || 0}
          badgeColor="border-purple-500/30 bg-purple-500/10 text-purple-400"
          icon={<Tag size={22} className="text-purple-400" />}
          desc="Higher tier model upgrades (e.g. 256GB / Pro edition)"
        />
        <BreakdownCard 
          title="AOV Expansions"
          count={data?.metrics?.aovCount || 0}
          badgeColor="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          icon={<ShoppingBag size={22} className="text-emerald-400" />}
          desc="Basket size & average order value optimizations"
        />
        <BreakdownCard 
          title="Direct Conversions"
          count={data?.metrics?.conversionCount || 0}
          badgeColor="border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
          icon={<CheckCircle size={22} className="text-indigo-400" />}
          desc="Autonomous transactions successfully closed and paid"
        />
      </div>

      {/* Revenue Opportunities Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-zinc-900/50 border border-white/5 rounded-2xl shadow-sm overflow-hidden mt-8 backdrop-blur-sm relative"
      >
        <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="p-6 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 z-10 relative">
          <div>
            <h3 className="font-bold text-white text-lg flex items-center">
              <Sparkles size={18} className="text-cyan-400 mr-2" />
              Revenue Intelligence Audit
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Click on any row to view full AI reasoning, cross-sell breakdown, and financial impact.</p>
          </div>

          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-zinc-400" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-black/60 border border-white/10 text-xs text-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Opportunity Types</option>
              <option value="CROSS_SELL">Cross-Sells</option>
              <option value="UPSELL">Upsells</option>
              <option value="AOV_EXPANSION">AOV Expansions</option>
              <option value="CONVERSION">Conversions</option>
            </select>
          </div>
        </div>
        
        <div className="z-10 relative overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 border-b border-white/5 text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Opportunity / Order ID</th>
                <th className="px-6 py-4 font-semibold">Intelligence Type</th>
                <th className="px-6 py-4 font-semibold">Add-On Uplift</th>
                <th className="px-6 py-4 font-semibold">Order Total</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Timestamp</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-500">Loading revenue intelligence data...</td></tr>
              ) : filteredOpportunities.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-500">No revenue opportunities matching filter criteria.</td></tr>
              ) : filteredOpportunities.map((opp) => {
                const isOpportunityType = opp.type === 'CROSS_SELL' || opp.type === 'UPSELL' || opp.type === 'AOV_EXPANSION';
                const addOnAmount = Number(opp.amountMinor || 0) / 100;
                const orderTotal = Number(opp.orderTotalMinor || opp.amountMinor || 0) / 100;

                return (
                  <tr 
                    key={opp.id} 
                    onClick={() => setSelectedOpportunity(opp)}
                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400 group-hover:text-white transition-colors">{opp.id}</td>
                    <td className="px-6 py-4">
                      <TypeBadge type={opp.type || 'CONVERSION'} />
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {isOpportunityType && addOnAmount > 0 ? (
                        <span className="text-cyan-400">+{currencySymbol}{addOnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-zinc-500 font-normal">₹0.00 (Direct Sale)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-400">
                      {currencySymbol}{orderTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        opp.status === 'ACCEPTED' || opp.status === 'PAID' || opp.status === 'captured' || opp.status === 'CONVERTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        opp.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {opp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      <div className="flex items-center text-xs">
                        <Clock size={14} className="mr-1.5 text-zinc-500" />
                        {new Date(opp.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-xs text-zinc-400 group-hover:text-cyan-400 flex items-center justify-end font-medium transition-colors">
                        <Eye size={14} className="mr-1" /> Audit Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Opportunity Audit Details Modal */}
      <AnimatePresence>
        {selectedOpportunity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center space-x-3">
                  <TypeBadge type={selectedOpportunity.type} />
                  <span className="text-xs text-zinc-400 font-mono">ID: {selectedOpportunity.id.slice(0, 18)}...</span>
                </div>
                <button 
                  onClick={() => setSelectedOpportunity(null)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Financial Impact Cards */}
              <div className="grid grid-cols-2 gap-4 bg-black/50 p-4 rounded-xl border border-white/5">
                <div>
                  <span className="text-xs text-zinc-400">Add-On Opportunity Impact</span>
                  <p className="text-xl font-bold mt-1">
                    {selectedOpportunity.type === 'CROSS_SELL' || selectedOpportunity.type === 'UPSELL' ? (
                      <span className="text-cyan-400">+{currencySymbol}{(Number(selectedOpportunity.amountMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-zinc-400">₹0.00 (Direct Sale)</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-zinc-400">Total Order GMV</span>
                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    {currencySymbol}{(Number(selectedOpportunity.orderTotalMinor || selectedOpportunity.amountMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* AI Intelligence Evidence */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white flex items-center">
                  <ShieldCheck size={16} className="text-cyan-400 mr-2" />
                  AI Intelligence Signal & Reasoning
                </h4>
                <p className="text-xs text-zinc-300 bg-zinc-800/60 p-3 rounded-lg border border-white/5 leading-relaxed">
                  {selectedOpportunity.evidence || 'AI Detector evaluated cross-sell relationship with complementary accessory.'}
                </p>
              </div>

              {/* Identifiers & Timestamps */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Session ID</span>
                  <span className="font-mono text-zinc-200">{selectedOpportunity.sessionId || 'Active Session'}</span>
                </div>
                {selectedOpportunity.orderId && (
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-zinc-400">Order ID</span>
                    <span className="font-mono text-cyan-400">{selectedOpportunity.orderId}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Detected At</span>
                  <span className="text-zinc-300">{new Date(selectedOpportunity.createdAt).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedOpportunity(null)}
                  className="px-5 py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-xs cursor-pointer"
                >
                  Close Audit View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BreakdownCard({ title, count, badgeColor, icon, desc }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 shadow-lg backdrop-blur-md flex flex-col justify-between space-y-4 hover:border-white/20 transition-all group relative overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors">{title}</span>
        <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 group-hover:bg-white/10 transition-colors">
          {icon}
        </div>
      </div>

      <div>
        <div className="flex items-baseline space-x-3">
          <span className="text-4xl font-extrabold text-white tracking-tight">{count}</span>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
            Active Signals
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

function TypeBadge({ type }: { type: string }) {
  let badgeStyle = 'bg-zinc-800 text-zinc-300 border-zinc-700';
  let label = type ? type.replace('_', ' ') : 'Conversion';

  if (type === 'CROSS_SELL') {
    badgeStyle = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    label = 'Cross-Sell';
  } else if (type === 'UPSELL') {
    badgeStyle = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    label = 'Upsell';
  } else if (type === 'AOV_EXPANSION') {
    badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    label = 'AOV Expansion';
  } else if (type === 'CONVERSION') {
    badgeStyle = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    label = 'Direct Conversion';
  }

  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${badgeStyle}`}>
      {label}
    </span>
  );
}
