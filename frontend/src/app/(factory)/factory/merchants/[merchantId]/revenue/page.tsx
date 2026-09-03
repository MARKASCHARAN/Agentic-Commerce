'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Activity, TrendingUp, DollarSign, Clock, CheckCircle, ArrowUpRight } from 'lucide-react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';

export default function RevenuePage() {
  const { merchantId } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['revenue', merchantId],
    queryFn: () => api.get<{ opportunities: any[], metrics: any }>(`/factory/merchants/${merchantId}/opportunities`),
    enabled: !!merchantId,
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Revenue Operations</h2>
        <p className="text-zinc-400 mt-2">Monitor agent-driven revenue opportunities, upsells, and conversions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Opportunities" 
          value={data?.metrics?.totalOpportunities || 0} 
          icon={<Activity className="text-cyan-400" />} 
          trend="+12% this week"
          idx={0}
        />
        <MetricCard 
          title="Conversion Rate" 
          value={`${data?.metrics?.conversionRate || 0}%`} 
          icon={<TrendingUp className="text-emerald-400" />} 
          trend="+5.2% this week"
          idx={1}
        />
        <MetricCard 
          title="Agent Revenue" 
          value={`$${((data?.metrics?.revenueGeneratedMinor || 0) / 100).toFixed(2)}`} 
          icon={<DollarSign className="text-indigo-400" />} 
          idx={2}
        />
        <MetricCard 
          title="Avg. Negotiation Save" 
          value={`$${((data?.metrics?.averageNegotiationSavingsMinor || 0) / 100).toFixed(2)}`} 
          icon={<CheckCircle className="text-purple-400" />} 
          idx={3}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-zinc-900/50 border border-white/5 rounded-2xl shadow-sm overflow-hidden mt-8 backdrop-blur-sm relative"
      >
        <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="p-6 border-b border-white/5 flex items-center justify-between z-10 relative">
          <h3 className="font-bold text-white">Recent Revenue Opportunities</h3>
          <button className="text-sm text-cyan-400 hover:text-cyan-300 font-medium flex items-center transition-colors">
            View All <ArrowUpRight size={16} className="ml-1" />
          </button>
        </div>
        
        <div className="z-10 relative">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 border-b border-white/5 text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Opportunity ID</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-zinc-500">Loading metrics...</td></tr>
              ) : data?.opportunities?.map((opp, idx) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + (idx * 0.05) }}
                  key={opp.id} 
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">{opp.id}</td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-white capitalize">{opp.type.toLowerCase().replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-4 font-medium text-emerald-400">${(opp.amountMinor / 100).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      opp.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      opp.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}>
                      {opp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 flex items-center">
                    <Clock size={14} className="mr-1.5" />
                    {new Date(opp.createdAt).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, idx }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group hover:border-white/10 transition-colors"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-zinc-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white">{value}</h3>
          {trend && (
            <p className="text-xs text-emerald-400 mt-2 font-medium flex items-center">
              <TrendingUp size={12} className="mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className="p-3 bg-black/40 border border-white/5 rounded-xl shadow-inner">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
