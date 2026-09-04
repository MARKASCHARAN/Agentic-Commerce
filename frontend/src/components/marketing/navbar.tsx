"use client";

import Link from 'next/link';
import { ArrowUpRight, ChevronDown, LayoutDashboard, ShieldCheck, Zap, Activity } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  return (
    <div className="fixed top-0 w-full z-50 flex flex-col font-sans shadow-sm" onMouseLeave={() => setActiveMenu(null)}>
      {/* Main Navbar */}
      <nav className="bg-white text-[#08090B] relative z-20">
        <div className="w-full px-6 md:px-12 h-[72px] flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 15L20 85H40L50 60L60 85H80L50 15Z" fill="url(#paint0_linear)" />
              <path d="M50 60L20 85H40L50 60Z" fill="#1e3a8a" />
              <path d="M50 60L80 85H60L50 60Z" fill="#2563EB" />
              <defs>
                <linearGradient id="paint0_linear" x1="50" y1="15" x2="50" y2="85" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#67e8f9" />
                  <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            <span className="hidden sm:block text-[22px] font-serif tracking-tight text-[#08090B]" style={{ fontFamily: 'var(--font-playfair), serif' }}>Agentic Commerce</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-10 text-[12px] font-bold tracking-[0.08em] text-[#5A6376] uppercase h-full">

            {/* Product */}
            <div
              className="flex items-center gap-1.5 hover:text-[#08090B] transition-colors h-full cursor-pointer"
              onMouseEnter={() => setActiveMenu('product')}
            >
              Product <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeMenu === 'product' ? 'rotate-180' : ''}`} />
            </div>

            {/* Integrations */}
            <div
              className="flex items-center gap-1.5 hover:text-[#08090B] transition-colors h-full cursor-pointer"
              onMouseEnter={() => setActiveMenu('integrations')}
            >
              Integrations <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeMenu === 'integrations' ? 'rotate-180' : ''}`} />
            </div>

            {/* Developers */}
            <div
              className="flex items-center gap-1.5 hover:text-[#08090B] transition-colors h-full cursor-pointer"
              onMouseEnter={() => setActiveMenu('developers')}
            >
              Developers <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeMenu === 'developers' ? 'rotate-180' : ''}`} />
            </div>

          </div>

          {/* CTA Button */}
          <div className="flex items-center shrink-0">
            <Link href="/login" className="bg-[#08090B] text-white px-4 py-2.5 sm:px-7 sm:py-3 rounded-sm hover:bg-black/80 transition-colors text-[10px] sm:text-[11px] font-bold tracking-[0.1em] uppercase whitespace-nowrap">
              Build a merchant
            </Link>
          </div>
        </div>
      </nav>

      {/* Mega Menus */}
      <div
        className={`absolute top-[72px] left-0 w-full flex justify-center pt-2 transition-all duration-200 z-10 ${activeMenu ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
          }`}
      >
        <div className="bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 rounded-sm w-[800px] max-w-[90vw] overflow-hidden flex" onMouseLeave={() => setActiveMenu(null)}>

          {/* PRODUCT MENU */}
          {activeMenu === 'product' && (
            <>
              <div className="w-1/2 p-10 grid grid-cols-2 gap-y-8 gap-x-4">
                <Link href="#catalog" className="text-[13px] text-slate-600 hover:text-black hover:bg-slate-50 p-2 -m-2 rounded transition-colors">Integration Graph</Link>
                <Link href="#marketplace" className="text-[13px] text-slate-600 hover:text-black hover:bg-slate-50 p-2 -m-2 rounded transition-colors">Refold Marketplace</Link>
                <Link href="#workflows" className="text-[13px] text-slate-600 hover:text-black hover:bg-slate-50 p-2 -m-2 rounded transition-colors">Agentic Workflows</Link>
                <Link href="#observability" className="text-[13px] text-slate-600 hover:text-black hover:bg-slate-50 p-2 -m-2 rounded transition-colors">Observability & Self-Healing</Link>

                <div className="col-span-2 flex gap-4 mt-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded flex-1">
                    <div className="bg-blue-600 text-white p-2 rounded shrink-0"><LayoutDashboard className="w-4 h-4" /></div>
                    <span className="text-[11px] font-bold text-slate-700">MCP servers</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded flex-1">
                    <div className="bg-blue-600 text-white p-2 rounded shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-4 h-4 text-white fill-current">
                        <g>
                          <path d="M27.43 4.57h1.52v16.76h-1.52Z" />
                          <path d="M25.9 21.33h1.53v3.05H25.9Z" />
                          <path d="M24.38 24.38h1.52v1.52h-1.52Z" />
                          <path d="m10.66 4.57 -3.04 0 0 1.53 -1.53 0 0 15.23 1.53 0 0 -6.09 7.62 0 0 12.19 -1.53 0 0 1.52 4.57 0 0 -1.52 3.05 0 0 -1.53 1.52 0 0 -1.52 1.53 0 0 -3.05 1.52 0 0 -15.23 -1.52 0 0 9.14 -7.62 0 0 -10.67 4.57 0 0 -1.52 -10.67 0 0 1.52z" />
                          <path d="M24.38 3.05h3.05v1.52h-3.05Z" />
                          <path d="M22.85 25.9h1.53v1.53h-1.53Z" />
                          <path d="M21.33 27.43h1.52v1.52h-1.52Z" />
                          <path d="M21.33 4.57h3.05V6.1h-3.05Z" />
                          <path d="M21.33 1.52h3.05v1.53h-3.05Z" />
                          <path d="M18.28 28.95h3.05v1.53h-3.05Z" />
                          <path d="M13.71 30.48h4.57V32h-4.57Z" />
                          <path d="M10.66 28.95h3.05v1.53h-3.05Z" />
                          <path d="M10.66 25.9h3.05v1.53h-3.05Z" />
                          <path d="M10.66 0h10.67v1.52H10.66Z" />
                          <path d="M9.14 27.43h1.52v1.52H9.14Z" />
                          <path d="M9.14 24.38h1.52v1.52H9.14Z" />
                          <path d="M7.62 1.52h3.04v1.53H7.62Z" />
                          <path d="M7.62 25.9h1.52v1.53H7.62Z" />
                          <path d="M7.62 21.33h1.52v3.05H7.62Z" />
                          <path d="M6.09 24.38h1.53v1.52H6.09Z" />
                          <path d="M4.57 3.05h3.05v1.52H4.57Z" />
                          <path d="M4.57 21.33h1.52v3.05H4.57Z" />
                          <path d="M3.05 4.57h1.52v16.76H3.05Z" />
                        </g>
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700">Security & Governance</span>
                  </div>
                </div>
              </div>
              <div className="w-1/2 bg-slate-50/80 p-10 border-l border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span className="text-[11px] font-bold tracking-widest text-slate-700 uppercase">New Feature</span>
                </div>
                <div className="aspect-[4/3] bg-white rounded border border-slate-200 shadow-sm mb-6 flex items-center justify-center p-6">
                  {/* Using a placeholder SVG pattern representing the isometric graph */}
                  <svg width="100%" height="100%" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M100 20L180 60L100 100L20 60L100 20Z" stroke="#E2E8F0" strokeWidth="2" />
                    <path d="M100 60L140 80L100 100L60 80L100 60Z" fill="#3B82F6" />
                    <circle cx="60" cy="40" r="15" fill="white" stroke="#E2E8F0" strokeWidth="2" />
                    <circle cx="140" cy="40" r="15" fill="white" stroke="#E2E8F0" strokeWidth="2" />
                    <circle cx="100" cy="120" r="15" fill="white" stroke="#E2E8F0" strokeWidth="2" />
                  </svg>
                </div>
                <h4 className="font-semibold text-sm mb-2 text-[#08090B]">AI Powered Delivery Layer</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Build complex workflows with our intelligent automation platform.</p>
              </div>
            </>
          )}

          {/* INTEGRATIONS MENU */}
          {activeMenu === 'integrations' && (
            <>
              <div className="w-1/2 p-10">
                <div className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase mb-6">Integrations</div>
                <div className="flex flex-col gap-4">
                  <Link href="#getting-started" className="text-[13px] text-slate-600 hover:text-black transition-colors">Getting Started</Link>
                  <Link href="#implementation" className="text-[13px] text-slate-600 hover:text-black transition-colors">Implementation Guide</Link>
                  <Link href="#api" className="text-[13px] text-slate-600 hover:text-black transition-colors">API Reference</Link>
                  <Link href="#sdks" className="text-[13px] text-slate-600 hover:text-black transition-colors">SDKs</Link>
                  <Link href="#connectors" className="text-[13px] text-slate-600 hover:text-black transition-colors">Connector Guides</Link>
                </div>
              </div>
              <div className="w-1/2 bg-slate-50/80 p-10 border-l border-slate-100 flex flex-col justify-center">
                <div className="aspect-[16/9] bg-[#0F172A] rounded border border-slate-200 shadow-sm mb-6 flex overflow-hidden p-4 relative">
                  <div className="absolute top-4 left-4 right-4 bottom-4 border border-slate-700/50 rounded flex text-[10px] font-mono text-slate-400 p-3">
                     // Refold AI Builder<br />
                    Agent initializing...<br />
                    Connecting capabilities...
                  </div>
                </div>
                <h4 className="font-semibold text-sm mb-2 text-[#08090B]">Build any Custom Apps for every Integration Edge Case in Minutes.</h4>
                <p className="text-xs text-slate-500 leading-relaxed">From unsupported to enterprise-ready in days! If an app isn't supported yet, Refold builds it for you manually or through agents.</p>
              </div>
            </>
          )}

          {/* DEVELOPERS MENU */}
          {activeMenu === 'developers' && (
            <>
              <div className="w-1/2 p-10">
                <div className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase mb-6">Developers</div>
                <div className="flex flex-col gap-4">
                  <Link href="#docs" className="text-[13px] text-slate-600 hover:text-black transition-colors">Documentation</Link>
                  <Link href="#quickstart" className="text-[13px] text-slate-600 hover:text-black transition-colors">Quickstart</Link>
                  <Link href="#guides" className="text-[13px] text-slate-600 hover:text-black transition-colors">Guides</Link>
                  <Link href="#changelog" className="text-[13px] text-slate-600 hover:text-black transition-colors">Changelog</Link>
                </div>
              </div>
              <div className="w-1/2 bg-slate-50/80 p-10 border-l border-slate-100">
                <div className="aspect-[16/9] bg-gradient-to-br from-blue-600 to-indigo-700 rounded border border-slate-200 shadow-sm mb-6 flex items-center justify-center text-white">
                  <Activity className="w-10 h-10 opacity-50" />
                </div>
                <h4 className="font-semibold text-sm mb-2 text-[#08090B]">Developer Infrastructure</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Robust APIs and webhooks designed for scale and reliability.</p>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Lime Green Banner */}
      <div className="bg-[#D9FC50] text-[#08090B] py-3 px-4 text-center text-[11px] sm:text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-[#c9eb4a] transition-colors cursor-pointer border-t border-[#08090B]/5 relative z-20">
        Introducing Agentic Commerce — the revenue layer between AI buyers and merchants. <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
      </div>
    </div>
  );
}
