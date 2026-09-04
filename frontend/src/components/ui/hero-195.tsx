import { ArrowRight, Bot, Zap, ShieldCheck, Check, Play, User, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { CloudShader } from "@/components/ui/cloud-shader";

export function Hero195() {
  return (
    <CloudShader 
      className="relative overflow-hidden bg-[#08090B] text-slate-50 pt-60 pb-24 lg:pt-48 lg:pb-32 min-h-screen border-b border-white/5"
      skyTopColor="#02040a"
      skyBottomColor="#08090B"
      cloudColor="#11131a"
      count={4}
      speed={0.3}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="container relative z-10 mx-auto px-6 max-w-7xl">
        <div className="flex flex-col items-center text-center mb-24 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-semibold tracking-widest text-slate-400 mb-8 uppercase">
            Agentic Commerce Platform
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1] text-white mb-6">
            Make your merchant ready for AI buyers.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed mb-10">
            Connect your catalog, equip your agent with revenue intelligence,
            and turn buyer intent into safe, explainable transactions.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 w-full">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 rounded-full bg-white text-black hover:bg-slate-200 font-medium gap-2">
                Create your merchant <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button size="lg" variant="outline" className="h-12 px-8 rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium gap-2">
                <Play className="w-4 h-4" /> Watch the agent work
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero Visual Box */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto relative perspective-1000">
          <BorderBeam size={400} duration={12} delay={9} colorFrom="#ffffff" colorTo="#4ade80" />
          
          {/* Left: Buyer Agent */}
          <div className="bg-[#0c0d12] border border-white/10 rounded-2xl p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden z-10">
            <div>
              <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-widest uppercase">Buyer Agent</h3>
                  <p className="text-xs text-slate-500">Claude 3.5 Sonnet</p>
                </div>
              </div>
              
              <p className="text-xl text-slate-300 font-light leading-relaxed mb-8">
                "Find me 5 AMOLED fitness watches.
                Get the best price under ₹30,000.
                Only add accessories if your
                revenue engine identifies a
                real opportunity."
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-slate-400 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                <Check className="w-4 h-4 text-emerald-400" /> Searching merchant catalog
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400 animate-fade-in" style={{ animationDelay: '1s' }}>
                <Check className="w-4 h-4 text-emerald-400" /> Checking inventory
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400 animate-fade-in" style={{ animationDelay: '1.5s' }}>
                <Check className="w-4 h-4 text-emerald-400" /> Evaluating opportunity
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400 animate-fade-in" style={{ animationDelay: '2s' }}>
                <Check className="w-4 h-4 text-emerald-400" /> Negotiating within policy
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400 animate-fade-in" style={{ animationDelay: '2.5s' }}>
                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" /> Waiting for approval
              </div>
            </div>
          </div>

          {/* Right: Live Transaction */}
          <div className="bg-[#0c0d12] border border-white/10 rounded-2xl flex flex-col shadow-2xl relative overflow-hidden z-10">
            <div className="p-8 pb-6 border-b border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-widest uppercase">Merchant Agent</h3>
                  <p className="text-xs text-slate-500">Live Transaction</p>
                </div>
              </div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-white font-medium">AMOLED Smart Fitness Watch</p>
                  <p className="text-sm text-slate-500">× 5 units</p>
                </div>
                <p className="text-white font-mono">₹29,995.00</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Revenue opportunity</span>
                  <span className="text-slate-400">No active opportunity</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Negotiation limit</span>
                  <span className="text-slate-400">10% maximum</span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 flex justify-between items-end">
                <div>
                  <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest">Approved Price</p>
                  <p className="text-2xl text-white font-mono">₹26,995.50</p>
                  <p className="text-sm text-emerald-400 font-mono">- ₹2,999.50</p>
                </div>
                <div className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest">
                  APPROVED
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-white/5 flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest font-bold">RAZORPAY</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-300">Payment</p>
                    <span className="px-2 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">CAPTURED ✓</span>
                  </div>
                </div>
                <p className="text-lg text-white font-mono">₹26,995.50</p>
              </div>
            </div>
          </div>
        </div>

        {/* System Status Bar */}
        <div className="mt-16 max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between p-4 px-8 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-mono">
          <div className="flex items-center gap-2 text-emerald-400 mb-4 sm:mb-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> LIVE SYSTEM
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-slate-400">
            <span className="flex gap-2">CATALOG <span className="text-white">9,600 READY</span></span>
            <span className="hidden md:block opacity-30">|</span>
            <span className="flex gap-2">POLICY <span className="text-white">ENFORCED</span></span>
            <span className="hidden md:block opacity-30">|</span>
            <span className="flex gap-2">PAYMENT <span className="text-white">RAZORPAY</span></span>
            <span className="hidden md:block opacity-30">|</span>
            <span className="flex gap-2">RECONCILIATION <span className="text-white">VERIFIED</span></span>
          </div>
        </div>
      </div>
    </CloudShader>
  );
}
