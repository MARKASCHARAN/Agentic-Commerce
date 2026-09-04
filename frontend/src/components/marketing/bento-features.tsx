import { Lock, ShieldCheck, Activity, Target, GitCommit, Database, Zap } from "lucide-react";

export function BentoFeatures() {
  return (
    <section className="py-24 bg-[#F3F2EC] font-sans">
      <div className="max-w-[1200px] mx-auto px-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Top Card: Policy Firewall (Full Width) */}
          <div className="md:col-span-2 bg-white rounded-2xl p-10 md:p-14 shadow-sm border border-black/5 flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1">
              <h3 className="text-xl md:text-2xl font-bold text-[#08090B] tracking-tight mb-4">
                Deterministic Policy Firewall
              </h3>
              <p className="text-slate-500 font-light leading-relaxed max-w-lg mb-8">
                Encourage autonomous sales while minimizing risk. Set strict spend limits, minimum margin thresholds, and maximum discount rules based on product categories and inventory levels. Your AI agent negotiates freely, but your backend retains absolute authority.
              </p>
              <button className="text-sm font-semibold text-[#08090B] hover:text-[#2563EB] transition-colors flex items-center gap-2">
                Learn about Policies <span className="text-[10px]">→</span>
              </button>
            </div>

            <div className="flex-1 w-full bg-[#F9F9F8] rounded-xl border border-black/5 p-8 flex items-center justify-center relative overflow-hidden h-[240px]">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
              <div className="bg-white rounded-lg shadow-xl shadow-black/5 border border-black/10 p-4 w-full max-w-[320px] relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-red-50 flex items-center justify-center border border-red-100">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 text-red-500 fill-current">
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
                  <div>
                    <p className="text-xs font-bold text-[#08090B]">Max Discount Reached</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Rule: {"<"} 15% margin</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-500">BLOCKED</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Left: Revenue Intelligence */}
          <div className="bg-white rounded-2xl p-10 md:p-12 shadow-sm border border-black/5 flex flex-col h-[500px]">
            <h3 className="text-xl md:text-2xl font-bold text-[#08090B] tracking-tight mb-4">
              Collaborative Revenue Intelligence
            </h3>
            <p className="text-slate-500 font-light leading-relaxed mb-10">
              Go beyond simple Q&A. The agent analyzes cart context, inventory, and historical conversion data to dynamically bundle products and maximize Average Order Value in real-time.
            </p>

            <div className="mt-auto bg-[#F9F9F8] rounded-xl border border-black/5 p-6 flex-1 flex items-center justify-center relative">
              <div className="flex flex-col gap-3 w-full max-w-[240px]">
                <div className="bg-white rounded p-3 flex items-center gap-3 border border-black/5 shadow-sm relative ml-12">
                  <div className="absolute -left-8 top-1/2 w-8 h-px bg-slate-300" />
                  <div className="absolute -left-8 top-1/2 -translate-y-[80px] w-px h-[80px] bg-slate-300" />
                  <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center">
                    <Target className="w-3 h-3 text-emerald-600" />
                  </div>
                  <span className="text-xs text-slate-400">Analyzing Cart...</span>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center relative z-10 shadow-sm mx-auto -my-4 bg-[#F9F9F8]">
                  <GitCommit className="w-4 h-4 text-slate-400" />
                </div>
                <div className="bg-white rounded p-3 flex items-center justify-between border border-emerald-500/30 shadow-sm relative ml-12">
                  <div className="absolute -left-8 top-1/2 w-8 h-px bg-slate-300" />
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-px h-[40px] bg-slate-300" />
                  <div className="flex items-center gap-3">
                    <div className="bg-[#0026d1]/10 px-2 py-1 rounded">
                      <Zap className="w-3 h-3 text-[#0026d1]" />
                    </div>
                    <span className="text-xs font-bold text-[#08090B]">Upsell Bundle</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Right: Reconciliation */}
          <div className="bg-white rounded-2xl p-10 md:p-12 shadow-sm border border-black/5 flex flex-col h-[500px]">
            <h3 className="text-xl md:text-2xl font-bold text-[#08090B] tracking-tight mb-4">
              Cryptographic Reconciliation
            </h3>
            <p className="text-slate-500 font-light leading-relaxed mb-10">
              Effortlessly capture funds with total confidence. Every agent transaction is cryptographically verified against Razorpay callbacks before the financial state is committed.
            </p>

            <div className="mt-auto bg-[#F9F9F8] rounded-xl border border-black/5 p-8 flex-1 flex flex-col items-center justify-center relative">

              <div className="w-full bg-white rounded-lg border border-black/5 p-4 shadow-sm mb-6 relative z-10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#3395FF]/10 flex items-center justify-center">
                    <Database className="w-4 h-4 text-[#3395FF]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#08090B]">Razorpay Capture</p>
                    <p className="text-[10px] text-slate-400">Verifying signature...</p>
                  </div>
                </div>
                <span className="text-sm font-mono font-bold text-[#08090B]">₹26,995.50</span>
              </div>

              <div className="w-px h-8 bg-slate-300 mb-6 border-l border-dashed border-slate-400" />

              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-white rounded-lg border border-black/5 p-3 shadow-sm text-center">
                  <p className="text-[10px] text-slate-400 mb-1">Agent Offer</p>
                  <p className="text-xs font-mono font-bold text-[#08090B]">₹26,995.50</p>
                </div>
                <div className="bg-white rounded-lg border border-emerald-500/30 p-3 shadow-sm text-center bg-emerald-50/30">
                  <p className="text-[10px] text-emerald-600 mb-1">Status</p>
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Matched</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
