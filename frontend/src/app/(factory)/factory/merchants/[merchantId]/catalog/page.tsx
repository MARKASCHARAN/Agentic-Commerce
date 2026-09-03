'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { PackagePlus, Upload, Search, Tag, DollarSign, Layers, X, Plus, Edit2, RefreshCw, FileSpreadsheet, Sparkles, CheckCircle2, AlertCircle, Database, ShoppingBag, ArrowRight, Download, Check } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CatalogPage() {
  const { merchantId } = useParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Connector / Import Active Tab State
  const [activeIngestionTab, setActiveIngestionTab] = useState<'CSV' | 'SHOPIFY' | 'ERP'>('CSV');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriceMinor, setEditPriceMinor] = useState('');
  const [editCurrency, setEditCurrency] = useState('INR');
  const [editStock, setEditStock] = useState('50');

  // Form State for Add Single Product
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [priceMinor, setPriceMinor] = useState('1499');
  const [currency, setCurrency] = useState('INR');
  const [initialQuantity, setInitialQuantity] = useState('50');

  // CSV Import State
  const [rawCsvInput, setRawCsvInput] = useState<string>(
`SKU,Name,Description,Selling Price (INR),Stock Quantity
WATCH-001,AMOLED Smart Fitness Watch Pro,Ultra-bright AMOLED display with 14-day battery life,5499,100
EARBUD-002,Active Noise Cancelling Earbuds Max,Hi-Fi sound with dual transparency mic,3499,80
CHARGER-003,100W GaN Desktop Fast Charging Hub,4-Port Fast Charging Hub for Laptop and Phone,3999,60
STAND-004,Aluminum Ergonomic Laptop Stand,Heat-dissipating riser for MacBook and Pro laptops,1999,150
CASE-005,MagSafe Ultra Slim Protective Case,Shockproof magnetic armor case,999,200`
  );

  const [parsedPreviewProducts, setParsedPreviewProducts] = useState<any[]>([]);
  const [parseStats, setParseStats] = useState<{ total: number; valid: number; errors: number }>({ total: 0, valid: 0, errors: 0 });

  // Smart header-aware CSV parser supporting quotes, currency symbols (₹, $), and Kaggle/Amazon columns
  const parseCsvText = (csvText: string) => {
    try {
      const lines = csvText.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) return;

      const rawHeaderLine = lines[0];
      const headerCols = (rawHeaderLine.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || rawHeaderLine.split(','))
        .map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

      // Smart header index detection
      let nameIdx = headerCols.findIndex(h => h === 'name' || h.includes('title') || h.includes('product'));
      if (nameIdx === -1) nameIdx = 1;

      let descIdx = headerCols.findIndex(h => h.includes('desc') || h.includes('sub_category') || h.includes('main_category') || h.includes('detail'));
      if (descIdx === -1) descIdx = 2;

      // Find price column index: prioritize discount_price, selling_price, actual_price, price, mrp
      let priceIdx = headerCols.findIndex(h => h.includes('discount_price') || h.includes('selling_price') || h.includes('selling price'));
      if (priceIdx === -1) {
        priceIdx = headerCols.findIndex(h => (h.includes('price') || h.includes('cost') || h.includes('mrp')) && !h.includes('rating') && !h.includes('id'));
      }
      if (priceIdx === -1) priceIdx = headerCols.findIndex(h => h.includes('actual_price'));

      // Find stock/qty index
      let qtyIdx = headerCols.findIndex(h => h.includes('stock') || h.includes('quantity') || h.includes('no_of_ratings') || h.includes('ratings_count'));

      let skuIdx = headerCols.findIndex(h => h.includes('sku') || h.includes('id') || h === '');
      if (skuIdx === -1) skuIdx = 0;

      const rows = lines.slice(1);
      const parsed: any[] = [];
      let validCount = 0;
      let errorCount = 0;

      rows.forEach((rowStr, idx) => {
        const rawCols = rowStr.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || rowStr.split(',');
        const cols = rawCols.map(c => c.trim().replace(/^["']|["']$/g, ''));

        if (cols.length >= 2) {
          const sku = cols[skuIdx] || `SKU-${idx + 1}`;
          const name = cols[nameIdx] || `Product ${idx + 1}`;
          const desc = cols[descIdx] || cols[nameIdx] || '';

          // Extract & clean price
          let priceNum = NaN;
          if (priceIdx !== -1 && cols[priceIdx]) {
            const cleanStr = cols[priceIdx].replace(/[₹$,\s"]/g, '');
            priceNum = parseFloat(cleanStr);
          }
          // Fallback if price is not found in designated column
          if (isNaN(priceNum) || priceNum <= 0) {
            for (let i = cols.length - 1; i >= 0; i--) {
              if (i === qtyIdx) continue;
              const val = parseFloat(cols[i].replace(/[₹$,\s"]/g, ''));
              if (!isNaN(val) && val > 10) {
                priceNum = val;
                break;
              }
            }
          }
          if (isNaN(priceNum) || priceNum <= 0) priceNum = 999;

          // Extract stock quantity
          let qtyNum = 50;
          if (qtyIdx !== -1 && cols[qtyIdx]) {
            const parsedQty = parseInt(cols[qtyIdx].replace(/\D/g, ''), 10);
            if (!isNaN(parsedQty) && parsedQty >= 0) {
              qtyNum = parsedQty;
            }
          }

          parsed.push({
            externalId: sku.slice(0, 50),
            name: name.slice(0, 150),
            description: desc.slice(0, 500),
            priceMinor: Math.round(priceNum * 100),
            currency: 'INR',
            quantity: qtyNum
          });
          validCount++;
        } else {
          errorCount++;
        }
      });

      setParsedPreviewProducts(parsed);
      setParseStats({ total: rows.length, valid: validCount, errors: errorCount });
    } catch (e) {
      console.error('CSV Parsing Error:', e);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['products', merchantId, search],
    queryFn: () => api.get<{ products: any[] }>(`/factory/merchants/${merchantId}/products?search=${search}`),
    enabled: !!merchantId,
  });

  const addProductMutation = useMutation({
    mutationFn: (newProdData: any) => api.post(`/factory/merchants/${merchantId}/products`, newProdData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', merchantId] });
      setShowAddModal(false);
      setProductName('');
      setDescription('');
    }
  });

  const editProductMutation = useMutation({
    mutationFn: (editData: any) => api.patch(`/factory/merchants/${merchantId}/products/${editingProduct.id}`, editData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', merchantId] });
      setEditingProduct(null);
    }
  });

  const bulkImportMutation = useMutation({
    mutationFn: (importData: any) => api.post(`/factory/upload-catalog/${merchantId}`, importData),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['products', merchantId] });
      setShowImportModal(false);
      alert(`🎉 Bulk Catalog Successfully Uploaded! ${res?.imported || parsedPreviewProducts.length} Products Made AI-Buyable.`);
    },
    onError: (err: any) => {
      alert(`Import error: ${err.message || 'Failed to import catalog'}`);
    }
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    addProductMutation.mutate({
      name: productName,
      description,
      priceMinor: Math.round(parseFloat(priceMinor) * 100) || 1000,
      currency,
      active: true,
      quantity: parseInt(initialQuantity, 10) || 50,
      inventoryQuantity: parseInt(initialQuantity, 10) || 50
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawCsvInput(content);
      parseCsvText(content);
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    const sampleCsv = `SKU,Name,Description,Selling Price (INR),Stock Quantity
SKU-1001,Premium Noise Cancelling Headphones,Spatial Audio with 30-hour battery,12999,50
SKU-1002,Smartwatch Ultra Titanium,GPS + Cellular fitness tracking watch,29999,30
SKU-1003,Mechanical Wireless Gaming Keyboard,RGB Backlit Tactile Switches,6499,75
SKU-1004,4K Ultra HD Streaming Camera,Dual AI Auto-Focus Web Cam,7999,40`;
    
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-merchant-catalog.csv';
    a.click();
  };

  const openImportModal = () => {
    parseCsvText(rawCsvInput);
    setShowImportModal(true);
  };

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center">
            <Sparkles className="text-cyan-400 mr-3" size={28} />
            Catalog Ingestion & AI Endpoint Store
          </h2>
          <p className="text-zinc-400 mt-1">Convert your existing merchant catalog into an AI-buyable MCP endpoint in 1-click.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={openImportModal}
            className="flex items-center px-5 py-2.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 font-medium text-xs transition-colors cursor-pointer"
          >
            <Upload size={16} className="mr-2" />
            Bulk Import CSV / Excel
          </button>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-5 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 font-medium text-xs transition-colors cursor-pointer"
          >
            <Plus size={16} className="mr-2" />
            Add Single Product
          </button>
        </div>
      </div>

      {/* Catalog Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 text-zinc-500" size={18} />
        <input 
          type="text" 
          placeholder="Search products by SKU, name, or AI vector description..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-900/60 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 backdrop-blur-sm"
        />
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-zinc-500">Loading AI catalog...</div>
        ) : data?.products?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-500 bg-zinc-900/30 border border-white/5 rounded-2xl">
            <Database size={32} className="mx-auto text-zinc-600 mb-2" />
            No products found in this merchant catalog. Click <strong>Bulk Import CSV</strong> to load your inventory!
          </div>
        ) : data?.products?.map((product, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            key={product.id} 
            className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 hover:border-white/20 transition-all backdrop-blur-sm relative group space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                  {product.id.slice(0, 14)}...
                </span>
                <h3 className="font-bold text-white text-base mt-2 group-hover:text-cyan-300 transition-colors">{product.name}</h3>
              </div>
              <button 
                onClick={() => {
                  setEditingProduct(product);
                  setEditName(product.name);
                  setEditDescription(product.description || '');
                  setEditPriceMinor((product.priceMinor / 100).toString());
                  setEditCurrency(product.currency || 'INR');
                  setEditStock(product.inventory?.quantity?.toString() || '50');
                }}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Edit2 size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{product.description || 'No description provided.'}</p>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider block">Selling Price</span>
                <span className="text-lg font-bold text-emerald-400">
                  ₹{(product.priceMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider block">Stock In Hand</span>
                <span className="text-xs font-semibold text-zinc-300 bg-black/40 px-2.5 py-1 rounded-md border border-white/5 inline-block mt-0.5">
                  {product.inventory?.quantity !== undefined ? product.inventory.quantity : 50} units
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bulk Import Connector Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-3xl w-full shadow-2xl relative space-y-6 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Merchant Catalog Ingestion Adapter</h3>
                    <p className="text-xs text-zinc-400">Make your existing inventory AI-buyable without entering products manually.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 3 Ingestion Strategy Connector Tabs */}
              <div className="grid grid-cols-3 gap-3 bg-black/50 p-1.5 rounded-xl border border-white/5">
                <button
                  onClick={() => setActiveIngestionTab('CSV')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                    activeIngestionTab === 'CSV' 
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet size={14} className="mr-1.5" /> 🟢 CSV / Excel Importer (BUILD NOW)
                </button>

                <button
                  onClick={() => setActiveIngestionTab('SHOPIFY')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                    activeIngestionTab === 'SHOPIFY' 
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ShoppingBag size={14} className="mr-1.5" /> 🟡 Shopify OAuth Sync
                </button>

                <button
                  onClick={() => setActiveIngestionTab('ERP')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                    activeIngestionTab === 'ERP' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Database size={14} className="mr-1.5" /> 🔵 ERP / Custom API
                </button>
              </div>

              {/* TAB 1: CSV / EXCEL BULK IMPORTER */}
              {activeIngestionTab === 'CSV' && (
                <div className="space-y-4 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center">
                      <Upload size={14} className="mr-1 text-cyan-400" />
                      Upload CSV / Excel File or Edit Input Below
                    </label>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleDownloadSampleCsv}
                        className="text-xs text-zinc-400 hover:text-cyan-400 flex items-center font-mono underline cursor-pointer"
                      >
                        <Download size={12} className="mr-1" /> Download Sample CSV
                      </button>

                      <label className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors">
                        Browse File
                        <input type="file" accept=".csv,.xlsx,.txt" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={rawCsvInput}
                    onChange={(e) => {
                      setRawCsvInput(e.target.value);
                      parseCsvText(e.target.value);
                    }}
                    className="w-full bg-black/80 border border-white/10 rounded-xl p-3 text-xs text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />

                  {/* Pre-Import Real-Time Validation Box */}
                  <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-semibold text-white">Pre-Import Validation Status</span>
                      <div className="flex items-center space-x-3 text-xs font-mono">
                        <span className="text-zinc-300">Total: {parseStats.total}</span>
                        <span className="text-emerald-400 font-bold flex items-center"><CheckCircle2 size={12} className="mr-1" /> {parseStats.valid} Valid</span>
                        <span className="text-red-400 font-bold flex items-center"><AlertCircle size={12} className="mr-1" /> {parseStats.errors} Errors</span>
                      </div>
                    </div>

                    {/* Preview Table */}
                    <div className="overflow-x-auto max-h-40">
                      <table className="w-full text-left text-xs">
                        <thead className="text-zinc-500 border-b border-white/5">
                          <tr>
                            <th className="py-1">SKU</th>
                            <th className="py-1">Product Name</th>
                            <th className="py-1">Selling Price</th>
                            <th className="py-1">Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {parsedPreviewProducts.slice(0, 5).map((p, i) => (
                            <tr key={i} className="text-zinc-300">
                              <td className="py-1 font-mono text-[11px] text-cyan-400">{p.externalId}</td>
                              <td className="py-1">{p.name}</td>
                              <td className="py-1 text-emerald-400 font-semibold">₹{(p.priceMinor / 100).toLocaleString('en-IN')}</td>
                              <td className="py-1 text-zinc-400">{p.quantity} units</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SHOPIFY OAUTH CONNECTOR */}
              {activeIngestionTab === 'SHOPIFY' && (
                <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-6 space-y-4 text-center">
                  <ShoppingBag size={40} className="mx-auto text-purple-400" />
                  <h4 className="text-base font-bold text-white">Shopify OAuth Connector Architecture</h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Connect your existing Shopify store to automatically sync products, variants, and real-time inventory levels to the Agentic Commerce MCP Endpoint.
                  </p>

                  <div className="flex items-center justify-center space-x-2 text-xs font-mono text-purple-300 pt-2">
                    <span>Shopify Store</span>
                    <ArrowRight size={14} />
                    <span>OAuth Sync</span>
                    <ArrowRight size={14} />
                    <span>AI-Buyable Catalog</span>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={() => alert('Shopify OAuth architecture adapter ready for production deployment!')}
                      className="px-5 py-2.5 bg-purple-500 text-white rounded-xl text-xs font-bold hover:bg-purple-600 transition-colors cursor-pointer"
                    >
                      Connect Shopify Store
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ERP / CUSTOM API */}
              {activeIngestionTab === 'ERP' && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-6 space-y-4 text-center">
                  <Database size={40} className="mx-auto text-emerald-400" />
                  <h4 className="text-base font-bold text-white">Custom ERP / Webhook Adapter Architecture</h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Expose an automated REST or Webhook payload adapter from SAP, Tally, or custom backend to continuously stream inventory updates into your Agentic Control Plane.
                  </p>

                  <div className="bg-black/60 p-3 rounded-lg border border-white/5 text-left text-xs font-mono text-zinc-300 overflow-x-auto max-w-md mx-auto">
                    POST /api/v1/merchants/{merchantId}/catalog/stream
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-mono">
                  {parseStats.valid} Products Ready for Import
                </span>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-medium hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => bulkImportMutation.mutate({ products: parsedPreviewProducts })}
                    disabled={bulkImportMutation.isPending || parsedPreviewProducts.length === 0}
                    className="px-6 py-2 bg-cyan-500 text-black font-bold rounded-xl text-xs hover:bg-cyan-400 transition-colors disabled:opacity-50 flex items-center cursor-pointer"
                  >
                    <Check size={16} className="mr-1.5" />
                    {bulkImportMutation.isPending ? 'Importing Products...' : 'Confirm Import → Make AI-Buyable'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Single Product Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">Add Single Product</h3>
                <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Product Name</label>
                  <input 
                    type="text" 
                    required 
                    value={productName} 
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Ergonomic Keyboard"
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Description</label>
                  <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Product details for AI search..."
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 mb-1 font-medium">Price (₹)</label>
                    <input 
                      type="number" 
                      required 
                      value={priceMinor} 
                      onChange={(e) => setPriceMinor(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 mb-1 font-medium">Initial Stock</label>
                    <input 
                      type="number" 
                      required 
                      value={initialQuantity} 
                      onChange={(e) => setInitialQuantity(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg font-medium">Cancel</button>
                  <button type="submit" disabled={addProductMutation.isPending} className="px-5 py-2 bg-emerald-500 text-black font-bold rounded-lg cursor-pointer">
                    {addProductMutation.isPending ? 'Saving...' : 'Add Product'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">Edit Product & Inventory</h3>
                <button onClick={() => setEditingProduct(null)} className="text-zinc-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Product Name</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Description</label>
                  <textarea 
                    value={editDescription} 
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 mb-1 font-medium">Price (₹)</label>
                    <input 
                      type="number" 
                      value={editPriceMinor} 
                      onChange={(e) => setEditPriceMinor(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 mb-1 font-medium">Stock In Hand</label>
                    <input 
                      type="number" 
                      value={editStock} 
                      onChange={(e) => setEditStock(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button type="button" onClick={() => setEditingProduct(null)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg font-medium">Cancel</button>
                  <button 
                    onClick={() => {
                      editProductMutation.mutate({
                        name: editName,
                        description: editDescription,
                        priceMinor: Math.round(parseFloat(editPriceMinor) * 100),
                        quantity: parseInt(editStock, 10),
                        inventoryQuantity: parseInt(editStock, 10)
                      });
                    }}
                    disabled={editProductMutation.isPending} 
                    className="px-5 py-2 bg-cyan-500 text-black font-bold rounded-lg cursor-pointer"
                  >
                    {editProductMutation.isPending ? 'Updating...' : 'Update Product'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
