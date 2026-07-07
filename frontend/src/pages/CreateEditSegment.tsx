import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Filter, Save, ArrowLeft, Loader2, Target, Zap, BarChart } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SegmentRule } from '../services/segment.service';
import { segmentService } from '../services/segment.service';

export const CreateEditSegment = () => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [rules, setRules] = useState<SegmentRule>({
    entityType: 'All',
    activityStatus: 'All',
    region: 'All',
    leadScore: 'All',
    existingProduct: 'All',
    market: 'All',
  });

  const handleRuleChange = (key: keyof SegmentRule, value: string) => {
    setRules((prev) => ({ ...prev, [key]: value }));
    setPreviewCount(null); // Reset count on filter change
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      // In a real app we'd strip 'All' before sending, but backend handles basic logic
      const activeRules = Object.fromEntries(Object.entries(rules).filter(([_, v]) => v !== 'All'));
      const count = await segmentService.previewSegment(activeRules);
      setPreviewCount(count);
      toast.success('Segment preview updated');
    } catch (err: any) {
      toast.error('Failed to generate preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Segment name is required');
      return;
    }
    setIsSaving(true);
    try {
      const activeRules = Object.fromEntries(Object.entries(rules).filter(([_, v]) => v !== 'All'));
      await segmentService.createSegment(name, description, activeRules);
      toast.success('Segment created successfully');
      navigate('/segments');
    } catch (err: any) {
      toast.error('Failed to create segment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => navigate('/segments')}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] w-fit transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Segments
        </button>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          Create Segment
        </h1>
        <p className="text-[#64748B] text-sm">
          Define dynamic rule-based filters to group your leads. These segments can be reused across multiple campaigns.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
              <BarChart className="h-5 w-5 text-indigo-500" />
              Segment Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Segment Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Active RAs in Maharashtra"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Description (Optional)</label>
                <textarea
                  placeholder="Briefly describe who this segment targets..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:bg-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Rules/Filters */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
              <Filter className="h-5 w-5 text-emerald-500" />
              Targeting Rules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Entity Type</label>
                <select
                  value={rules.entityType}
                  onChange={(e) => handleRuleChange('entityType', e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Entity Type</option>
                  <option value="RA">Research Analyst (RA)</option>
                  <option value="IA">Investment Advisor (IA)</option>
                  <option value="Sub Broker">Sub Broker</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Region / State</label>
                <select
                  value={rules.region}
                  onChange={(e) => handleRuleChange('region', e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Region</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Gujarat">Gujarat</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Activity Status</label>
                <select
                  value={rules.activityStatus}
                  onChange={(e) => handleRuleChange('activityStatus', e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Status</option>
                  <option value="Verified">Verified</option>
                  <option value="Unverified">Unverified</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Lead Score</label>
                <select
                  value={rules.leadScore}
                  onChange={(e) => handleRuleChange('leadScore', e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Score</option>
                  <option value="High">High (&gt; 80)</option>
                  <option value="Medium">Medium (50 - 80)</option>
                  <option value="Low">Low (&lt; 50)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Existing Algo Product</label>
                <select
                  value={rules.existingProduct}
                  onChange={(e) => handleRuleChange('existingProduct', e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any</option>
                  <option value="Yes">Yes (Existing Customer)</option>
                  <option value="No">No (New Prospect)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Market Interest</label>
                <select
                  value={rules.market}
                  onChange={(e) => handleRuleChange('market', e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Market</option>
                  <option value="Equity">Equity</option>
                  <option value="FnO">F&O</option>
                  <option value="Commodity">Commodity</option>
                  <option value="Forex">Forex</option>
                </select>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Preview & Save */}
        <div className="space-y-6">
          <div className="sticky top-6 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-lg shadow-slate-200/50">
            <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Segment Size
            </h2>
            
            <div className="flex flex-col items-center justify-center p-6 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              {previewCount === null ? (
                <div className="text-center py-4">
                  <Zap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-500">Click preview to calculate size</p>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-4xl font-extrabold text-[#0F172A] tracking-tight">{previewCount}</span>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-1">Leads Matched</p>
                </div>
              )}
            </div>

            <button
              onClick={handlePreview}
              disabled={isPreviewing}
              className="w-full mb-3 inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-white px-4 py-3 text-sm font-bold text-primary hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {isPreviewing ? 'Calculating...' : 'Preview Segment Size'}
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Saving Segment...' : 'Save Segment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
