'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Store, ChevronLeft, ChevronRight, CheckCircle2, Shield, Activity, Settings, CreditCard, Bot, Play, Globe, Layers, DollarSign, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { id: 1, name: 'Business Info', icon: Store },
  { id: 2, name: 'Business Type', icon: Activity },
  { id: 3, name: 'Location & Currency', icon: Globe },
  { id: 4, name: 'Revenue Strategy', icon: DollarSign },
  { id: 5, name: 'Capabilities', icon: Shield },
  { id: 6, name: 'Guardrails & Policies', icon: Shield },
  { id: 7, name: 'Payment Setup', icon: CreditCard },
  { id: 8, name: 'Agent Persona', icon: Bot },
  { id: 9, name: 'Validation Check', icon: CheckCircle2 },
  { id: 10, name: 'Publish & Launch', icon: Play },
];

export default function NewWorkspaceWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    businessType: 'retail',
    region: 'IN',
    currency: 'INR',
    supportEmail: '',
    // Revenue Strategy
    primaryStrategy: 'REVENUE',
    enableCrossSell: true,
    enableUpsell: true,
    // Capabilities
    capabilities: ['catalog', 'inventory', 'negotiation', 'checkout'],
    // Guardrails
    maxDiscountPercent: '15',
    minimumMarginPercent: '20',
    maxNegotiationRounds: '3',
    // Payments
    paymentProvider: 'razorpay',
    razorpayKeyId: '',
    razorpaySecret: '',
    // Agent
    agentName: 'Commerce Agent',
    autoApproveBelow: '2000',
    humanApprovalAbove: '5000'
  });

  // Fetch draft merchant if exists
  const { data: draftData, isLoading: isLoadingDraft } = useQuery({
    queryKey: ['merchant-draft'],
    queryFn: () => api.get<{ merchant: any }>('/factory/merchants/draft'),
    retry: false
  });

  const [merchantId, setMerchantId] = useState<string | null>(null);

  useEffect(() => {
    if (draftData?.merchant) {
      setMerchantId(draftData.merchant.id);
      setFormData(prev => ({
        ...prev,
        name: draftData.merchant.name,
        description: draftData.merchant.description || '',
      }));
    }
  }, [draftData]);

  const provisionMutation = useMutation({
    mutationFn: (data: any) => api.post<{ merchantId: string }>('/factory/merchants', data),
    onSuccess: (data) => {
      setMerchantId(data.merchantId);
      queryClient.invalidateQueries({ queryKey: ['merchant-draft'] });
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      setCurrentStep(prev => prev + 1);
    }
  });

  const handleNext = async () => {
    if (currentStep === 1) {
      provisionMutation.mutate(formData);
    } else if (currentStep === STEPS.length) {
      if (merchantId) {
        await api.patch(`/factory/merchants/${merchantId}`, { status: 'ACTIVE' });
        queryClient.invalidateQueries({ queryKey: ['merchants'] });
        router.push(`/factory/merchants/${merchantId}`);
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  if (isLoadingDraft) return <div className="p-12 text-center text-zinc-500">Loading workspace wizard...</div>;

  const StepIcon = STEPS[currentStep - 1].icon;

  return (
    <div className="max-w-4xl mx-auto space-y-8 mt-6 pb-24">
      <div className="flex justify-between items-end">
        <div>
          <Link href="/factory/merchants" className="inline-flex items-center text-zinc-400 hover:text-white transition-colors mb-4 text-sm">
            <ChevronLeft size={16} className="mr-1" /> Back to Workspaces
          </Link>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center">
            <StepIcon className="mr-3 text-emerald-400" size={28} />
            Step {currentStep}: {STEPS[currentStep - 1].name}
          </h2>
        </div>
        <div className="text-sm font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          Step {currentStep} of {STEPS.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex space-x-1.5 h-2 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-white/5">
        {STEPS.map((s) => (
          <div 
            key={s.id} 
            className={`flex-1 rounded-full transition-all duration-300 ${
              s.id <= currentStep ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-zinc-800'
            }`} 
          />
        ))}
      </div>

      {/* Wizard Step Content Container */}
      <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-8 backdrop-blur-md min-h-[420px] shadow-2xl relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {/* STEP 1: BUSINESS INFO */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Basic Workspace Details</h3>
                  <p className="text-sm text-zinc-400 mb-6">Enter the primary brand name and business context for your AI merchant agent.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Workspace / Merchant Name *</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    placeholder="e.g. Acme Electronics"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Business Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    placeholder="Describe what products or services this merchant provides..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: BUSINESS TYPE */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Select Industry & Business Model</h3>
                  <p className="text-sm text-zinc-400 mb-6">This configures negotiation policies and AI agent response styles.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'retail', name: 'Retail & Physical Goods', desc: 'E-commerce, consumer products, inventory management' },
                    { id: 'digital', name: 'Digital Downloads & SaaS', desc: 'Software keys, ebooks, digital subscriptions' },
                    { id: 'services', name: 'Professional Services', desc: 'Consulting, appointments, custom quotes' },
                    { id: 'b2b', name: 'B2B Wholesale', desc: 'Bulk volume pricing, custom quotes, invoice terms' },
                  ].map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setFormData({ ...formData, businessType: item.id })}
                      className={`p-5 rounded-xl border cursor-pointer transition-all ${
                        formData.businessType === item.id 
                          ? 'border-emerald-500 bg-emerald-500/10 text-white' 
                          : 'border-white/10 bg-black/40 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">{item.name}</span>
                        {formData.businessType === item.id && <CheckCircle2 className="text-emerald-400" size={18} />}
                      </div>
                      <p className="text-xs text-zinc-400">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: LOCATION & CURRENCY */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Region & Currency Settings</h3>
                  <p className="text-sm text-zinc-400 mb-6">Define primary operating currency for Razorpay autonomous payouts.</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Primary Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="INR">INR (₹) - Indian Rupee</option>
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="GBP">GBP (£) - British Pound</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Support Contact Email</label>
                    <input 
                      type="email"
                      value={formData.supportEmail}
                      onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="support@merchant.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: REVENUE STRATEGY */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">AI Revenue Engine Strategy</h3>
                  <p className="text-sm text-zinc-400 mb-6">Choose how the AI agent optimizes pricing and upsells during customer interactions.</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'REVENUE', title: 'Maximize Revenue', desc: 'Focuses on gross merchandise volume' },
                    { id: 'MARGIN', title: 'Maximize Profit', desc: 'Strict limits on discounts to protect margin' },
                    { id: 'VOLUME', title: 'Maximize Sales Volume', desc: 'Aggressive discounts to clear inventory fast' }
                  ].map((s) => (
                    <div 
                      key={s.id}
                      onClick={() => setFormData({ ...formData, primaryStrategy: s.id })}
                      className={`p-4 rounded-xl border cursor-pointer ${
                        formData.primaryStrategy === s.id 
                          ? 'border-emerald-500 bg-emerald-500/10 text-white' 
                          : 'border-white/10 bg-black/40 text-zinc-400'
                      }`}
                    >
                      <h4 className="font-semibold text-white mb-1">{s.title}</h4>
                      <p className="text-xs text-zinc-400">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: CAPABILITIES MATRIX */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Agent Capability Matrix</h3>
                  <p className="text-sm text-zinc-400 mb-6">Enable or disable specific features available to your merchant AI.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'catalog', name: 'Catalog Search & Discovery', desc: 'Allows AI to search and suggest relevant products' },
                    { id: 'inventory', name: 'Real-Time Inventory Check', desc: 'Reserves stock temporarily during negotiation' },
                    { id: 'negotiation', name: 'Autonomous Price Negotiation', desc: 'Dynamically offers discounts within guardrails' },
                    { id: 'checkout', name: 'Instant Autonomous Checkout', desc: 'Generates instant Razorpay links for shoppers' }
                  ].map((cap) => (
                    <div 
                      key={cap.id} 
                      className="p-4 rounded-xl border border-white/10 bg-black/40 flex items-start justify-between"
                    >
                      <div>
                        <h4 className="font-medium text-white text-sm">{cap.name}</h4>
                        <p className="text-xs text-zinc-400 mt-0.5">{cap.desc}</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={formData.capabilities.includes(cap.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, capabilities: [...formData.capabilities, cap.id] });
                          } else {
                            setFormData({ ...formData, capabilities: formData.capabilities.filter(c => c !== cap.id) });
                          }
                        }}
                        className="mt-1 h-4 w-4 rounded accent-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 6: POLICIES & GUARDRAILS */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Financial Guardrails & Discount Limits</h3>
                  <p className="text-sm text-zinc-400 mb-6">Set hard limits to prevent the agent from giving unapproved discounts.</p>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Max Discount Allowed (%)</label>
                    <input 
                      type="number"
                      value={formData.maxDiscountPercent}
                      onChange={(e) => setFormData({ ...formData, maxDiscountPercent: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Minimum Profit Margin (%)</label>
                    <input 
                      type="number"
                      value={formData.minimumMarginPercent}
                      onChange={(e) => setFormData({ ...formData, minimumMarginPercent: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Max Negotiation Rounds</label>
                    <input 
                      type="number"
                      value={formData.maxNegotiationRounds}
                      onChange={(e) => setFormData({ ...formData, maxNegotiationRounds: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: PAYMENTS SETUP */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Payment Provider Integration</h3>
                  <p className="text-sm text-zinc-400 mb-6">Connect your Razorpay credentials for automated link generation.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Razorpay Key ID</label>
                    <input 
                      type="text"
                      value={formData.razorpayKeyId}
                      onChange={(e) => setFormData({ ...formData, razorpayKeyId: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none"
                      placeholder="rzp_test_..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Razorpay Key Secret</label>
                    <input 
                      type="password"
                      value={formData.razorpaySecret}
                      onChange={(e) => setFormData({ ...formData, razorpaySecret: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none"
                      placeholder="••••••••••••••••"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 8: AGENT PERSONA */}
            {currentStep === 8 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">AI Agent Persona & Thresholds</h3>
                  <p className="text-sm text-zinc-400 mb-6">Set autonomous transaction approval limits for safety.</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Agent Public Name</label>
                    <input 
                      type="text"
                      value={formData.agentName}
                      onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Auto-Approve Below ({formData.currency})</label>
                    <input 
                      type="number"
                      value={formData.autoApproveBelow}
                      onChange={(e) => setFormData({ ...formData, autoApproveBelow: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 9: VALIDATION CHECK */}
            {currentStep === 9 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Pre-Flight Configuration Audit</h3>
                  <p className="text-sm text-zinc-400 mb-6">Review configured settings before launching workspace into production.</p>
                </div>
                <div className="bg-black/50 border border-white/10 rounded-xl p-5 space-y-3 text-sm">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-zinc-400">Workspace Name</span>
                    <span className="font-semibold text-white">{formData.name || 'Untitled Workspace'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-zinc-400">Business Model</span>
                    <span className="font-semibold text-white uppercase">{formData.businessType}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-zinc-400">Currency</span>
                    <span className="font-semibold text-white">{formData.currency}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-zinc-400">Max Discount Limit</span>
                    <span className="font-semibold text-emerald-400">{formData.maxDiscountPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Agent Persona</span>
                    <span className="font-semibold text-cyan-400">{formData.agentName}</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 10: PUBLISH */}
            {currentStep === 10 && (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
                  <Play size={32} />
                </div>
                <h3 className="text-2xl text-white font-bold mb-2">Ready to Publish</h3>
                <p className="text-zinc-400 max-w-md mb-6">
                  Your merchant workspace is configured with PostgreSQL persistence. Click below to activate operations and access your control plane.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center pt-4">
        <button 
          onClick={handlePrev}
          disabled={currentStep === 1 || provisionMutation.isPending}
          className="px-6 py-3 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        <button 
          onClick={handleNext}
          disabled={provisionMutation.isPending || (currentStep === 1 && !formData.name)}
          className="flex items-center px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40"
        >
          {provisionMutation.isPending ? 'Saving to Database...' : currentStep === STEPS.length ? 'Publish & Activate Workspace' : 'Continue'}
          {!provisionMutation.isPending && currentStep < STEPS.length && <ChevronRight size={18} className="ml-2" />}
        </button>
      </div>
    </div>
  );
}
