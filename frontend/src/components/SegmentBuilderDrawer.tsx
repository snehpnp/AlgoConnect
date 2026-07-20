import { useState, useEffect } from 'react';
import { Filter, Save, Loader2, Target, BarChart, Eye, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SegmentRule } from '../services/segment.service';
import { segmentService } from '../services/segment.service';
import { leadsService } from '../services/leads.service';

interface SegmentBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const SegmentBuilderDrawer = ({ isOpen, onClose, onSave }: SegmentBuilderDrawerProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLeads, setPreviewLeads] = useState<any[]>([]);

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
    websiteStatus: 'All',
    algoStatus: 'All',
  });

  const [dbOptions, setDbOptions] = useState<{ states: string[]; cities: string[]; types: string[] }>({ states: [], cities: [], types: [] });
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

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
    setPreviewCount(null);
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
      onSave(); // Trigger refresh in parent list
      onClose();
    } catch (err: any) {
      toast.error('Failed to create segment');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl transition-transform duration-300 transform translate-x-0">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-4 shadow-sm z-10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Create Segment
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              Define dynamic rules to group your leads
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          
          {/* Segment Details */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart className="h-4 w-4 text-indigo-500" />
              Segment Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Segment Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Active RAs in Maharashtra"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 sm:py-2 text-sm outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Description</label>
                <textarea
                  placeholder="Briefly describe this segment..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 sm:py-2 text-sm outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Targeting Rules */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-500" />
              Targeting Rules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Entity Type</label>
                <select
                  value={rules.entityType}
                  onChange={(e) => handleRuleChange('entityType', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Entity Type</option>
                  {dbOptions.types.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Region / State</label>
                <select
                  value={rules.region}
                  onChange={(e) => handleRuleChange('region', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Region</option>
                  {dbOptions.states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">City</label>
                <select
                  value={rules.city}
                  onChange={(e) => handleRuleChange('city', e.target.value)}
                  disabled={!rules.region || rules.region === 'All'}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 sm:py-2 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="All">Any City</option>
                  {dbOptions.cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Registration Status</label>
                <select
                  value={rules.activityStatus}
                  onChange={(e) => handleRuleChange('activityStatus', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Status</option>
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Lead Score</label>
                <select
                  value={rules.leadScore}
                  onChange={(e) => handleRuleChange('leadScore', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Score</option>
                  <option value=">80">High Intent ({">"}80)</option>
                  <option value="50-80">Medium Intent (50-80)</option>
                  <option value="<50">Low Intent ({"<"}50)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Website Status</label>
                <select
                  value={rules.websiteStatus}
                  onChange={(e) => handleRuleChange('websiteStatus', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Status</option>
                  <option value="HasWebsite">Has Website</option>
                  <option value="NoWebsite">No Website</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Algo Products</label>
                <select
                  value={rules.algoStatus}
                  onChange={(e) => handleRuleChange('algoStatus', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="All">Any Status</option>
                  <option value="HasAlgo">Sells Algo Trading (Yes)</option>
                  <option value="NoAlgo">No Algo / Unknown</option>
                </select>
              </div>
            </div>
            
            <div className="mt-5 border-t border-slate-100 pt-5">
              <button
                onClick={handlePreview}
                disabled={isPreviewing}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-50 px-4 py-3 sm:py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                {isPreviewing ? 'Running Query...' : 'Preview Matching Leads'}
              </button>
            </div>
          </div>

          {/* Preview Results */}
          {previewCount !== null && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">Preview Results</span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                  {previewCount} Leads Match
                </span>
              </div>
              <div className="p-0">
                {previewCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600">No leads match these rules</p>
                    <p className="text-xs text-slate-400 mt-1">Try broadening your filters</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {previewLeads.slice(0, 5).map(lead => (
                      <div key={lead.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900 truncate">{lead.name}</p>
                          <span className="text-xs font-bold text-slate-500 whitespace-nowrap ml-2">Score: {lead.leadScore}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          <span className="truncate">{lead.type}</span>
                          {lead.city && <span>• {lead.city}</span>}
                        </div>
                      </div>
                    ))}
                    {previewCount > 5 && (
                      <div className="p-3 text-center bg-slate-50 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-500">...and {previewCount - 5} more leads</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Drawer Footer */}
        <div className="border-t border-slate-200 bg-white p-4 flex items-center justify-end gap-3 z-10">
          <button
            onClick={onClose}
            className="rounded-lg px-5 py-3 sm:py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 sm:py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Segment'}
          </button>
        </div>

      </div>
    </div>
  );
};
