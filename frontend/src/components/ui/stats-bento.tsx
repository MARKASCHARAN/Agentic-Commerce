"use client";
import React from "react";

export const StatsBento = () => {
  return (
    <section className="py-24 px-6 border-t border-slate-900 bg-slate-950/50 flex flex-col justify-center">
      <div className="max-w-7xl mx-auto w-full mb-12 text-center">
         <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The Impact of Autonomy</h2>
         <p className="text-slate-400">Merchants see immediate ROI after deploying their first agent.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 md:grid-rows-2 gap-4 max-w-7xl mx-auto w-full">
        {/* Primary Stat */}
        <div className="md:col-span-3 md:row-span-2 bg-blue-600 rounded-3xl p-10 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute bottom-0 left-0 right-0 top-0 bg-[repeating-linear-gradient(45deg,#ffffff_0px_1px,transparent_1px_10px)] opacity-10 mask-[radial-gradient(ellipse_80%_50%_at_100%_0%,#000_70%,transparent_110%)] pointer-events-none"></div>
          <div>
            <span className="inline-block px-3 py-1 bg-white/10 rounded-full text-[10px] font-semibold text-white/80 uppercase tracking-widest mb-6">
              Revenue Lift
            </span>
            <h3 className="text-7xl font-bold tracking-tighter text-white ">
              +34%
            </h3>
          </div>
          <p className="text-white/80 text-sm max-w-xs mt-8">
            Average revenue increase for merchants deploying autonomous negotiation agents within the first 30 days.
          </p>
        </div>

        {/* Secondary Stat A */}
        <div className="md:col-span-3 bg-slate-900 rounded-3xl p-8 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
              Checkout Conversion
            </p>
            <p className="text-4xl font-bold text-white ">+2.4x</p>
          </div>
          <div className="flex gap-1 items-end h-12">
            {[10, 20, 40, 30, 60, 50, 80, 70, 90, 100, 110].map((h, i) => (
              <div
                key={i}
                className="w-1.5 bg-blue-500 rounded-full"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Tertiary Stat B */}
        <div className="md:col-span-1 bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col justify-center text-center">
          <p className="text-3xl font-bold text-white mb-2">1M+</p>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Automated<br/>Decisions
          </p>
        </div>

        {/* Tertiary Stat C */}
        <div className="md:col-span-2 bg-slate-900 rounded-3xl p-6 border border-slate-800 flex items-center gap-4">
          <div className="size-12 text-2xl rounded-full bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 border border-slate-800 font-semibold shadow-inner">
            ★
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-none">4.9 / 5.0</p>
            <p className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-wider">
              Merchant Satisfaction
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsBento;
