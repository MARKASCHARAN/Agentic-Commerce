"use client";

import { useState } from "react";
import Image from "next/image";

type Tab = {
  id: string;
  title: string;
  badge: string;
  heading: string;
  description: string;
  image: string;
  gradient: string;
};

const tabs: Tab[] = [
  {
    id: "step1",
    title: "1. Connect your catalog",
    badge: "STEP 01",
    heading: "Bring the catalog you already have",
    description: "Connect your CSV, ERP, or Shopify store, and we generate the context window your agent needs to sell, complete with cross-sell revenue intelligence.",
    image: "/Frame 2147227734.svg",
    gradient: "from-purple-500 to-fuchsia-500"
  },
  {
    id: "step2",
    title: "2. Enforce margin policies",
    badge: "STEP 02",
    heading: "AI can negotiate. Your backend decides.",
    description: "Give your agent the authority to close deals, while maintaining strict deterministic boundaries on minimum margin and maximum discount through the Policy Firewall.",
    image: "/auth.svg",
    gradient: "from-amber-500 to-orange-500"
  },
  {
    id: "step3",
    title: "3. Reconcile transactions",
    badge: "STEP 03",
    heading: "When the numbers don't match, we stop.",
    description: "Every agent action leaves an audit trail. Safe API boundaries prevent double-charges and ensure cryptographic validation of Razorpay callbacks before committing financial state.",
    image: "/monitor3.svg",
    gradient: "from-blue-400 to-cyan-400"
  }
];

export function FeaturesTabs() {
  const [activeTab, setActiveTab] = useState<string>("step1");

  const currentData = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <section className="bg-[#18191B] text-white overflow-hidden font-sans relative z-10">

      {/* Title Section */}
      <div className="border-b border-[#2B2D31] py-24 flex flex-col items-center justify-center relative">
        {/* Subtle grid lines in background */}
        <div className="absolute top-0 bottom-0 left-1/4 w-px bg-[#2B2D31]/50" />
        <div className="absolute top-0 bottom-0 right-1/4 w-px bg-[#2B2D31]/50" />

        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="w-6 h-4 bg-gradient-to-r from-cyan-400 to-blue-500" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#00E5FF] uppercase">Our Process</span>
        </div>

        <h2 className="text-5xl md:text-6xl font-serif text-white tracking-tight relative z-10" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          Deliver agent-ready merchants in three steps
        </h2>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-[#2B2D31] relative">
        <div className="absolute left-1/4 top-0 bottom-0 w-px bg-[#2B2D31]" />
        <div className="absolute right-1/4 top-0 bottom-0 w-px bg-[#2B2D31]" />

        <div className="max-w-[1400px] mx-auto w-full grid grid-cols-3 relative z-10">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-8 text-center text-[13px] font-light tracking-wide transition-all relative border-r border-[#2B2D31] last:border-r-0 ${isActive ? "text-white bg-[#222327]" : "text-slate-500 hover:text-slate-300 hover:bg-[#1D1E21]"
                  }`}
              >
                {isActive && (
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${tab.gradient} opacity-80`} />
                )}
                {tab.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="relative">
        <div className="absolute left-1/4 top-0 bottom-0 w-px bg-[#2B2D31]/50" />
        <div className="absolute right-1/4 top-0 bottom-0 w-px bg-[#2B2D31]/50" />

        <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 relative z-10 min-h-[600px]">

          {/* Left: Text */}
          <div className="p-16 md:p-24 flex flex-col justify-center border-r border-[#2B2D31]">
            <div className="inline-block bg-[#0026d1] text-white px-4 py-2 font-mono text-[11px] font-bold tracking-[0.2em] mb-12 uppercase w-fit">
              {currentData.badge}
            </div>

            <h3 className="text-4xl md:text-5xl font-serif text-white mb-8" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              {currentData.heading}
            </h3>

            <p className="text-lg text-slate-400 font-light leading-relaxed max-w-md">
              {currentData.description}
            </p>
          </div>

          {/* Right: SVG Image */}
          <div className="flex items-center justify-center p-8 md:p-16 bg-[#1D1E21]/50 relative overflow-hidden group">
            {/* Dynamic ambient glow based on active tab */}
            {activeTab === "step1" && <div className="absolute inset-0 bg-purple-500/10 blur-[100px] transition-opacity duration-1000" />}
            {activeTab === "step2" && <div className="absolute inset-0 bg-orange-500/10 blur-[100px] transition-opacity duration-1000" />}
            {activeTab === "step3" && <div className="absolute inset-0 bg-blue-500/10 blur-[100px] transition-opacity duration-1000" />}

            <img
              key={currentData.image}
              src={currentData.image}
              alt={currentData.heading}
              className="w-full h-auto max-w-[600px] shadow-2xl rounded-lg border border-white/5 animate-fade-in relative z-10 transition-transform duration-700 ease-out group-hover:scale-[1.02]"
            />
          </div>
        </div>
      </div>

      {/* Bottom Grid Border */}
      <div className="border-t border-[#2B2D31] h-16 w-full" />
    </section>
  );
}
