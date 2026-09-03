'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Settings, Save, AlertTriangle, Key, PowerOff, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const { merchantId } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: () => api.get<{ merchant: any }>(`/factory/merchants/${merchantId}`),
    enabled: !!merchantId,
  });

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
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Settings className="text-emerald-400 mr-3" size={24} />
              General Information
            </h3>
            
            <div className="space-y-6 z-10 relative">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Workspace Name</label>
                  <input 
                    type="text" 
                    defaultValue={data?.merchant?.name || ''}
                    disabled
                    className="w-full bg-black/30 border border-white/5 rounded-lg px-4 py-3 text-zinc-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Workspace ID</label>
                  <input 
                    type="text" 
                    defaultValue={merchantId as string}
                    disabled
                    className="w-full bg-black/30 border border-white/5 rounded-lg px-4 py-3 text-zinc-400 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea 
                  defaultValue={data?.merchant?.description || ''}
                  disabled
                  rows={3}
                  className="w-full bg-black/30 border border-white/5 rounded-lg px-4 py-3 text-zinc-400 cursor-not-allowed"
                />
              </div>

              <div className="pt-6 border-t border-white/5 flex justify-end">
                <button 
                  disabled
                  className="flex items-center px-6 py-2.5 bg-white/5 text-white/50 border border-white/10 rounded-lg cursor-not-allowed font-medium transition-colors"
                >
                  <Save size={18} className="mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm"
          >
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Key className="text-cyan-400 mr-3" size={24} />
              API Credentials
            </h3>
            
            <div className="p-4 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-white">Publishable Key</p>
                <p className="text-xs text-zinc-500 font-mono mt-1">pk_test_aB3x9...</p>
              </div>
              <button className="text-sm text-cyan-400 hover:text-cyan-300 font-medium">Reveal</button>
            </div>
            
            <div className="p-4 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Secret Key</p>
                <p className="text-xs text-zinc-500 font-mono mt-1">sk_test_••••••••</p>
              </div>
              <button className="text-sm text-cyan-400 hover:text-cyan-300 font-medium">Reveal</button>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Danger Zone & Status */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-sm"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <ShieldCheck className="text-emerald-400 mr-2" size={20} />
              Environment Status
            </h3>
            
            <div className="p-4 bg-black/40 border border-white/5 rounded-xl flex items-center mb-6">
              <div className="w-3 h-3 rounded-full bg-emerald-400 mr-3 shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
              <div>
                <p className="text-sm font-medium text-white">Active & Running</p>
                <p className="text-xs text-zinc-500 mt-0.5">Agents are actively processing</p>
              </div>
            </div>

            <button className="w-full py-2.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-sm font-medium transition-all flex items-center justify-center">
              <PowerOff size={16} className="mr-2" />
              Pause All Agent Activities
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 backdrop-blur-sm"
          >
            <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center">
              <AlertTriangle className="mr-2" size={16} />
              Danger Zone
            </h3>
            <p className="text-sm text-red-500/80 leading-relaxed mb-4">
              Permanently delete this workspace and all associated data, including agents, inventory, and transaction history. This action cannot be undone.
            </p>
            <button className="w-full py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm font-medium transition-all">
              Delete Workspace
            </button>
          </motion.div>
        </div>
        
      </div>
    </div>
  );
}
