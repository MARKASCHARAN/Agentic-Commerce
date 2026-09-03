'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ShieldAlert, FileText, CheckCircle2, Clock, Filter, Download } from 'lucide-react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';

export default function AuditPage() {
  const { merchantId } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['audit', merchantId],
    queryFn: () => api.get<{ data: any[], meta: any }>(`/factory/merchants/${merchantId}/audit`),
    enabled: !!merchantId,
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Audit & Decisions</h2>
          <p className="text-zinc-400 mt-2">Review autonomous agent decisions and system events for transparency.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2.5 bg-zinc-900 border border-white/10 text-white rounded-lg hover:bg-zinc-800 font-medium transition-colors">
            <Filter size={18} className="mr-2 text-zinc-400" />
            Filter
          </button>
          <button className="flex items-center px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 font-medium transition-colors">
            <Download size={18} className="mr-2" />
            Export Logs
          </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/50 border border-white/5 rounded-2xl shadow-sm overflow-hidden backdrop-blur-sm relative"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="z-10 relative">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 border-b border-white/5 text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Log ID</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold">Reasoning</th>
                <th className="px-6 py-4 font-semibold">Risk</th>
                <th className="px-6 py-4 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-500">Loading audit logs...</td></tr>
              ) : data?.data?.map((log, idx) => {
                const type = log.metadata?.type || 'DECISION';
                const riskScore = log.metadata?.riskScore || 'LOW';
                return (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  key={log.id} 
                  className="hover:bg-white/5 transition-colors group"
                >
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">{log.id}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1.5 font-medium text-white">
                      {type === 'DECISION' ? (
                        <div className="w-6 h-6 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                          <ShieldAlert size={14} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400">
                          <FileText size={14} />
                        </div>
                      )}
                      <span className="text-sm">{type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{log.action}</td>
                  <td className="px-6 py-4 text-zinc-400 max-w-md truncate" title={log.reasoning}>{log.reasoning}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      riskScore === 'HIGH' ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(248,113,113,0.1)]' :
                      riskScore === 'LOW' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]' :
                      'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}>
                      {riskScore}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 flex items-center whitespace-nowrap">
                    <Clock size={14} className="mr-1.5" />
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
