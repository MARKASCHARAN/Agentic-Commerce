'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Shield, Save, AlertTriangle, ToggleLeft, ToggleRight, Settings, Info } from 'lucide-react';
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
  const [maxDiscountPercent, setMaxDiscountPercent] = useState<string>('10');
  const [minimumMarginPercent, setMinimumMarginPercent] = useState<string>('0');

  useEffect(() => {
    if (guardrailsData?.guardrails) {
      setFormData(guardrailsData.guardrails);
      setMaxDiscountPercent(((guardrailsData.guardrails.maxDiscountBps || 0) / 100).toString());
      setMinimumMarginPercent(((guardrailsData.guardrails.minimumMarginBps || 0) / 100).toString());
    }
  }, [guardrailsData]);

  const handleMaxDiscountChange = (valStr: string) => {
    setMaxDiscountPercent(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num)) {
      setFormData((prev: any) => ({ ...prev, maxDiscountBps: Math.round(num * 100) }));
    }
  };

  const handleMinMarginChange = (valStr: string) => {
    setMinimumMarginPercent(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num)) {
      setFormData((prev: any) => ({ ...prev, minimumMarginBps: Math.round(num * 100) }));
    }
  };

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
          className="flex items-center px-6 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg shadow-sm hover:bg-emerald-500/20 font-medium transition-colors disabled:opacity-50 cursor-pointer"
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
              Pricing & Negotiation Guardrails
            </h3>
            
            <div className="space-y-6 z-10 relative">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Max Allowed Discount (%) 
                    <span className="text-xs text-cyan-400 font-mono ml-2">
                      ({formData.maxDiscountBps || 0} BPS)
                    </span>
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.5"
                      min="0"
                      max="100"
                      value={maxDiscountPercent}
                      onChange={(e) => handleMaxDiscountChange(e.target.value)}
                      placeholder="10"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono" 
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-emerald-400 text-sm font-bold">%</div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 flex items-center">
                    <Info size={12} className="mr-1 text-zinc-400" /> Max price cut agent can offer during negotiation.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Minimum Profit Margin (%)
                    <span className="text-xs text-cyan-400 font-mono ml-2">
                      ({formData.minimumMarginBps || 0} BPS)
                    </span>
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.5"
                      min="0"
                      max="100"
                      value={minimumMarginPercent}
                      onChange={(e) => handleMinMarginChange(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono" 
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-emerald-400 text-sm font-bold">%</div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 flex items-center">
                    <Info size={12} className="mr-1 text-zinc-400" /> Minimum profit floor agent must protect.
                  </p>
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
                    className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    {formData.negotiationEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-zinc-600" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium mb-1">Strict Inventory Check</h4>
                    <p className="text-sm text-zinc-400">Block orders if real-time inventory count drops below 1.</p>
                  </div>
                  <button 
                    onClick={() => setFormData({...formData, inventoryCheck: !formData.inventoryCheck})}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    {formData.inventoryCheck ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-zinc-600" />}
                  </button>
                </div>
              </div>

            </div>
          </motion.div>

        </div>

        {/* Right Column - Active Capabilities */}
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Settings className="text-emerald-400 mr-2" size={20} />
              Active Capabilities
            </h3>
            
            <div className="space-y-2">
              {capsData?.capabilities?.map((cap) => (
                <div key={cap.id} className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5 text-sm">
                  <span className="font-mono text-xs text-zinc-300">{cap.capability}</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
