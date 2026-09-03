'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Shield, Save, AlertTriangle, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function PoliciesPage() {
  const { merchantId } = useParams();
  const queryClient = useQueryClient();

  const { data: guardrailsData, isLoading: isGuardrailsLoading } = useQuery({
    queryKey: ['guardrails', merchantId],
    queryFn: () => api.get<{ guardrails: any }>(`/factory/merchants/${merchantId}/guardrails`),
    enabled: !!merchantId,
  });

  const { data: capsData, isLoading: isCapsLoading } = useQuery({
    queryKey: ['capabilities', merchantId],
    queryFn: () => api.get<{ capabilities: any[] }>(`/factory/merchants/${merchantId}/capabilities`),
    enabled: !!merchantId,
  });

  const updatePolicies = useMutation({
    mutationFn: (data: any) => api.patch(`/factory/merchants/${merchantId}/guardrails`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardrails', merchantId] });
      alert('Policies saved successfully');
    }
  });

  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (guardrailsData?.guardrails) {
      setFormData(guardrailsData.guardrails);
    }
  }, [guardrailsData]);

  if (isGuardrailsLoading || isCapsLoading) return <div className="p-12 text-center text-zinc-500">Loading policies...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Policies & Guardrails</h2>
          <p className="text-zinc-400 mt-2">Configure the operational boundaries and capabilities for this workspace's agent.</p>
        </div>
        
        <button 
          onClick={() => updatePolicies.mutate(formData)}
          disabled={updatePolicies.isPending}
          className="flex items-center px-6 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg shadow-sm hover:bg-emerald-500/20 font-medium transition-colors disabled:opacity-50"
        >
          <Save size={18} className="mr-2" />
          {updatePolicies.isPending ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Guardrails */}
        <div className="lg:col-span-2 space-y-6">
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none" />

            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Shield className="text-emerald-400 mr-3" size={24} />
              Pricing & Negotiation
            </h3>
            
            <div className="space-y-6 z-10 relative">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Max Discount (BPS)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={formData.maxDiscountBps || 0}
                      onChange={(e) => setFormData({...formData, maxDiscountBps: parseInt(e.target.value)})}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono" 
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500 text-sm font-mono">BPS</div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">100 BPS = 1%</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Minimum Margin (BPS)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={formData.minimumMarginBps || 0}
                      onChange={(e) => setFormData({...formData, minimumMarginBps: parseInt(e.target.value)})}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono" 
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500 text-sm font-mono">BPS</div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium mb-1">Agent Negotiation</h4>
                    <p className="text-sm text-zinc-400">Allow the agent to dynamically negotiate prices with buyers within the allowed margin.</p>
                  </div>
                  <button 
                    onClick={() => setFormData({...formData, negotiationEnabled: !formData.negotiationEnabled})}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {formData.negotiationEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-zinc-600" />}
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium mb-1">Strict Inventory Check</h4>
                    <p className="text-sm text-zinc-400">Block orders if real-time inventory count drops below 1.</p>
                  </div>
                  <button 
                    onClick={() => setFormData({...formData, strictInventoryCheck: !formData.strictInventoryCheck})}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {formData.strictInventoryCheck ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-zinc-600" />}
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </div>

        {/* Right Column - Capabilities */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-sm"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Settings className="text-cyan-400 mr-2" size={20} />
              Active Capabilities
            </h3>
            
            {capsData?.capabilities?.length === 0 ? (
              <p className="text-sm text-zinc-500">No capabilities enabled.</p>
            ) : (
              <div className="space-y-3">
                {capsData?.capabilities?.map((cap: any) => (
                  <div key={cap.id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{cap.capabilityType.replace('_', ' ')}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                  </div>
                ))}
              </div>
            )}
            
            <button className="mt-4 w-full py-2.5 border border-white/10 border-dashed rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all">
              + Add Capability
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 backdrop-blur-sm"
          >
            <h3 className="text-sm font-semibold text-amber-400 mb-2 flex items-center">
              <AlertTriangle className="mr-2" size={16} />
              Policy Warning
            </h3>
            <p className="text-sm text-amber-500/80 leading-relaxed">
              Changes to pricing boundaries take effect immediately for all active agent sessions. Ensure your margins are correctly calculated.
            </p>
          </motion.div>
        </div>
        
      </div>
    </div>
  );
}
