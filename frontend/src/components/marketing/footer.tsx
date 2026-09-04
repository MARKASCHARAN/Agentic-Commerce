import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Footer() {
  return (
    <footer 
      className="relative bg-[#2563EB] text-white pt-32 pb-16 px-6 overflow-hidden"
      style={{
        backgroundImage: 'url("/api.webp")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-[#2563EB]/40 mix-blend-multiply pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1d4ed8]/80 pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        
        {/* CTA Section */}
        <div className="text-center mb-32">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-12 text-white">
            The future of commerce starts with intent.
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/login" className="inline-flex items-center justify-center h-14 px-10 bg-white text-[#08090B] hover:bg-slate-100 font-medium tracking-wide transition-all shadow-xl hover:-translate-y-0.5 text-[15px] w-full sm:w-auto">
              Build your merchant
            </Link>
            <Link href="#product" className="inline-flex items-center justify-center h-14 px-10 bg-white text-[#08090B] hover:bg-slate-100 font-medium tracking-wide transition-all shadow-xl hover:-translate-y-0.5 text-[15px] w-full sm:w-auto">
              Explore the platform
            </Link>
          </div>
        </div>

        {/* Grid Footer */}
        <div className="border-t border-l border-white/20 text-[13px] tracking-wide font-light">
          
          {/* Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-7">
            <div className="col-span-2 p-6 flex items-center gap-3 border-r border-b border-white/20 bg-white/5 backdrop-blur-sm">
              <div className="w-6 h-6 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              </div>
              <span className="text-sm font-bold tracking-[0.2em] uppercase">Agentic Commerce</span>
            </div>
            <div className="hidden md:block col-span-3 border-r border-b border-white/20 backdrop-blur-sm" />
            <Link href="#" className="col-span-1 border-r border-b border-white/20 flex items-center justify-center p-6 hover:bg-white/10 transition-colors bg-white/5 backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
            </Link>
            <Link href="#" className="col-span-1 border-r border-b border-white/20 flex items-center justify-center p-6 hover:bg-white/10 transition-colors bg-white/5 backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
            </Link>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-7">
            <div className="col-span-2 p-6 flex items-center border-r border-b border-white/20 text-white/70 backdrop-blur-sm">
              Infrastructure for AI-native merchants.
            </div>
            <Link href="#product" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">Product</Link>
            <Link href="#platform" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">Platform</Link>
            <Link href="#developers" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">Developers</Link>
            <Link href="#security" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">Security</Link>
            <Link href="#api" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">API</Link>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 md:grid-cols-7">
            <div className="col-span-2 p-6 border-r border-b border-white/20 backdrop-blur-sm hidden md:block" />
            <Link href="#privacy" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">Privacy</Link>
            <Link href="#terms" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">Terms</Link>
            <Link href="#status" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">Status</Link>
            <Link href="#blog" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">Blog</Link>
            <Link href="#careers" className="col-span-1 p-6 border-r border-b border-white/20 text-center hover:bg-white/10 transition-colors backdrop-blur-sm">Careers</Link>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-2 md:grid-cols-7">
            <div className="col-span-2 p-6 border-r border-b border-white/20 text-white/50 backdrop-blur-sm">
              San Francisco, CA
            </div>
            <div className="hidden md:block col-span-3 border-r border-b border-white/20 backdrop-blur-sm" />
            <div className="col-span-2 p-6 border-r border-b border-white/20 text-center text-white/50 backdrop-blur-sm">
              © 2026 Agentic Commerce, Inc.
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
