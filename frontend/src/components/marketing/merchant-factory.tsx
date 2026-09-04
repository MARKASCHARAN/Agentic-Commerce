import { Database, FileSpreadsheet, Box, Activity, Bot, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MerchantFactory() {
  return (
    <section className="py-32 px-6 relative overflow-hidden bg-white">
      {/* 4K Background Texture */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none" 
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=3000&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'contrast(150%) grayscale(100%)'
        }}
      />
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center relative z-10">
        <div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-8 text-[#08090B]">
            Bring the catalog you already have.
          </h2>
          <p className="text-xl text-slate-600 leading-relaxed mb-16 font-light">
            We turn it into an agent-ready commerce system. Connect your CSV, ERP, or Shopify store, and we generate the context window your agent needs to sell.
          </p>
          
          <div className="flex flex-col gap-6 font-mono text-[13px] text-slate-500">
            <div className="flex items-center gap-6">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><FileSpreadsheet className="w-5 h-5 text-slate-600" /></div>
              <span className="tracking-widest uppercase font-bold">CSV / XLSX</span>
            </div>
            <div className="pl-5 border-l border-slate-200 ml-5 h-6" />
            <div className="flex items-center gap-6">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><Database className="w-5 h-5 text-slate-600" /></div>
              <span className="tracking-widest uppercase font-bold">9,600 PRODUCTS</span>
            </div>
            <div className="pl-5 border-l border-slate-200 ml-5 h-6" />
            <div className="flex items-center gap-6">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><Box className="w-5 h-5 text-slate-600" /></div>
              <span className="tracking-widest uppercase font-bold">INVENTORY & POLICIES</span>
            </div>
            <div className="pl-5 border-l border-slate-200 ml-5 h-6" />
            <div className="flex items-center gap-6">
              <div className="w-10 h-10 rounded-full bg-[#2563EB]/10 flex items-center justify-center"><Bot className="w-5 h-5 text-[#2563EB]" /></div>
              <span className="tracking-widest uppercase font-bold text-[#2563EB]">MERCHANT AGENT</span>
            </div>
            <div className="pl-5 border-l border-slate-200 ml-5 h-6" />
            <div className="flex items-center gap-6">
              <div className="w-10 h-10 rounded-full bg-[#08090B] flex items-center justify-center"><Users className="w-5 h-5 text-white" /></div>
              <span className="tracking-widest uppercase font-bold text-[#08090B]">AI BUYERS</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-[24px] p-10 shadow-2xl shadow-slate-200/60 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#2563EB]/5 rounded-bl-[100%] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2">Import Catalog</p>
              <p className="text-[#08090B] text-sm font-mono font-medium">amazon_catalog.csv</p>
            </div>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-mono font-bold rounded-md border border-emerald-100">
              9,600 rows detected
            </span>
          </div>
          
          <div className="space-y-5 mb-10 font-mono text-[13px]">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Name</span> 
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500" /></div>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">SKU</span> 
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500" /></div>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Selling Price</span> 
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500" /></div>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Cost Price</span> 
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500" /></div>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Stock</span> 
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500" /></div>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Description</span> 
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500" /></div>
            </div>
          </div>
          
          <button className="w-full h-14 bg-[#08090B] text-white hover:bg-black/80 font-medium tracking-wide rounded-xl shadow-lg transition-all">
            Process Catalog
          </button>
          <p className="text-center mt-5 text-[11px] font-mono text-emerald-600 font-bold uppercase tracking-widest">
            ✓ 9,600 products ready for AI inference
          </p>
        </div>
      </div>
    </section>
  );
}
