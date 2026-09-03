'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Plus, CheckCircle2, ChevronRight, Store, Settings, Activity } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function MerchantsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['merchants'],
    queryFn: () => api.get<{ merchants: any[] }>('/factory/merchants')
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Workspaces</h2>
          <p className="text-zinc-400 mt-2">Select a merchant environment to enter the Control Plane.</p>
        </div>
        
        <div>
          <Link href="/factory/merchants/new">
            <button className="flex items-center px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 font-medium transition-colors">
              <Plus size={18} className="mr-2" />
              New Workspace
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-zinc-500">Loading workspaces...</div>
        ) : data?.merchants?.length === 0 ? (
          <div className="col-span-full py-12 text-center flex flex-col items-center justify-center border border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <Store className="text-zinc-400" size={24} />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No workspaces found</h3>
            <p className="text-zinc-400 mb-6 max-w-sm">Create your first merchant workspace to start building your AI-native commerce environment.</p>
            <Link href="/factory/merchants/new">
              <button className="flex items-center px-6 py-3 bg-white text-black rounded-lg hover:bg-zinc-200 font-medium transition-colors">
                <Plus size={18} className="mr-2" />
                Create Workspace
              </button>
            </Link>
          </div>
        ) : (
          data?.merchants?.map((merchant: any, idx: number) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={merchant.id}
            >
              <Link href={`/factory/merchants/${merchant.id}`}>
                <div className="group relative bg-zinc-900/50 border border-white/5 rounded-2xl p-6 hover:bg-zinc-800/80 hover:border-emerald-500/30 transition-all cursor-pointer overflow-hidden flex flex-col h-full">
                  
                  {/* Hover gradient effect */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex justify-between items-start mb-6 z-10">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-lg">
                      <Store className="text-emerald-400" size={20} />
                    </div>
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                      <CheckCircle2 size={14} />
                      <span>Active</span>
                    </div>
                  </div>

                  <div className="z-10 flex-1">
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-300 transition-colors">{merchant.name}</h3>
                    <p className="text-sm text-zinc-400 line-clamp-2">
                      {merchant.description || 'No description provided.'}
                    </p>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-white/5 z-10 flex items-center justify-between text-sm">
                    <span className="text-zinc-500 capitalize">{merchant.status || 'Active'}</span>
                    <div className="flex items-center text-zinc-400 group-hover:text-white transition-colors">
                      Enter Plane <ChevronRight size={16} className="ml-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
