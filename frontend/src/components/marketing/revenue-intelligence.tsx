import { User, Bot } from "lucide-react";

export function RevenueIntelligence() {
  return (
    <section className="py-32 px-6 bg-[#FAFAFA] border-t border-slate-200">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20">
        
        {/* Revenue Intelligence */}
        <div>
          <h2 className="text-4xl font-medium tracking-tight mb-8 text-[#08090B]">
            Don't just complete transactions.<br/>Grow them.
          </h2>
          <p className="text-xl text-slate-600 leading-relaxed mb-16 font-light">
            Our Revenue Engine dynamically identifies real cross-sell and upsell opportunities based on catalog context, not hallucinations. If there's no logical add-on, the agent won't push one.
          </p>
          
          <div className="bg-white border border-slate-200 rounded-[24px] p-10 mt-12 relative overflow-hidden shadow-xl shadow-slate-200/50">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#2563EB]/5 blur-3xl rounded-full pointer-events-none" />
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#2563EB] uppercase mb-8">Revenue Intelligence</p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-[16px] p-6 mb-8 relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                <p className="text-[11px] text-slate-500 font-mono font-bold uppercase tracking-wider">Opportunity: CROSS-SELL</p>
              </div>
              
              <p className="text-[#08090B] font-medium mb-1">AMOLED Smart Fitness Watch</p>
              <p className="text-slate-500 text-sm mb-6">+ 65W Fast Charger</p>
              
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500">Confidence: <span className="text-[#08090B] font-bold">80%</span></span>
                <span className="text-slate-500">Priority: <span className="text-[#2563EB] font-bold">HIGH</span></span>
              </div>
            </div>
            
            <div className="flex justify-between items-end border-t border-slate-100 pt-6">
              <span className="text-slate-500 font-mono text-[13px]">Expected uplift</span>
              <span className="text-[#08090B] font-mono text-2xl font-bold">+ ₹2,499</span>
            </div>
          </div>
        </div>
        
        {/* Negotiation */}
        <div className="flex flex-col justify-center">
          <h2 className="text-4xl font-medium tracking-tight mb-8 text-[#08090B]">
            AI can negotiate.<br/>Your merchant sets the rules.
          </h2>
          <p className="text-xl text-slate-600 leading-relaxed mb-16 font-light">
            Give your agent the authority to close deals, while maintaining strict deterministic boundaries on minimum margin and maximum discount.
          </p>

          <div className="bg-white border border-slate-200 rounded-[24px] p-10 relative shadow-xl shadow-slate-200/50">
            
            <div className="flex items-start gap-4 mb-8">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200"><User className="w-5 h-5 text-slate-600"/></div>
              <div className="bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-[16px] rounded-tl-none text-[15px] text-slate-700 font-light">
                I like the watches, but ₹35,000 is over budget. Can you do ₹32,000 for the 5 units?
              </div>
            </div>
            
            <div className="flex flex-col items-center my-10 relative">
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-200 -translate-x-1/2" />
              <div className="bg-white border border-slate-200 rounded-full px-6 py-3 relative z-10 shadow-sm flex flex-col items-center gap-1">
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Deterministic Policy</p>
                <div className="flex items-center gap-4 text-[11px] font-mono font-bold">
                  <span className="text-red-500">Max Discount: 10%</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-emerald-500">Margin: Protected</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 flex-row-reverse mb-2">
              <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.3)]"><Bot className="w-5 h-5 text-white"/></div>
              <div className="bg-[#08090B] px-6 py-5 rounded-[16px] rounded-tr-none text-white text-right w-full">
                <p className="mb-4 text-slate-300 font-light text-[15px]">Counter-offer approved. I can authorize this price.</p>
                <div className="flex items-end justify-end gap-3 mb-1">
                  <p className="font-mono text-lg line-through text-slate-500">₹35,000</p>
                  <p className="font-mono text-3xl text-white font-medium">₹32,000</p>
                </div>
                <p className="text-[11px] text-[#2563EB] font-mono font-bold tracking-widest uppercase">8.57% discount applied</p>
              </div>
            </div>
          </div>
          
        </div>
        
      </div>
    </section>
  );
}
