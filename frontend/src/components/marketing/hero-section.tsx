import { ArrowRight, ArrowDown, Play, Check, TrendingUp, Sparkles, ShieldCheck, CreditCard, ShoppingCart, Bot } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative min-h-screen bg-[#F3F2EC] text-[#08090B] pt-40 pb-24 overflow-hidden flex flex-col items-center justify-start font-sans">

      <div className="container relative z-10 mx-auto px-6 max-w-5xl text-center">

        {/* Eyebrow */}
        <div className="inline-flex items-center justify-center mb-8">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#5A6376] uppercase">
            Agentic Commerce Infrastructure
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-[76px] font-medium tracking-tight leading-[1.05] text-[#08090B] mb-8 font-serif" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          AI has the buyer.<br />
          Merchants need the agent.
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-12 font-sans font-light">
          Turn AI buyer intent into more merchant revenue — with an agent that discovers products, grows the basket, negotiates within merchant policy, and converts intent into Razorpay payments.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">
          <Link href="/login" className="inline-flex items-center h-14 bg-[#18191B] text-white hover:bg-black transition-all font-mono text-[11px] font-bold tracking-[0.1em] uppercase pr-6 rounded-sm shadow-xl hover:-translate-y-0.5">
            <span className="h-full w-14 text-white flex items-center justify-center mr-6 border-r border-[#18191B] rounded-l-sm" style={{ background: 'linear-gradient(90deg, rgba(0, 38, 209, 1) 0%, rgba(87, 145, 199, 1) 50%, rgba(255, 255, 255, 1) 100%)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 fill-current">
                <path d="M30.48 9.14h-1.53V6.09h-1.52V4.57h-1.52V3.05h-3.05V1.52h-3.05V0h-7.62v1.52H9.14v1.53H6.1v1.52H4.57v1.52H3.05v3.05H1.52v3.05H0v7.62h1.52v3.05h1.53v3.04h1.52v1.53H6.1v1.52h3.04v1.53h3.05V32h7.62v-1.52h3.05v-1.53h3.05v-1.52h1.52V25.9h1.52v-3.04h1.53v-3.05H32v-7.62h-1.52Zm-4.57 6.1h-1.53v1.52h-1.52v1.53h-1.53v1.52h-1.52v1.52h-1.52v-3.04h-6.1v1.52h-1.52v1.52h1.52v1.53h1.52v1.52H9.14v-1.52H7.62v-1.53H6.1v-7.62h1.52v-1.52h1.52v-1.52h9.15V7.62h1.52v1.52h1.52v1.53h1.53v1.52h1.52v1.52h1.53Z" />
              </svg>
            </span>
            Build a merchant
          </Link>

          <Link href="#demo" className="inline-flex items-center h-14 bg-white text-[#08090B] border border-black/10 hover:bg-slate-50 transition-all font-mono text-[11px] font-bold tracking-[0.1em] uppercase px-8 rounded-sm shadow-sm hover:-translate-y-0.5 gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-4 h-4 fill-current">
              <path d="M30.47 9.14h-1.52V6.09h-1.53V4.57H25.9V3.05h-3.05V1.52h-3.04V0h-7.62v1.52H9.14v1.53H6.09v1.52H4.57v1.52H3.04v3.05H1.52v3.05H0v7.62h1.52v3.05h1.52v3.04h1.53v1.53h1.52v1.52h3.05v1.53h3.05V32h7.62v-1.52h3.04v-1.53h3.05v-1.52h1.52V25.9h1.53v-3.04h1.52v-3.05H32v-7.62h-1.53Zm-7.62 7.62h-1.52v1.53h-1.52v1.52h-1.53v1.52h-1.52v1.53h-3.05v1.52h-1.52V7.62h1.52v1.52h3.05v1.53h1.52v1.52h1.53v1.52h1.52v1.53h1.52Z" />
            </svg> See it in action
          </Link>
        </div>
      </div>

      {/* Vertical Flow Visual */}
      <div className="w-full max-w-3xl mx-auto px-6 mb-32 flex flex-col items-center relative z-10">

        {/* Connection Line */}
        <div className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent -z-10" />

        {/* AI BUYER */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xl shadow-black/5 p-6 w-full max-w-lg mb-8 transform hover:-translate-y-1 transition-transform relative">
          <div className="flex items-center gap-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 text-slate-500 fill-current">
              <g>
                <path d="M30.47 10.67H32v4.57h-1.53Z" />
                <path d="M28.95 15.24h1.52v4.57h-1.52Z" />
                <path d="M27.43 19.81h1.52v3.05h-1.52Z" />
                <path d="M25.9 13.72h1.53v4.57H25.9Z" />
                <path d="M12.19 22.86h15.24v1.52H12.19Z" />
                <path d="M24.38 18.29h1.52v3.04h-1.52Z" />
                <path d="M19.81 13.72h1.52v7.61h-1.52Z" />
                <path d="M15.23 18.29h1.53v3.04h-1.53Z" />
                <path d="M13.71 13.72h1.52v4.57h-1.52Z" />
                <path d="m12.19 28.95 0 1.53 1.52 0 0 1.52 3.05 0 0 -1.52 1.52 0 0 -1.53 3.05 0 0 1.53 1.52 0 0 1.52 3.05 0 0 -1.52 1.53 0 0 -1.53 3.04 0 0 -1.52 -4.57 0 0 -1.52 -3.05 0 0 1.52 -6.09 0 0 -1.52 -3.05 0 0 1.52 -3.05 0 0 1.52 1.53 0z" />
                <path d="M10.66 24.38h1.53v1.53h-1.53Z" />
                <path d="M10.66 18.29h1.53v4.57h-1.53Z" />
                <path d="M9.14 25.91h1.52v1.52H9.14Z" />
                <path d="M9.14 13.72h1.52v4.57H9.14Z" />
                <path d="m9.14 13.72 0 -3.05 21.33 0 0 -1.53 -22.85 0 0 4.58 1.52 0z" />
                <path d="M6.09 6.1h1.53v3.04H6.09Z" />
                <path d="M4.57 3.05h1.52V6.1H4.57Z" />
                <path d="M3.04 1.52h1.53v1.53H3.04Z" />
                <path d="M0 0h3.04v1.52H0Z" />
              </g>
            </svg>
            <h3 className="text-xs font-bold tracking-[0.15em] text-[#08090B] uppercase">AI Buyer</h3>
          </div>
          <div className="bg-slate-50 p-4 rounded text-sm text-slate-700 font-serif italic border border-slate-100 flex items-center justify-center text-center">
            "Find me 5 premium fitness watches under ₹30,000."
          </div>
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 text-slate-300 mb-8 bg-[#F3F2EC] fill-current rotate-90">
          <path d="M30.48 9.14h-1.53V6.09h-1.52V4.57h-1.52V3.05h-3.05V1.52h-3.05V0h-7.62v1.52H9.14v1.53H6.1v1.52H4.57v1.52H3.05v3.05H1.52v3.05H0v7.62h1.52v3.05h1.53v3.04h1.52v1.53H6.1v1.52h3.04v1.53h3.05V32h7.62v-1.52h3.05v-1.53h3.05v-1.52h1.52V25.9h1.52v-3.04h1.53v-3.05H32v-7.62h-1.52Zm-4.57 6.1h-1.53v1.52h-1.52v1.53h-1.53v1.52h-1.52v1.52h-1.52v-3.04h-6.1v1.52h-1.52v1.52h1.52v1.53h1.52v1.52H9.14v-1.52H7.62v-1.53H6.1v-7.62h1.52v-1.52h1.52v-1.52h9.15V7.62h1.52v1.52h1.52v1.53h1.53v1.52h1.52v1.52h1.53Z" />
        </svg>

        {/* MERCHANT AGENT */}
        <div className="bg-[#18191B] rounded-lg border border-[#2B2D31] shadow-2xl p-6 w-full max-w-lg mb-8 text-white relative">
          <div className="absolute inset-0 bg-blue-500/5 blur-[30px] pointer-events-none" />
          <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-3.5 h-3.5 text-white fill-current">
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
              <h3 className="text-xs font-bold tracking-[0.15em] text-white uppercase">Merchant Agent</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Understand Intent</span>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-4 font-mono text-sm text-slate-300 flex justify-between items-center">
            <span>5 × AMOLED Smart Fitness Watch</span>
            <span className="font-bold text-white">₹29,995</span>
          </div>
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 text-slate-300 mb-8 bg-[#F3F2EC] fill-current rotate-90">
          <path d="M30.48 9.14h-1.53V6.09h-1.52V4.57h-1.52V3.05h-3.05V1.52h-3.05V0h-7.62v1.52H9.14v1.53H6.1v1.52H4.57v1.52H3.05v3.05H1.52v3.05H0v7.62h1.52v3.05h1.53v3.04h1.52v1.53H6.1v1.52h3.04v1.53h3.05V32h7.62v-1.52h3.05v-1.53h3.05v-1.52h1.52V25.9h1.52v-3.04h1.53v-3.05H32v-7.62h-1.52Zm-4.57 6.1h-1.53v1.52h-1.52v1.53h-1.53v1.52h-1.52v1.52h-1.52v-3.04h-6.1v1.52h-1.52v1.52h1.52v1.53h1.52v1.52H9.14v-1.52H7.62v-1.53H6.1v-7.62h1.52v-1.52h1.52v-1.52h9.15V7.62h1.52v1.52h1.52v1.53h1.53v1.52h1.52v1.52h1.53Z" />
        </svg>

        {/* REVENUE ENGINE */}
        <div className="bg-white rounded-lg border-2 border-[#0026d1] shadow-xl shadow-[#0026d1]/10 p-6 w-full max-w-lg mb-8 relative">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 text-[#0026d1] fill-current">
                <g>
                  <path d="m30.48 21.34 -1.52 0 0 1.52 1.52 0 0 1.52 1.52 0 0 -4.57 -1.52 0 0 1.53z" />
                  <path d="M28.96 24.38h1.52v1.53h-1.52Z" />
                  <path d="M28.96 18.29h1.52v1.52h-1.52Z" />
                  <path d="M22.86 22.86h6.1v1.52h-6.1Z" />
                  <path d="M22.86 16.76h6.1v1.53h-6.1Z" />
                  <path d="M22.86 25.91h6.1v1.52h-6.1Z" />
                  <path d="M21.34 18.29h1.52v1.52h-1.52Z" />
                  <path d="m19.81 22.86 -1.52 0 0 1.52 1.52 0 0 1.53 -1.52 0 0 1.52 1.52 0 0 1.52 1.53 0 0 -7.61 -1.53 0 0 1.52z" />
                  <path d="M18.29 28.95h1.52v1.53h-1.52Z" />
                  <path d="M18.29 19.81h1.52v1.53h-1.52Z" />
                  <path d="M10.67 30.48h7.62V32h-7.62Z" />
                  <path d="M10.67 27.43h7.62v1.52h-7.62Z" />
                  <path d="M10.67 24.38h7.62v1.53h-7.62Z" />
                  <path d="M10.67 18.29h7.62v1.52h-7.62Z" />
                  <path d="m10.67 15.24 0 1.52 3.05 0 0 -3.04 -1.53 0 0 1.52 -1.52 0z" />
                  <path d="M10.67 12.19h1.52v1.53h-1.52Z" />
                  <path d="M9.15 28.95h1.52v1.53H9.15Z" />
                  <path d="m10.67 27.43 0 -1.52 -1.52 0 0 -1.53 1.52 0 0 -1.52 -1.52 0 0 -1.52 -1.53 0 0 7.61 1.53 0 0 -1.52 1.52 0z" />
                  <path d="M9.15 19.81h1.52v1.53H9.15Z" />
                  <path d="M3.05 16.76h7.62v1.53H3.05Z" />
                  <path d="m28.96 9.14 0 -9.14 -9.15 0 0 1.53 1.53 0 0 1.52 1.52 0 0 1.52 -1.52 0 0 1.53 -3.05 0 0 -1.53 -1.52 0 0 -1.52 -1.53 0 0 -1.52 -3.05 0 0 1.52 -1.52 0 0 1.52 -1.52 0 0 1.53 -1.53 0 0 1.52 -1.52 0 0 1.52 3.05 0 0 -1.52 1.52 0 0 -1.52 1.52 0 0 -1.53 3.05 0 0 1.53 1.53 0 0 1.52 1.52 0 0 1.52 3.05 0 0 -1.52 1.52 0 0 -1.52 3.05 0 0 1.52 1.52 0 0 1.52 1.53 0z" />
                  <path d="M3.05 10.67h7.62v1.52H3.05Z" />
                  <path d="M3.05 27.43H6.1v1.52H3.05Z" />
                  <path d="M3.05 22.86H6.1v1.52H3.05Z" />
                  <path d="M3.05 19.81H6.1v1.53H3.05Z" />
                  <path d="M1.53 25.91h1.52v1.52H1.53Z" />
                  <path d="M1.53 12.19h1.52v1.53H1.53Z" />
                  <path d="m1.53 16.76 1.52 0 0 -1.52 -1.52 0 0 -1.52 -1.53 0 0 12.19 1.53 0 0 -3.05 1.52 0 0 -1.52 -1.52 0 0 -1.53 1.52 0 0 -1.52 -1.52 0 0 -1.53z" />
                </g>
              </svg>
              <h3 className="text-xs font-bold tracking-[0.15em] text-[#08090B] uppercase">Revenue Engine</h3>
            </div>
            <span className="bg-[#0026d1]/10 text-[#0026d1] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Opportunity</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 p-3 rounded border border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cross-Sell</p>
              <p className="text-xs font-medium text-slate-700">65W Fast Charger</p>
            </div>
            <div className="bg-slate-50 p-3 rounded border border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Confidence</p>
              <p className="text-xs font-bold text-emerald-600">80%</p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded mb-4">
            <span className="text-xs font-medium text-emerald-800">Potential basket uplift</span>
            <span className="text-sm font-bold text-emerald-700">+₹2,499</span>
          </div>

          <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Cart Value</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 line-through">₹29,995</span>
              <ArrowRight className="w-3 h-3 text-slate-300" />
              <span className="text-sm font-mono font-bold text-[#08090B]">₹32,494</span>
            </div>
          </div>
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 text-slate-300 mb-8 bg-[#F3F2EC] fill-current rotate-90">
          <path d="M30.48 9.14h-1.53V6.09h-1.52V4.57h-1.52V3.05h-3.05V1.52h-3.05V0h-7.62v1.52H9.14v1.53H6.1v1.52H4.57v1.52H3.05v3.05H1.52v3.05H0v7.62h1.52v3.05h1.53v3.04h1.52v1.53H6.1v1.52h3.04v1.53h3.05V32h7.62v-1.52h3.05v-1.53h3.05v-1.52h1.52V25.9h1.52v-3.04h1.53v-3.05H32v-7.62h-1.52Zm-4.57 6.1h-1.53v1.52h-1.52v1.53h-1.53v1.52h-1.52v1.52h-1.52v-3.04h-6.1v1.52h-1.52v1.52h1.52v1.53h1.52v1.52H9.14v-1.52H7.62v-1.53H6.1v-7.62h1.52v-1.52h1.52v-1.52h9.15V7.62h1.52v1.52h1.52v1.53h1.53v1.52h1.52v1.52h1.53Z" />
        </svg>

        {/* NEGOTIATION & POLICY */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xl shadow-black/5 p-6 w-full max-w-lg mb-8 relative">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 text-blue-600 fill-current">
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
              <h3 className="text-xs font-bold tracking-[0.15em] text-[#08090B] uppercase">Merchant Policy</h3>
            </div>
          </div>

          <div className="flex justify-between text-xs text-slate-600 mb-2 font-mono">
            <span>Maximum discount</span>
            <span>10%</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600 mb-6 font-mono">
            <span>Minimum margin</span>
            <span className="text-emerald-600">protected</span>
          </div>

          <div className="bg-slate-50 p-4 rounded border border-slate-100 space-y-3">
            <div className="flex justify-between text-xs items-center">
              <span className="text-slate-500">Customer offer</span>
              <span className="font-mono text-slate-700">₹32,494</span>
            </div>
            <div className="flex justify-between text-xs items-center font-bold">
              <span className="text-[#08090B]">Merchant counter</span>
              <span className="font-mono text-emerald-600">₹30,000</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest justify-center">
            <Check className="w-3 h-3" /> Within policy
          </div>
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 text-slate-300 mb-8 bg-[#F3F2EC] fill-current rotate-90">
          <path d="M30.48 9.14h-1.53V6.09h-1.52V4.57h-1.52V3.05h-3.05V1.52h-3.05V0h-7.62v1.52H9.14v1.53H6.1v1.52H4.57v1.52H3.05v3.05H1.52v3.05H0v7.62h1.52v3.05h1.53v3.04h1.52v1.53H6.1v1.52h3.04v1.53h3.05V32h7.62v-1.52h3.05v-1.53h3.05v-1.52h1.52V25.9h1.52v-3.04h1.53v-3.05H32v-7.62h-1.52Zm-4.57 6.1h-1.53v1.52h-1.52v1.53h-1.53v1.52h-1.52v1.52h-1.52v-3.04h-6.1v1.52h-1.52v1.52h1.52v1.53h1.52v1.52H9.14v-1.52H7.62v-1.53H6.1v-7.62h1.52v-1.52h1.52v-1.52h9.15V7.62h1.52v1.52h1.52v1.53h1.53v1.52h1.52v1.52h1.53Z" />
        </svg>

        {/* RAZORPAY */}
        <div
          className="rounded-lg shadow-2xl p-6 w-full max-w-lg text-white text-center transform hover:-translate-y-1 transition-transform"
          style={{ background: 'linear-gradient(90deg, rgba(0, 38, 209, 1) 0%, rgba(87, 145, 199, 1) 50%, rgba(255, 255, 255, 1) 100%)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-6 h-6 text-white mx-auto mb-3 fill-current">
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
          <h3 className="text-xs font-bold tracking-[0.15em] uppercase mb-4 text-white drop-shadow-md">Razorpay Payment</h3>
          <div className="inline-flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full mb-3 backdrop-blur-sm border border-white/20">
            <span className="font-mono font-bold text-xl drop-shadow-md">₹30,000</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-md">
            <Check className="w-3 h-3" /> Captured
          </div>
        </div>

      </div>

    </section>
  );
}
