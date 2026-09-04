import dynamic from 'next/dynamic';
import { Navbar } from '@/components/marketing/navbar';
import { HeroSection } from '@/components/marketing/hero-section';
import { RevenueFlow } from '@/components/marketing/revenue-flow';
import { FeaturesTabs } from '@/components/marketing/features-tabs';
import { BentoFeatures } from '@/components/marketing/bento-features';
import { GradientCta } from '@/components/marketing/gradient-cta';
import { Footer } from '@/components/marketing/footer';

// Lazy load below-the-fold sections for performance
const ProblemSection = dynamic(() => import('@/components/marketing/problem-section').then(mod => mod.ProblemSection), { ssr: true });

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F3F2EC] text-[#08090B] font-sans selection:bg-[#D9FC50] selection:text-[#08090B] overflow-x-hidden">
      <Navbar />
      <HeroSection />

      {/* Revenue Equation Section */}
      <RevenueFlow />

      {/* Problem context */}
      <ProblemSection />

      {/* Refold AI style interactive 3-step section */}
      <FeaturesTabs />

      {/* Highnote style Bento Grid Deep Dive */}
      <BentoFeatures />

      {/* Vibrant Gradient CTA */}
      <GradientCta />

      <Footer />
    </div>
  );
}
