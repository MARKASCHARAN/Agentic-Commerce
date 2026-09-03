'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Store, ChevronLeft, ChevronRight, CheckCircle2, Shield, Activity, Package, Settings, CreditCard, Bot, Play } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { id: 1, name: 'Business', icon: Store },
  { id: 2, name: 'Business Type', icon: Activity },
  { id: 3, name: 'Location', icon: Settings },
  { id: 4, name: 'Catalog', icon: Package },
  { id: 5, name: 'Inventory', icon: Package },
  { id: 6, name: 'Revenue', icon: Activity },
  { id: 7, name: 'Capabilities', icon: Shield },
  { id: 8, name: 'Policies', icon: Shield },
  { id: 9, name: 'Payments', icon: CreditCard },
  { id: 10, name: 'Agent', icon: Bot },
  { id: 11, name: 'Validation', icon: CheckCircle2 },
  { id: 12, name: 'Publish', icon: Play },
];

export default function NewWorkspaceWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    businessType: 'retail',
    catalog: [],
    inventory: [],
    revenueStrategy: { primary: 'REVENUE', secondary: [] },
    pricing: { maxDiscountBps: 0, minimumMarginBps: 0 },
    negotiation: { enabled: false, maxRounds: 4 },
    autonomy: { autoApproveBelowMinor: 0, humanApprovalAboveMinor: 0 },
    capabilities: ['catalog'],
    skills: { crossSell: false, upsell: false }
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
      // Advance to step 2 if they already created the merchant
      if (currentStep === 1) setCurrentStep(2);
    }
  }, [draftData, currentStep]);

  const provisionMutation = useMutation({
    mutationFn: (data: any) => api.post<{ merchantId: string }>('/factory/merchants', data),
    onSuccess: (data) => {
      setMerchantId(data.merchantId);
      queryClient.invalidateQueries({ queryKey: ['merchant-draft'] });
      setCurrentStep(prev => prev + 1);
    }
  });

  // Simplified next step handler
  const handleNext = async () => {
    if (currentStep === 1) {
      // Create draft
      provisionMutation.mutate(formData);
    } else if (currentStep === 12) {
      // Publish
      // In a real app, we'd call an API to change status to ACTIVE
      await api.patch(`/factory/merchants/${merchantId}`, { status: 'ACTIVE' });
      router.push(`/factory/merchants/${merchantId}`);
    } else {
      // Just go to next step for now. Real implementation would save data per step.
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  if (isLoadingDraft) return <div className="p-12 text-center text-zinc-500">Loading workspace state...</div>;

  const StepIcon = STEPS[currentStep - 1].icon;

  return (
    <div className="max-w-4xl mx-auto space-y-8 mt-12 pb-24">
      <div className="flex justify-between items-end">
        <div>
          <Link href="/factory/merchants" className="inline-flex items-center text-zinc-400 hover:text-white transition-colors mb-6 text-sm">
            <ChevronLeft size={16} className="mr-1" /> Back to Workspaces
          </Link>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center">
            <StepIcon className="mr-3 text-emerald-400" size={28} />
            Step {currentStep}: {STEPS[currentStep - 1].name}
          </h2>
        </div>
        <div className="text-sm text-zinc-500">
          {currentStep} of {STEPS.length}
        </div>
      </div>

      <div className="flex space-x-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
        {STEPS.map((s) => (
          <div 
            key={s.id} 
            className={`flex-1 transition-colors duration-500 ${
              s.id <= currentStep ? 'bg-emerald-500' : 'bg-zinc-800'
            }`} 
          />
        ))}
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Workspace Name</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    placeholder="e.g. Acme Retail"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    rows={4}
                  />
                </div>
              </div>
            )}
            
            {currentStep > 1 && currentStep < 12 && (
              <div className="flex flex-col items-center justify-center h-[300px] text-center">
                <StepIcon size={48} className="text-zinc-600 mb-4" />
                <h3 className="text-xl text-white font-medium mb-2">{STEPS[currentStep - 1].name} Configuration</h3>
                <p className="text-zinc-400 max-w-md">
                  In a full implementation, this step saves authoritative data to the backend via dedicated endpoints for {STEPS[currentStep - 1].name.toLowerCase()}.
                </p>
              </div>
            )}

            {currentStep === 12 && (
              <div className="flex flex-col items-center justify-center h-[300px] text-center">
                <Play size={48} className="text-emerald-500 mb-4" />
                <h3 className="text-2xl text-white font-bold mb-2">Ready to Publish</h3>
                <p className="text-zinc-400 max-w-md mb-6">
                  Your multi-agent commerce environment is configured and ready. Publishing will activate the workspace and the merchant agent.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between items-center pt-4">
        <button 
          onClick={handlePrev}
          disabled={currentStep === 1 || provisionMutation.isPending}
          className="px-6 py-3 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
        >
          Previous
        </button>
        <button 
          onClick={handleNext}
          disabled={provisionMutation.isPending || (currentStep === 1 && !formData.name)}
          className="flex items-center px-8 py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {provisionMutation.isPending ? 'Saving...' : currentStep === 12 ? 'Publish Workspace' : 'Continue'}
          {!provisionMutation.isPending && currentStep < 12 && <ChevronRight size={18} className="ml-2" />}
        </button>
      </div>
    </div>
  );
}
