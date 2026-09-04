import { ShieldAlert, ArrowRight, Check, Activity, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ReconciliationSection() {
  return (
    <>
      {/* Safety / Reconciliation */}
      <section className="py-32 px-6 bg-[#FAFAFA] border-t border-slate-200">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-20 text-[#08090B]">
            When the numbers don't match,<br/>we stop.
          </h2>
          
          <div className="flex flex-col items-center font-mono text-sm">
            <div className="bg-white border border-slate-200 px-8 py-5 rounded-[16px] text-[#08090B] shadow-xl shadow-slate-200/50 z-10 w-64 relative">
              <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2">Internal Order</p>
              <p className="text-2xl font-medium">₹77,381.76</p>
            </div>
            
            <div className="w-px h-12 bg-slate-300" />
            <ArrowRight className="w-4 h-4 text-slate-400 rotate-90 mb-2" />
            
            <div className="bg-[#3395FF]/5 border border-[#3395FF]/20 px-8 py-5 rounded-[16px] text-[#08090B] shadow-xl shadow-slate-200/50 z-10 w-64">
              <p className="text-[10px] font-bold tracking-[0.2em] text-[#3395FF] uppercase mb-2">Razorpay Capture</p>
              <p className="text-2xl font-medium text-[#3395FF]">₹49,000.00</p>
            </div>

            <div className="w-px h-12 bg-red-200" />
            <ArrowRight className="w-4 h-4 text-red-500 rotate-90 mb-2" />
            
            <div className="bg-red-50 border border-red-200 px-8 py-5 rounded-[16px] text-red-600 shadow-xl shadow-slate-200/50 z-10 w-64 flex flex-col items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-red-500" />
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase mt-1">Amount Mismatch</p>
              <p className="text-xs">Reconciliation Failed</p>
            </div>
            
            <p className="mt-16 text-slate-600 tracking-[0.2em] uppercase font-bold bg-white px-8 py-3 rounded-full border border-slate-200 shadow-sm text-xs">
              Order not marked paid
            </p>
            <p className="mt-8 text-slate-500 max-w-xl mx-auto font-sans font-light leading-relaxed">
              No silent amount mutation. No inferred payment success. No false capture state. Strict validation for financial safety.
            </p>
          </div>
        </div>
      </section>

      {/* Observability */}
      <section className="py-32 px-6 bg-white border-t border-slate-200 relative overflow-hidden">
        {/* 4K Texture */}
        <div 
          className="absolute inset-0 opacity-[0.02] pointer-events-none" 
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=3000&auto=format&fit=crop")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'contrast(150%) grayscale(100%)'
          }}
        />
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 relative z-10">
          <div>
            <h2 className="text-4xl font-medium tracking-tight mb-8 text-[#08090B]">
              Every agent action leaves a trail.
            </h2>
            <p className="text-xl text-slate-600 leading-relaxed mb-12 font-light">
              Lightweight telemetry captures the entire execution path. From the initial search to the final Razorpay webhook, you know exactly what your agent did and why.
            </p>
            
            <div className="bg-white border border-slate-200 rounded-[24px] p-10 shadow-2xl shadow-slate-200/60 font-mono text-xs">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                 <p className="text-slate-400 font-bold tracking-widest uppercase text-[10px]">Trace: req_8f92j1kl</p>
                 <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-100">COMPLETED</span>
              </div>
              
              <div className="space-y-5 text-slate-600 text-[13px]">
                <div className="flex items-center"><span className="w-24 text-slate-400">09:41:02</span> <span className="flex-1 font-medium">search_products</span> <span className="w-16 text-right text-slate-400">142ms</span></div>
                <div className="flex items-center"><span className="w-24 text-slate-400">09:41:03</span> <span className="flex-1 font-medium">create_request</span> <span className="w-16 text-right text-slate-400">189ms</span></div>
                <div className="flex items-center"><span className="w-24 text-slate-400">09:41:03</span> <span className="flex-1 text-[#2563EB] font-bold">revenue_engine</span> <span className="w-16 text-right text-slate-400">94ms</span></div>
                <div className="flex items-center"><span className="w-24 text-slate-400">09:41:04</span> <span className="flex-1 font-medium">counter_offer</span> <span className="w-16 text-right text-slate-400">211ms</span></div>
                <div className="flex items-center"><span className="w-24 text-slate-400">09:41:05</span> <span className="flex-1 text-amber-500 font-bold">human_approval</span> <span className="w-16 text-right text-slate-400">—</span></div>
                <div className="flex items-center"><span className="w-24 text-slate-400">09:41:06</span> <span className="flex-1 text-[#3395FF] font-bold">razorpay</span> <span className="w-16 text-right text-slate-400">640ms</span></div>
                <div className="flex items-center"><span className="w-24 text-slate-400">09:41:08</span> <span className="flex-1 font-medium">webhook</span> <span className="w-16 text-right text-slate-400">—</span></div>
                <div className="flex items-center"><span className="w-24 text-slate-400">09:41:08</span> <span className="flex-1 text-emerald-500 font-bold">reconciliation</span> <span className="w-16 text-right text-slate-400">126ms</span></div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col justify-center pl-0 md:pl-12">
            <h2 className="text-4xl font-medium tracking-tight mb-8 text-[#08090B]">
              Built for commerce where money has consequences.
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0"><Lock className="w-4 h-4 text-slate-600"/></div>
                <div>
                  <h4 className="text-[15px] font-medium text-[#08090B]">Merchant Isolation</h4>
                  <p className="text-sm text-slate-500 mt-1">Multi-tenant architecture ensures strict separation of catalog, policies, and agent context.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0"><Check className="w-4 h-4 text-slate-600"/></div>
                <div>
                  <h4 className="text-[15px] font-medium text-[#08090B]">Idempotency</h4>
                  <p className="text-sm text-slate-500 mt-1">Safe API boundaries preventing double-charges and redundant order generation.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0"><Activity className="w-4 h-4 text-slate-600"/></div>
                <div>
                  <h4 className="text-[15px] font-medium text-[#08090B]">Webhook Verification</h4>
                  <p className="text-sm text-slate-500 mt-1">Cryptographic validation of Razorpay callbacks before committing financial state.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
