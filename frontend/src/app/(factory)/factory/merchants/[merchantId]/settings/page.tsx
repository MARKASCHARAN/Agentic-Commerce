'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Settings, Save, AlertTriangle, Key, PowerOff, ShieldCheck, Trash2, Check } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const { merchantId } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: () => api.get<{ merchant: any }>(`/factory/merchants/${merchantId}`),
    enabled: !!merchantId,
  });

  useEffect(() => {
    if (data?.merchant) {
      setName(data.merchant.name || '');
      setDescription(data.merchant.description || '');
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updateData: any) => api.patch(`/factory/merchants/${merchantId}`, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/factory/merchants/${merchantId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      router.push('/factory/merchants');
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name, description });
  };

  const handleToggleStatus = () => {
    const newStatus = data?.merchant?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    updateMutation.mutate({ status: newStatus });
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to permanently delete workspace "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) return <div className="p-12 text-center text-zinc-500">Loading settings...</div>;

  const isPaused = data?.merchant?.status === 'INACTIVE';

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Workspace Settings</h2>
          <p className="text-zinc-400 mt-2">Manage API keys, environment status, and integration details.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Core Settings */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden"
          >
            <form onSubmit={handleSave}>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Settings className="text-emerald-400 mr-3" size={24} />
              General Information
            </h3>
            
            <div className="space-y-6 z-10 relative">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Workspace Name *</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Workspace ID</label>
                  <input 
                    type="text" 
                    value={merchantId as string}
                    disabled
                    className="w-full bg-black/30 border border-white/5 rounded-lg px-4 py-3 text-zinc-400 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Describe your merchant business..."
                />
              </div>

              <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                {saveSuccess ? (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center">
                    <Check size={16} className="mr-1" /> Changes saved successfully!
                  </span>
                ) : (
                  <span />
                )}
                <button 
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex items-center px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save size={18} className="mr-2" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
            </form>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm"
          >
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Key className="text-cyan-400 mr-3" size={24} />
              API Credentials & Integration
            </h3>
            
            <div className="p-4 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-white">Merchant Context ID</p>
                <p className="text-xs text-zinc-400 font-mono mt-1">{merchantId}</p>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full">
                Active Context
              </span>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Status & Danger Zone */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-sm"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <ShieldCheck className="text-emerald-400 mr-2" size={20} />
              Environment Status
            </h3>
            
            <div className="p-4 bg-black/40 border border-white/5 rounded-xl mb-6">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`}></div>
                <span className="font-semibold text-white text-sm">{isPaused ? 'Paused / Inactive' : 'Active & Processing'}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                {isPaused ? 'Agents are currently suspended for this merchant.' : 'AI agents are operational and processing customer offers.'}
              </p>
            </div>

            <button 
              onClick={handleToggleStatus}
              disabled={updateMutation.isPending}
              className={`w-full py-3 px-4 border rounded-xl font-medium text-sm transition-all flex items-center justify-center cursor-pointer ${
                isPaused 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              <PowerOff size={16} className="mr-2" />
              {isPaused ? 'Resume Agent Activities' : 'Pause All Agent Activities'}
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 backdrop-blur-sm"
          >
            <h3 className="text-lg font-semibold text-red-400 mb-2 flex items-center">
              <AlertTriangle className="mr-2" size={20} />
              Danger Zone
            </h3>
            <p className="text-xs text-red-300/70 mb-6 leading-relaxed">
              Permanently delete this workspace and all associated data, including agents, inventory, and transaction history.
            </p>

            <button 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="w-full py-3 px-4 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl font-semibold text-sm hover:bg-red-500/30 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={16} className="mr-2" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Workspace'}
            </button>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
