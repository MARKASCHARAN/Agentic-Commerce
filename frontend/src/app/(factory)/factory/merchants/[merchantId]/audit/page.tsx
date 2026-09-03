'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ShieldAlert, FileText, CheckCircle2, Clock, Filter, Download, X, Eye, Code, Sparkles, Terminal } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuditPage() {
  const { merchantId } = useParams();
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', merchantId],
    queryFn: () => api.get<{ data: any[], meta: any }>(`/factory/merchants/${merchantId}/audit`),
    enabled: !!merchantId,
  });

  const filteredLogs = data?.data?.filter((log) => {
    if (filterAction === 'ALL') return true;
    return log.action === filterAction || log.metadata?.type === filterAction;
  }) || [];

  const handleExportLogs = () => {
    if (!data?.data) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data.data, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `merchant-${merchantId}-audit-logs.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center">
            <Sparkles className="text-purple-400 mr-3" size={28} />
            Audit & Autonomous Decisions
          </h2>
          <p className="text-zinc-400 mt-1">Review full AI reasoning, decision traces, and system events for total transparency.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-zinc-900 border border-white/10 px-3 py-2 rounded-xl">
            <Filter size={16} className="text-zinc-400" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-900 text-white">All Event Actions</option>
              <option value="PAYMENT_LINK_CREATED" className="bg-zinc-900 text-white">Payment Link Created</option>
              <option value="ORDER_CREATED" className="bg-zinc-900 text-white">Order Created</option>
              <option value="BUYER_ACCEPTED" className="bg-zinc-900 text-white">Buyer Accepted Offer</option>
              <option value="DECISION" className="bg-zinc-900 text-white">All Decisions</option>
            </select>
          </div>

          <button 
            onClick={handleExportLogs}
            className="flex items-center px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 font-medium text-xs transition-colors cursor-pointer"
          >
            <Download size={16} className="mr-2" />
            Export JSON Logs
          </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/50 border border-white/5 rounded-2xl shadow-sm overflow-hidden backdrop-blur-sm relative"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="z-10 relative overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 border-b border-white/5 text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Log ID</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold">Reasoning & Event Context</th>
                <th className="px-6 py-4 font-semibold">Risk Level</th>
                <th className="px-6 py-4 font-semibold">Timestamp</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-500">Loading audit logs...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-500">No audit decision logs found matching filter.</td></tr>
              ) : filteredLogs.map((log) => {
                const type = log.metadata?.type || 'DECISION';
                const riskScore = log.metadata?.riskScore || 'LOW';

                return (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">{log.id.slice(0, 18)}...</td>
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
                        <span className="text-xs font-semibold">{type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-white text-xs">{log.action}</td>
                    <td className="px-6 py-4 text-zinc-400 text-xs max-w-md truncate" title={log.reasoning}>{log.reasoning}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        riskScore === 'HIGH' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        riskScore === 'LOW' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {riskScore}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 flex items-center text-xs whitespace-nowrap">
                      <Clock size={14} className="mr-1.5" />
                      {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-xs text-zinc-400 group-hover:text-purple-400 flex items-center justify-end font-medium transition-colors">
                        <Eye size={14} className="mr-1" /> View Full Trace
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Audit Decision Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative space-y-6 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{selectedLog.action}</h3>
                    <span className="text-xs text-zinc-400 font-mono">ID: {selectedLog.id}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto space-y-5 pr-1">
                {/* Reasoning Header */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center">
                    <Terminal size={14} className="text-purple-400 mr-2" />
                    Agent Autonomous Decision Reasoning
                  </h4>
                  <p className="text-xs text-zinc-200 bg-black/60 p-4 rounded-xl border border-white/5 leading-relaxed font-mono">
                    {selectedLog.reasoning}
                  </p>
                </div>

                {/* Risk & Metadata */}
                <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-xl border border-white/5 text-xs">
                  <div>
                    <span className="text-zinc-400">Risk Assessment</span>
                    <div className="mt-1">
                      <span className="px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {selectedLog.metadata?.riskScore || 'LOW'} RISK
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-400">Timestamp</span>
                    <p className="text-zinc-200 mt-1">{new Date(selectedLog.timestamp).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Full Execution Payload Context */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center">
                    <Code size={14} className="text-cyan-400 mr-2" />
                    Full Decision Payload & Context
                  </h4>
                  <pre className="text-[11px] text-zinc-300 bg-black p-4 rounded-xl border border-white/10 overflow-x-auto font-mono max-h-60">
                    {JSON.stringify(selectedLog.metadata || selectedLog, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-xs cursor-pointer"
                >
                  Close Decision Trace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
