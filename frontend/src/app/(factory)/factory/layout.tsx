'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Home, Package, Shield, Activity, Users, Settings, FileText } from 'lucide-react';
import { useParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export default function FactoryLayout({
  children,
}: {
  children: ReactNode
}) {
  const params = useParams();
  const pathname = usePathname();
  
  // merchantId could be string or string[] from Next.js dynamic routes
  const merchantIdParam = params.merchantId;
  const merchantId = Array.isArray(merchantIdParam) ? merchantIdParam[0] : merchantIdParam;

  const { data: merchantData } = useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: () => api.get<{ merchant: any }>(`/factory/merchants/${merchantId}`),
    enabled: !!merchantId,
  });

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-zinc-950 border-r border-white/5 text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">Agent Factory</h1>
          <p className="text-zinc-500 text-sm mt-1">Control Plane</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarLink href="/factory/merchants" icon={<Users size={20} />} label="All Merchants" active={pathname === '/factory/merchants'} />
          
          {merchantId && (
            <>
              <div className="pt-6 pb-2">
                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider px-3">
                  Context: {merchantData?.merchant?.name || 'Loading...'}
                </p>
              </div>
              <SidebarLink 
                href={`/factory/merchants/${merchantId}`} 
                icon={<Home size={20} />} 
                label="Overview" 
                active={pathname === `/factory/merchants/${merchantId}`} 
              />
              <SidebarLink 
                href={`/factory/merchants/${merchantId}/catalog`} 
                icon={<Package size={20} />} 
                label="Catalog" 
                active={pathname.includes('/catalog')} 
              />
              <SidebarLink 
                href={`/factory/merchants/${merchantId}/policies`} 
                icon={<Shield size={20} />} 
                label="Policies" 
                active={pathname.includes('/policies')} 
              />
              <SidebarLink 
                href={`/factory/merchants/${merchantId}/revenue`} 
                icon={<Activity size={20} />} 
                label="Revenue" 
                active={pathname.includes('/revenue')} 
              />
              <SidebarLink 
                href={`/factory/merchants/${merchantId}/audit`} 
                icon={<FileText size={20} />} 
                label="Audit Logs" 
                active={pathname.includes('/audit')} 
              />
            </>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-auto">
        <header className="h-16 border-b border-white/5 bg-zinc-950/50 backdrop-blur flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="flex items-center">
            {merchantId ? (
              <>
                <span className="text-sm font-medium text-zinc-500">Active Context: </span>
                <span className="text-sm font-bold text-white bg-white/5 px-3 py-1 rounded-md ml-2 border border-white/10">
                  {merchantData?.merchant?.name || merchantId}
                </span>
              </>
            ) : (
              <span className="text-sm font-medium text-zinc-500">Global View</span>
            )}
          </div>
        </header>
        <div className="p-8 max-w-7xl w-full mx-auto text-white">
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarLink({ href, icon, label, active }: { href: string, icon: ReactNode, label: string, active?: boolean }) {
  return (
    <Link 
      href={href}
      className={`flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
        active 
          ? 'bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20' 
          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="mr-3">{icon}</span>
      <span className="text-sm">{label}</span>
    </Link>
  )
}
