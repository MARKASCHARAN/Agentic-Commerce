'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useUIStore } from '@/stores/ui-store';
import { Eye, CreditCard, Check, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useUIStore((state) => state.setUser);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response: any = await api.post('/auth/signup', { name, email, password });
      const { user } = response.data;
      
      setUser(user);
      
      router.push('/factory');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full font-sans bg-white">
      
      {/* Left Column - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-24">
        <div className="w-full max-w-[400px]">
          
          <div className="mb-10 text-center flex flex-col items-center">
            <Link href="/" className="inline-flex items-center gap-2 mb-8">
              {/* Agentic Commerce Logo */}
              <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 15L20 85H40L50 60L60 85H80L50 15Z" fill="url(#paint0_linear)" />
                <path d="M50 60L20 85H40L50 60Z" fill="#1e3a8a" />
                <path d="M50 60L80 85H60L50 60Z" fill="#2563EB" />
                <defs>
                  <linearGradient id="paint0_linear" x1="50" y1="15" x2="50" y2="85" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#67e8f9" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
            </Link>
            
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Create an account</h1>
            <p className="text-sm text-slate-500">
              Already have an account? <Link href="/login" className="text-blue-600 font-semibold hover:underline">Log in</Link>
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                placeholder="Full Name"
              />
            </div>

            <div>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                placeholder="Email address"
              />
            </div>
            
            <div className="relative">
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 pr-10 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                placeholder="Password"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <Eye className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                I agree to the Terms of Service
              </label>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#2563EB] text-white font-semibold py-3 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-sm shadow-sm"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold">OR</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>
            
            <button 
              type="button" 
              className="w-full bg-white text-blue-600 font-semibold py-3 rounded-full hover:bg-slate-50 transition-colors mt-2 text-sm text-center border-none"
            >
              Sign up with SSO
            </button>
          </form>
        </div>
      </div>
      
      {/* Right Column - Brand Context */}
      <div 
        className="hidden lg:flex w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(0, 38, 209, 1) 0%, rgba(87, 145, 199, 1) 100%)' }}
      >
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:40px_40px]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-10 w-full max-w-sm flex flex-col gap-6"
        >
          {/* Agentic Commerce context card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
            <h3 className="text-white font-serif text-2xl mb-2 tracking-tight">Agentic Commerce</h3>
            <p className="text-white/80 text-sm leading-relaxed mb-8">
              Your autonomous sales infrastructure. Turn buyer intent into real revenue, while deterministic policies and cryptographic reconciliation keep you completely in control.
            </p>
            
            <div className="bg-[#02041A] rounded-xl shadow-2xl p-6 w-full text-white text-center border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-[#3395FF]/10 blur-3xl pointer-events-none" />
              
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 text-[#3395FF] mx-auto mb-3 relative z-10 fill-current">
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
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4 text-white/90 relative z-10">Razorpay Payment</h4>
              
              <div className="inline-flex items-center justify-center bg-white/5 border border-white/10 px-6 py-2 rounded-full mb-4 shadow-inner relative z-10">
                <span className="font-mono font-bold text-xl tracking-tight text-white">₹30,000</span>
              </div>
              
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#00E5FF] uppercase tracking-widest relative z-10">
                <Check className="w-3 h-3" /> Captured
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-white/60 text-xs px-2 font-mono">
            <span>Powered by Refold AI</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>
      </div>

    </div>
  );
}
