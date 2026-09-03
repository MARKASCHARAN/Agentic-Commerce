import Link from 'next/link';
import { ArrowRight, Bot, Target, ShieldCheck, Zap, CreditCard, ChevronRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Agentic Commerce</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="#how-it-works" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">How it works</Link>
          <Link href="#revenue" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Revenue Engine</Link>
          <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Log in</Link>
          <Link 
            href="/login" 
            className="px-4 py-2 rounded-full bg-white text-slate-950 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-32 px-6 max-w-7xl mx-auto text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-sm text-slate-300 mb-8">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            The agentic economy is here
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent max-w-4xl mx-auto">
            Turn your store into an <br className="hidden md:block" /> AI-native business.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Your store shouldn't wait for customers to browse it. Let AI buyers discover, evaluate, negotiate, and purchase from your business autonomously.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(37,99,235,0.4)]"
            >
              Create Merchant Agent <ArrowRight size={18} />
            </Link>
            <Link 
              href="#how-it-works" 
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-slate-900 border border-slate-800 text-white font-medium hover:bg-slate-800 transition-all flex items-center justify-center"
            >
              Explore the platform
            </Link>
          </div>
        </div>

        {/* The Agentic Loop Visual */}
        <div className="mt-24 relative max-w-4xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/0 via-slate-950/50 to-slate-950 pointer-events-none z-10" />
          <div className="flex flex-col items-center gap-4 text-sm font-mono text-slate-400">
            <div className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 shadow-xl">🤖 AI Buyer</div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="px-4 py-2 rounded-lg bg-blue-900/30 border border-blue-500/30 text-blue-400 shadow-xl">Discover</div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 shadow-xl">🏪 Merchant Agent</div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="px-4 py-2 rounded-lg bg-indigo-900/30 border border-indigo-500/30 text-indigo-400 shadow-xl">Revenue Intelligence</div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="px-4 py-2 rounded-lg bg-purple-900/30 border border-purple-500/30 text-purple-400 shadow-xl">Negotiation</div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="px-4 py-2 rounded-lg bg-amber-900/30 border border-amber-500/30 text-amber-400 shadow-xl">Human Approval</div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="px-4 py-2 rounded-lg bg-emerald-900/30 border border-emerald-500/30 text-emerald-400 shadow-xl">Payment & Revenue</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 border-t border-slate-900 bg-slate-950/50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">How it works</h2>
            <p className="text-slate-400">Five simple steps to join the agentic economy.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {[
              { num: '01', title: 'Connect', desc: 'Register your business on the platform.' },
              { num: '02', title: 'Import', desc: 'Sync your product catalog and inventory.' },
              { num: '03', title: 'Configure', desc: 'Set your margin rules and revenue goals.' },
              { num: '04', title: 'Deploy', desc: 'Provision your dedicated merchant agent.' },
              { num: '05', title: 'Transact', desc: 'Let AI buyers discover and purchase.' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-2xl font-black text-slate-700 mb-4">{step.num}</span>
                <h3 className="text-lg font-bold text-slate-200 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Revenue Intelligence */}
      <section id="revenue" className="py-24 px-6 border-t border-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/30 border border-indigo-500/30 text-indigo-400 text-sm mb-6">
              <Target size={16} /> Revenue Intelligence
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              AI can sell.<br/>You control the economics.
            </h2>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              Your merchant agent doesn't just answer questions—it actively optimizes for revenue based on your exact business goals.
            </p>
            <ul className="space-y-4">
              {['Cross-sell & Upsell', 'Dynamic Bundling', 'Plan Upgrades', 'Conversion Optimization'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-300 font-medium">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <ChevronRight size={14} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 rounded-3xl blur-3xl" />
            <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">Merchant Control Plane</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <span className="text-slate-300">Maximum Discount</span>
                  <span className="font-mono text-emerald-400">5%</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <span className="text-slate-300">Minimum Margin</span>
                  <span className="font-mono text-emerald-400">20%</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <span className="text-slate-300">AI Negotiation</span>
                  <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">ON</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Human Payment Approval</span>
                  <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-bold">REQUIRED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Flow */}
      <section className="py-24 px-6 border-t border-slate-900 bg-slate-950/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/30 text-emerald-400 text-sm mb-6">
            <CreditCard size={16} /> Seamless Checkout
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-16">Deterministic settlement</h2>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-left">
            <div className="flex-1 bg-slate-900 p-6 rounded-2xl border border-slate-800 relative z-10">
              <ShieldCheck className="text-blue-400 mb-4" size={32} />
              <h3 className="font-bold text-lg mb-2">1. Policy Evaluates</h3>
              <p className="text-sm text-slate-400">The LLM proposes an offer, but the deterministic engine ensures it strictly meets your margin rules.</p>
            </div>
            <div className="hidden md:block w-8 h-px bg-slate-800" />
            <div className="flex-1 bg-slate-900 p-6 rounded-2xl border border-slate-800 relative z-10">
              <Zap className="text-amber-400 mb-4" size={32} />
              <h3 className="font-bold text-lg mb-2">2. Razorpay Link</h3>
              <p className="text-sm text-slate-400">Once approved, a secure Razorpay payment intent is generated automatically.</p>
            </div>
            <div className="hidden md:block w-8 h-px bg-slate-800" />
            <div className="flex-1 bg-slate-900 p-6 rounded-2xl border border-slate-800 relative z-10">
              <CheckCircle className="text-emerald-400 mb-4" size={32} />
              <h3 className="font-bold text-lg mb-2">3. Reconciliation</h3>
              <p className="text-sm text-slate-400">Webhooks listen for the capture and seamlessly reconcile the order in your control plane.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 border-t border-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
            Make your business ready for the agentic economy.
          </h2>
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all shadow-[0_0_40px_rgba(37,99,235,0.4)]"
          >
            Create your Merchant Agent <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-900 text-center text-slate-500 text-sm">
        <p>© 2026 Agentic Commerce. Powered by Razorpay & MCP.</p>
      </footer>
    </div>
  );
}

function CheckCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
