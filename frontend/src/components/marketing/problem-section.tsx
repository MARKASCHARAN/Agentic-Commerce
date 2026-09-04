import { User, Bot, ArrowRight } from "lucide-react";

export function ProblemSection() {
  return (
    <section className="py-32 px-6 bg-[#FAFAFA] border-t border-slate-200">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-20 text-[#08090B]">
          Your store was built for humans.
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto text-left mb-20">
          
          {/* Humans */}
          <div className="bg-white border border-slate-200 rounded-[24px] p-12 shadow-xl shadow-slate-200/50">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-6 h-6 text-slate-600 fill-current">
                  <g>
                    <path d="M30.47 10.67H32v15.24h-1.53Z" />
                    <path d="M9.14 25.91h21.33v1.52H9.14Z" />
                    <path d="M27.43 13.72h1.52v3.04h-1.52Z" />
                    <path d="m24.38 13.72 3.05 0 0 -1.53 -6.1 0 0 1.53 -1.52 0 0 3.04 1.52 0 0 1.53 6.1 0 0 -1.53 -3.05 0 0 -3.04z" />
                    <path d="m9.14 9.15 0 1.52 21.33 0 0 -1.52 -4.57 0 0 -3.05 -1.52 0 0 3.05 -15.24 0z" />
                    <path d="M10.66 22.86h9.15v1.52h-9.15Z" />
                    <path d="M10.66 19.81h4.58v1.53h-4.58Z" />
                    <path d="m9.14 10.67 -1.52 0 0 10.67 -6.1 0 0 1.52 6.1 0 0 3.05 1.52 0 0 -15.24z" />
                    <path d="M1.52 4.57h22.86V6.1H1.52Z" />
                    <path d="M0 6.1h1.52v15.24H0Z" />
                  </g>
                </svg>
              </div>
              <h3 className="text-xl font-medium text-[#08090B]">Human Commerce</h3>
            </div>
            
            <div className="space-y-8 text-slate-400 font-mono text-sm relative">
              <div className="absolute top-4 bottom-4 left-[9px] w-px bg-slate-200" />
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center border-4 border-white" />
                Search
              </div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center border-4 border-white" />
                Browse
              </div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center border-4 border-white" />
                Cart
              </div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-5 h-5 rounded-full bg-[#08090B] flex items-center justify-center border-4 border-white" />
                <span className="text-[#08090B] font-bold">Checkout</span>
              </div>
            </div>
          </div>
          
          {/* AI Buyers */}
          <div className="bg-[#08090B] border border-black rounded-[24px] p-12 shadow-2xl relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#2563EB]/20 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-10 relative z-10">
              <div className="w-12 h-12 rounded-full bg-[#2563EB] flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-6 h-6 text-white fill-current">
                  <g>
                    <path d="m30.47 18.28 0 -10.66 -1.52 0 0 9.14 -1.52 0 0 -1.52 -1.53 0 0 12.19 1.53 0 0 -1.53 3.04 0 0 -1.52 1.53 0 0 -6.1 -1.53 0z" />
                    <path d="M24.38 12.19h1.52v3.05h-1.52Z" />
                    <path d="m6.09 27.43 0 1.52 1.53 0 0 1.53 1.52 0 0 -1.53 13.71 0 0 1.53 1.53 0 0 -1.53 1.52 0 0 -1.52 -19.81 0z" />
                    <path d="M22.85 18.28h1.53v3.05h-1.53Z" />
                    <path d="M22.85 10.67h1.53v1.52h-1.53Z" />
                    <path d="M19.81 16.76h3.04v1.52h-3.04Z" />
                    <path d="M9.14 30.48h13.71V32H9.14Z" />
                    <path d="M19.81 21.33h3.04v1.53h-3.04Z" />
                    <path d="M18.28 18.28h1.53v3.05h-1.53Z" />
                    <path d="M18.28 1.52h1.53v1.53h-1.53Z" />
                    <path d="M13.71 24.38h4.57v1.52h-4.57Z" />
                    <path d="M13.71 0h4.57v1.52h-4.57Z" />
                    <path d="M12.19 18.28h1.52v3.05h-1.52Z" />
                    <path d="M12.19 1.52h1.52v1.53h-1.52Z" />
                    <path d="M9.14 16.76h3.05v1.52H9.14Z" />
                    <path d="m22.85 10.67 0 -1.53 -6.09 0 0 -4.57 1.52 0 0 -1.52 -4.57 0 0 1.52 1.52 0 0 4.57 -6.09 0 0 1.53 13.71 0z" />
                    <path d="M9.14 21.33h3.05v1.53H9.14Z" />
                    <path d="M7.62 18.28h1.52v3.05H7.62Z" />
                    <path d="M7.62 10.67h1.52v1.52H7.62Z" />
                    <path d="M6.09 12.19h1.53v3.05H6.09Z" />
                    <path d="m6.09 15.24 -1.52 0 0 1.52 -1.53 0 0 -9.14 -1.52 0 0 10.66 -1.52 0 0 6.1 1.52 0 0 1.52 3.05 0 0 1.53 1.52 0 0 -12.19z" />
                  </g>
                </svg>
              </div>
              <h3 className="text-xl font-medium text-white">AI Commerce</h3>
            </div>
            
            <div className="space-y-8 text-slate-400 font-mono text-sm relative z-10">
              <div className="absolute top-4 bottom-4 left-[9px] w-px bg-slate-800" />
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center border-4 border-[#08090B]" />
                <span className="text-[#2563EB] font-bold">Intent</span>
              </div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center border-4 border-[#08090B]" />
                Discover
              </div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center border-4 border-[#08090B]" />
                Decide
              </div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center border-4 border-[#08090B]" />
                Negotiate
              </div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center border-4 border-[#08090B]" />
                <span className="text-white font-bold">Transact</span>
              </div>
            </div>
          </div>
          
        </div>
        
        <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-light">
          Traditional merchant infrastructure exposes products and payments visually. It doesn't give AI agents a safe, structured way to reason about inventory, revenue opportunities, pricing policies and transactions.
        </p>
      </div>
    </section>
  );
}
