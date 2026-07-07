import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Filter, Save, ArrowLeft, Loader2, Target, Zap, BarChart, Eye, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SegmentRule } from '../services/segment.service';
import { segmentService } from '../services/segment.service';
import { leadsService } from '../services/leads.service';

export const CreateEditSegment = () => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLeads, setPreviewLeads] = useState<any[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [rules, setRules] = useState<SegmentRule>({
    entityType: 'All',
    activityStatus: 'All',
    region: 'All',
    city: 'All',
    leadScore: 'All',
    existingProduct: 'All',
    market: 'All',
  });

  const [dbOptions, setDbOptions] = useState<{ states: string[]; cities: string[]; types: string[] }>({ states: [], cities: [], types: [] });
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await leadsService.getFilterOptions();
        setDbOptions(prev => ({ ...prev, states: res.states, types: res.types }));
      } catch (err) {
        console.error('Failed to load filter options');
      } finally {
        setIsLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (rules.region && rules.region !== 'All') {
      const fetchCities = async () => {
        try {
          const res = await leadsService.getFilterOptions(rules.region);
          setDbOptions(prev => ({ ...prev, cities: res.cities }));
        } catch (err) {
          console.error('Failed to load cities');
        }
      };
      fetchCities();
    } else {
      setDbOptions(prev => ({ ...prev, cities: [] }));
      if (rules.city !== 'All') {
        setRules(prev => ({ ...prev, city: 'All' }));
      }
    }
  }, [rules.region]);

  const handleRuleChange = (key: keyof SegmentRule, value: string) => {
    setRules((prev) => ({ ...prev, [key]: value }));
    setPreviewCount(null); // Reset count on filter change
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      const activeRules = Object.fromEntries(Object.entries(rules).filter(([_, v]) => v !== 'All'));
      const { count, leads } = await segmentService.previewSegment(activeRules);
      setPreviewCount(count);
      setPreviewLeads(leads || []);
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
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex justify-between">
                  Entity Type
                  {isLoadingOptions && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                </label>
                <select
                  value={rules.entityType}
                  onChange={(e) => handleRuleChange('entityType', e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Entity Type</option>
                  {dbOptions.types.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                  {/* Fallbacks if DB is empty */}
                  {dbOptions.types.length === 0 && !isLoadingOptions && (
                    <>
                      <option value="Research Analyst (RA)">Research Analyst (RA)</option>
                      <option value="Investment Advisor (IA)">Investment Advisor (IA)</option>
                      <option value="Sub Broker">Sub Broker</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex justify-between">
                  Region / State
                  {isLoadingOptions && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                </label>
                <select
                  value={rules.region}
                  onChange={(e) => handleRuleChange('region', e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Region</option>
                  {dbOptions.states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex justify-between">
                  City
                </label>
                <select
                  value={rules.city}
                  onChange={(e) => handleRuleChange('city', e.target.value)}
                  disabled={!rules.region || rules.region === 'All'}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white disabled:opacity-50"
                >
                  <option value="All">Any City</option>
                  {dbOptions.cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
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

            {previewCount !== null && previewCount > 0 && (
              <button
                onClick={() => setShowPreviewModal(true)}
                className="w-full mb-3 inline-flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Eye className="h-4 w-4 text-blue-500" />
                View Matched Leads
              </button>
            )}

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

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl border border-[#E2E8F0] bg-white rounded-xl shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] p-6">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Previewing Leads in "{name || 'Untitled Segment'}"</h3>
                <p className="text-xs text-[#64748B] mt-1">Showing top matches for this segment's targeting rules.</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F8FAFC] hover:text-slate-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-auto flex-1 p-6">
              {previewLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <AlertCircle className="h-8 w-8 mb-3" />
                  <p className="text-sm font-medium">No leads currently match this segment.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                  <table className="w-full text-left whitespace-nowrap text-sm">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                      <tr>
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Entity Name</th>
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Type</th>
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Email</th>
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">Phone</th>
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase">State/Region</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {previewLeads.map((lead, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-semibold text-[#0F172A]">{lead.name}</td>
                          <td className="py-2.5 px-4 text-slate-600">{lead.type || '-'}</td>
                          <td className="py-2.5 px-4 text-slate-600">{lead.email || '-'}</td>
                          <td className="py-2.5 px-4 text-slate-600">{lead.phone || '-'}</td>
                          <td className="py-2.5 px-4 text-slate-600">{lead.state || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
