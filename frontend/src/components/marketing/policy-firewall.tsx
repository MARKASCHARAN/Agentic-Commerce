export function PolicyFirewall() {
  return (
    <section className="py-32 px-6 bg-white border-t border-slate-200 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[800px] bg-gradient-to-b from-slate-50 to-white pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-[#08090B]">
          AI can reason.
        </h2>
        <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-24 text-slate-400">
          Your backend decides.
        </h2>
        
        <div className="flex flex-col md:flex-row items-stretch justify-center gap-8 relative">
          
          {/* AI Side */}
          <div className="flex-1 bg-white border border-slate-200 rounded-[24px] p-12 text-left shadow-xl shadow-slate-200/50">
            <h3 className="text-[11px] font-bold tracking-[0.2em] text-[#2563EB] uppercase mb-10">AI Agent</h3>
            <div className="space-y-6 text-slate-600 font-mono text-sm">
              <p>Reason</p>
              <p>Search</p>
              <p>Recommend</p>
              <p>Negotiate</p>
              <p>Propose</p>
            </div>
          </div>
          
          {/* Firewall Middle */}
          <div className="flex flex-col items-center justify-center shrink-0 z-10 -my-6 md:my-0 relative">
            <div className="w-px h-16 md:w-16 md:h-px bg-slate-200" />
            
            <div className="bg-red-50 border border-red-200 text-red-600 font-mono text-[11px] font-bold tracking-[0.2em] px-6 py-3 rounded-full uppercase shadow-[0_0_20px_rgba(239,68,68,0.1)]">
              Policy Firewall
            </div>
            
            <div className="h-10 w-px border-l-2 border-dashed border-emerald-300 my-4 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            </div>
            
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 font-mono text-[11px] font-bold tracking-[0.2em] px-6 py-3 rounded-full uppercase">
              Safe Action
            </div>
            
            <div className="w-px h-16 md:w-16 md:h-px bg-slate-200" />
          </div>
          
          {/* Deterministic Side */}
          <div className="flex-1 bg-[#08090B] border border-black rounded-[24px] p-12 text-left shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#2563EB]/10 blur-[80px] rounded-full pointer-events-none" />
            
            <h3 className="text-[11px] font-bold tracking-[0.2em] text-white uppercase mb-10 relative z-10">Deterministic Engine</h3>
            <div className="space-y-6 text-slate-400 font-mono text-sm relative z-10">
              <p>Validate Inventory</p>
              <p>Check Price Policy</p>
              <p>Enforce Margin limits</p>
              <p>Require Human Approval</p>
              <p className="text-[#2563EB] font-bold">Prepare Razorpay Payment</p>
              <p>Listen for Webhook</p>
              <p className="text-emerald-400 font-bold">Reconcile Amount</p>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
