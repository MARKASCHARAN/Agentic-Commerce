'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Home, Package, Shield, Activity, Users, Settings, FileText, LogOut } from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export default function FactoryLayout({
  children,
}: {
  children: ReactNode
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  
  // merchantId could be string or string[] from Next.js dynamic routes
  const merchantIdParam = params.merchantId;
  const merchantId = Array.isArray(merchantIdParam) ? merchantIdParam[0] : merchantIdParam;

  const { data: userData } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get<{ data: { id: string; email: string; name: string } }>('/auth/me'),
  });

  const { data: merchantData } = useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: () => api.get<{ merchant: any }>(`/factory/merchants/${merchantId}`),
    enabled: !!merchantId,
  });

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      router.push('/login');
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-zinc-950 border-r border-white/5 text-white flex flex-col justify-between">
        <div>
          <div className="p-6">
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">Agent Factory</h1>
            <p className="text-zinc-500 text-sm mt-1">Merchant Dashboard</p>
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
        </div>

        {/* User Footer with Logout */}
        <div className="p-4 border-t border-white/5 bg-black/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                {userData?.data?.name?.[0]?.toUpperCase() || userData?.data?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-white truncate">{userData?.data?.name || 'Merchant Owner'}</p>
                <p className="text-[10px] text-zinc-500 truncate">{userData?.data?.email || ''}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors ml-1 shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
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
              <span className="text-sm font-medium text-zinc-500">Global Workspace Directory</span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-zinc-400 bg-zinc-900 border border-white/10 px-2.5 py-1 rounded-full flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              Authenticated ({userData?.data?.email})
            </span>
            <button 
              onClick={handleLogout}
              className="flex items-center text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
            >
              <LogOut size={14} className="mr-1.5 text-red-400" />
              Sign Out
            </button>
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
