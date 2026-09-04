import { ArrowDown, Check, Plus, Minus, Equal, ShoppingBag, ArrowRight } from "lucide-react";

export function RevenueFlow() {
  return (
    <section className="bg-[#18191B] text-white py-32 font-sans relative overflow-hidden">
      {/* Background ambient effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ background: 'linear-gradient(90deg, rgba(0, 38, 209, 1) 0%, rgba(87, 145, 199, 1) 50%, rgba(255, 255, 255, 1) 100%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 relative z-10">

        {/* Top Header */}
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif mb-6" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            The AI buyer doesn't just find a product.<br />
            Your agent finds the <span className="text-[#0026d1]">revenue</span>.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 mb-32 items-start">

          {/* Left Column: Visual Flow */}
          <div className="flex flex-col items-center">

            <div className="bg-[#222327] border border-[#33353A] rounded-lg p-6 w-full max-w-sm text-center shadow-xl">
              <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2">AI Buyer Intent</div>
              <p className="text-sm font-serif italic text-white">"Find me a laptop under ₹40,000."</p>
            </div>

            <div className="h-10 w-px bg-[#33353A]" />
            <ArrowDown className="w-4 h-4 text-slate-500 mb-2" />

            <div className="bg-[#222327]/50 border border-[#33353A]/50 rounded-lg p-4 w-full max-w-sm text-center mb-2">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Product Discovery</p>
            </div>

            <div className="h-10 w-px bg-[#33353A]" />
            <ArrowDown className="w-4 h-4 text-[#0026d1] mb-2" />

            {/* The Revenue Engine block */}
            <div className="bg-[#0026d1]/10 border border-[#0026d1]/30 rounded-lg p-6 w-full max-w-sm mb-2 relative">
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-sm shadow-lg"
                style={{ background: 'linear-gradient(90deg, rgba(0, 38, 209, 1) 0%, rgba(87, 145, 199, 1) 50%, rgba(255, 255, 255, 1) 100%)' }}
              >
                Revenue Engine
              </div>
              <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-sm font-medium text-slate-200">Cross-sell</span>
                  <Check className="w-4 h-4 text-[#D9FC50]" />
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-sm font-medium text-slate-200">Upsell</span>
                  <Check className="w-4 h-4 text-[#D9FC50]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Bundle</span>
                  <Check className="w-4 h-4 text-[#D9FC50]" />
                </div>
              </div>
            </div>

            <div className="h-10 w-px bg-[#33353A]" />
            <ArrowDown className="w-4 h-4 text-slate-500 mb-2" />

            <div className="bg-[#222327]/50 border border-[#33353A]/50 rounded-lg p-4 w-full max-w-sm text-center mb-2">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Merchant Policy</p>
            </div>

            <div className="h-10 w-px bg-[#33353A]" />
            <ArrowDown className="w-4 h-4 text-slate-500 mb-2" />

            <div className="bg-[#02042B] border border-[#3395FF]/30 rounded-lg p-4 w-full max-w-sm text-center mb-2 shadow-[0_0_30px_rgba(51,149,255,0.2)]">
              <p className="text-xs font-bold text-[#3395FF] uppercase tracking-widest">Razorpay / Merchant Revenue</p>
            </div>

          </div>

          {/* Right Column: The Equation */}
          <div className="flex flex-col justify-center h-full">
            <h3 className="text-3xl font-serif mb-12 text-[#D9FC50]" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              Every conversation is a revenue opportunity.
            </h3>

            <div className="bg-[#222327] border border-[#33353A] rounded-xl p-8 md:p-12 shadow-2xl relative">
              <div className="absolute top-0 right-10 w-px h-full bg-[#33353A]/30" />

              <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-8 flex items-center gap-3">
                <ShoppingBag className="w-4 h-4" /> Merchant Revenue
              </div>

              <div className="flex flex-col gap-6 font-mono">
                <div className="flex items-center justify-between text-slate-300 text-sm md:text-base">
                  <span>Base purchase</span>
                  <span className="text-slate-500">₹40,000</span>
                </div>

                <div className="flex items-center gap-4 text-[#0026d1]">
                  <Plus className="w-4 h-4" />
                  <div className="w-full h-px bg-white/5" />
                </div>

                <div className="flex items-center justify-between text-sm md:text-base text-white">
                  <span>Cross-sell</span>
                  <span className="text-[#0026d1]">+ ₹4,999</span>
                </div>

                <div className="flex items-center gap-4 text-[#0026d1]">
                  <Plus className="w-4 h-4" />
                  <div className="w-full h-px bg-white/5" />
                </div>

                <div className="flex items-center justify-between text-sm md:text-base text-white">
                  <span>Upsell</span>
                  <span className="text-[#0026d1]">+ ₹2,500</span>
                </div>

                <div className="flex items-center gap-4 text-[#0026d1]">
                  <Plus className="w-4 h-4" />
                  <div className="w-full h-px bg-white/5" />
                </div>

                <div className="flex items-center justify-between text-sm md:text-base text-white">
                  <span>Bundle</span>
                  <span className="text-[#0026d1]">+ ₹1,999</span>
                </div>

                <div className="flex items-center gap-4 text-red-400">
                  <Minus className="w-4 h-4" />
                  <div className="w-full h-px bg-white/5" />
                </div>

                <div className="flex items-center justify-between text-sm md:text-base text-white">
                  <span className="text-slate-300">Policy-safe negotiation</span>
                  <span className="text-red-400">- ₹3,000</span>
                </div>

                <div className="mt-8 pt-8 border-t-2 border-[#33353A] flex items-center justify-between text-lg md:text-2xl font-bold">
                  <span className="text-white">FINAL GMV</span>
                  <span className="text-[#00E5FF]">₹46,498</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
