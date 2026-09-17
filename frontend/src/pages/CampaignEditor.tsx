import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { campaignService, type Campaign } from '../services/campaign.service';
import { segmentService, type Segment } from '../services/segment.service';
import { getTemplates, type MessageTemplate } from '../services/template.service';
import { leadsService, type Lead } from '../services/leads.service';
import { ArrowLeft, Save, Search, Loader2, Users, User, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

type AudienceTab = 'segments' | 'leads';

export const CampaignEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentCampaign, setCurrentCampaign] = useState<Partial<Campaign>>({
    name: '',
    type: 'EMAIL',
    status: 'ACTIVE',
    segmentIds: [],
    leadIds: []
  });

  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);

  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [leadTypeFilter, setLeadTypeFilter] = useState('');
  const [segmentSearch, setSegmentSearch] = useState('');

  const [leadsPage, setLeadsPage] = useState(1);
  const [hasMoreLeads, setHasMoreLeads] = useState(true);

  // Which "add more" tab is open. Selection itself lives in currentCampaign,
  // so switching tabs never loses what's already picked.
  const [audienceTab, setAudienceTab] = useState<AudienceTab>('segments');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [segRes, tplRes] = await Promise.all([
          segmentService.getSegments(),
          getTemplates()
        ]);
        setSegments(segRes || []);
        setTemplates(tplRes.data || []);

        if (id) {
          const campRes = await campaignService.getCampaignById(parseInt(id));
          if (campRes.data) {
            setCurrentCampaign({
              ...campRes.data,
              segmentIds: campRes.data.segments?.map(s => s.id) || [],
              leadIds: (campRes.data.manualLeads || campRes.data.leads)?.map((l: any) => l.id) || []
            });
          }
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const fetchLeads = async (page: number, search: string, type: string) => {
    setLeadsLoading(true);
    try {
      const params: any = { limit: 100, page };
      if (search) params.search = search;
      if (type) params.type = type;
      const res = await leadsService.getLeads(params);

      if (page === 1) {
        setAvailableLeads(res.data);
      } else {
        setAvailableLeads(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const newLeads = res.data.filter((l: any) => !existingIds.has(l.id));
          return [...prev, ...newLeads];
        });
      }
      setHasMoreLeads(res.data.length >= 100);
    } catch (error) {
      console.error(error);
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeadsPage(1);
      fetchLeads(1, modalSearch, leadTypeFilter);
    }, 500);
    return () => clearTimeout(timer);
  }, [modalSearch, leadTypeFilter]);

  const handleScrollLeads = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && !leadsLoading && hasMoreLeads) {
      const nextPage = leadsPage + 1;
      setLeadsPage(nextPage);
      fetchLeads(nextPage, modalSearch, leadTypeFilter);
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCampaign.name || !currentCampaign.type) {
      toast.error('Name and Type are required');
      return;
    }

    // Auto-fill the correct template ID based on type and channels
    let finalCampaignData = { ...currentCampaign };
    if (finalCampaignData.type === 'EMAIL') {
      finalCampaignData.channels = ['EMAIL'];
    } else if (finalCampaignData.type === 'SMS') {
      finalCampaignData.channels = ['SMS'];
    } else if (finalCampaignData.type === 'WHATSAPP') {
      finalCampaignData.channels = ['WHATSAPP'];
    }

    try {
      if (id) {
        await campaignService.updateCampaign(parseInt(id), finalCampaignData);
        toast.success('Campaign updated successfully');
      } else {
        await campaignService.createCampaign(finalCampaignData);
        toast.success('Campaign created successfully');
      }
      navigate('/campaigns');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save campaign');
    }
  };

  const selectedSegments = useMemo(
    () => (currentCampaign.segmentIds || [])
      .map(sid => segments.find(s => s.id === sid))
      .filter((s): s is Segment => Boolean(s)),
    [currentCampaign.segmentIds, segments]
  );

  // Leads picked directly may not be in the currently-filtered availableLeads
  // list, so we keep a lookup map that survives search/filter changes.
  const [leadLookup, setLeadLookup] = useState<Record<number, Lead>>({});
  useEffect(() => {
    setLeadLookup(prev => {
      const next = { ...prev };
      availableLeads.forEach(l => { next[l.id] = l; });
      return next;
    });
  }, [availableLeads]);

  const selectedLeads = useMemo(
    () => (currentCampaign.leadIds || []).map(lid => leadLookup[lid] || { id: lid, name: `Lead #${lid}` } as Lead),
    [currentCampaign.leadIds, leadLookup]
  );

  const filteredSegments = useMemo(() => {
    const base = !segmentSearch.trim()
      ? segments
      : segments.filter(s => s.name.toLowerCase().includes(segmentSearch.toLowerCase()));
    const selectedIds = currentCampaign.segmentIds || [];
    // Selected first, so unchecking something you just picked doesn't need a search/scroll hunt.
    return [...base].sort((a, b) => {
      const aSel = selectedIds.includes(a.id) ? 0 : 1;
      const bSel = selectedIds.includes(b.id) ? 0 : 1;
      return aSel - bSel;
    });
  }, [segments, segmentSearch, currentCampaign.segmentIds]);

  const sortedLeads = useMemo(() => {
    const selectedIds = currentCampaign.leadIds || [];
    const selected = selectedIds.map(lid => leadLookup[lid] || { id: lid, name: `Lead #${lid}` } as Lead);

    const selectedSet = new Set(selectedIds);
    const unselected = availableLeads.filter(l => !selectedSet.has(l.id));

    return [...selected, ...unselected];
  }, [availableLeads, currentCampaign.leadIds, leadLookup]);

  const toggleSegment = (segId: number) => {
    const currentIds = currentCampaign.segmentIds || [];
    setCurrentCampaign({
      ...currentCampaign,
      segmentIds: currentIds.includes(segId)
        ? currentIds.filter((sid: number) => sid !== segId)
        : [...currentIds, segId]
    });
  };

  const toggleLead = (leadId: number) => {
    const currentIds = currentCampaign.leadIds || [];
    setCurrentCampaign({
      ...currentCampaign,
      leadIds: currentIds.includes(leadId)
        ? currentIds.filter((lId: number) => lId !== leadId)
        : [...currentIds, leadId]
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading...</div>;
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/campaigns')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{id ? 'Edit Campaign' : 'Create Campaign'}</h1>
            <p className="text-sm text-gray-500">{id ? `Editing Campaign #${id}` : 'Setup a new outreach campaign'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/campaigns')} className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm">
            Cancel
          </button>
          <button onClick={handleSaveCampaign} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2">
            <Save className="w-4 h-4" />
            {id ? 'Update Campaign' : 'Save Campaign'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-8xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <form onSubmit={handleSaveCampaign} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Campaign Name</label>
                <input type="text" required value={currentCampaign.name || ''} onChange={(e) => setCurrentCampaign({ ...currentCampaign, name: e.target.value })} className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="e.g. Q3 Sales Outreach" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Channel Type</label>
                <select value={currentCampaign.type || 'EMAIL'} onChange={(e) => setCurrentCampaign({ ...currentCampaign, type: e.target.value, emailTemplateId: null, smsTemplateId: null, whatsappTemplateId: null })} className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Message Template</label>
                <select
                  value={
                    currentCampaign.type === 'EMAIL' ? (currentCampaign.emailTemplateId || '') :
                      currentCampaign.type === 'SMS' ? (currentCampaign.smsTemplateId || '') :
                        (currentCampaign.whatsappTemplateId || '')
                  }
                  onChange={(e) => {
                    const templateId = e.target.value ? parseInt(e.target.value) : null;
                    if (currentCampaign.type === 'EMAIL') {
                      setCurrentCampaign({ ...currentCampaign, emailTemplateId: templateId });
                    } else if (currentCampaign.type === 'SMS') {
                      setCurrentCampaign({ ...currentCampaign, smsTemplateId: templateId });
                    } else {
                      setCurrentCampaign({ ...currentCampaign, whatsappTemplateId: templateId });
                    }
                  }}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a template...</option>
                  {templates.filter(t => t.type === currentCampaign.type).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Content to send to leads.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Status</label>
                <select value={currentCampaign.status || 'ACTIVE'} onChange={(e) => setCurrentCampaign({ ...currentCampaign, status: e.target.value })} className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              {/* ---------------- Audience ---------------- */}
              <div className="md:col-span-2 pt-6 border-t border-gray-100">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Audience</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Add whole segments, individual leads, or both — everyone listed below receives this campaign.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                  <div className="flex bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setAudienceTab('segments')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${audienceTab === 'segments'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                    >
                      <Users className="w-4 h-4" /> Add by segment
                      {selectedSegments.length > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${audienceTab === 'segments' ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-300'}`}>{selectedSegments.length}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudienceTab('leads')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${audienceTab === 'leads'
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                    >
                      <User className="w-4 h-4" /> Add individual leads
                      {selectedLeads.length > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${audienceTab === 'leads' ? 'bg-white/20 text-white' : 'bg-teal-500/20 text-teal-300'}`}>{selectedLeads.length}</span>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 px-3 pt-2.5">
                    {audienceTab === 'segments'
                      ? 'A segment adds every lead in that group. Pick as many segments as you need.'
                      : 'Adds specific leads on top of any segments above — use this to fine-tune the list.'}
                  </p>

                  {audienceTab === 'segments' ? (
                    <div className="flex flex-col h-[340px]">
                      <div className="p-2.5 border-b border-slate-100 shrink-0">
                        <div className="relative">
                          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            autoComplete="off"
                            placeholder="Search segments..."
                            value={segmentSearch}
                            onChange={(e) => setSegmentSearch(e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredSegments.map((seg, idx) => {
                          const isSelected = (currentCampaign.segmentIds || []).includes(seg.id);
                          const prevSelected = idx > 0 ? (currentCampaign.segmentIds || []).includes(filteredSegments[idx - 1].id) : null;
                          const showDivider = idx > 0 && prevSelected === true && !isSelected;
                          return (
                            <React.Fragment key={seg.id}>
                              {showDivider && (
                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100">
                                  All segments
                                </div>
                              )}
                              <div
                                onClick={() => toggleSegment(seg.id)}
                                className={`flex items-center justify-between p-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0 hover:bg-slate-50 ${isSelected ? 'bg-indigo-50/40' : ''}`}
                              >
                                <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-4">
                                  <Users className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                                  <div className={`text-sm font-medium truncate transition-colors ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{seg.name}</div>
                                </div>
                                <div className="shrink-0 flex items-center justify-center">
                                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                    <CheckCircle2 className={`w-3.5 h-3.5 text-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                                  </div>
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })}
                        {filteredSegments.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-8">
                            <Users className="w-8 h-8 opacity-20" />
                            <span className="text-xs">{segments.length === 0 ? 'No segments available' : 'No segments match your search'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-[380px]">
                      <div className="p-2.5 border-b border-slate-100 shrink-0 flex flex-row gap-2 items-center">
                        <div className="relative flex-1">
                          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            autoComplete="off"
                            placeholder="Search specific leads..."
                            value={modalSearch}
                            onChange={(e) => setModalSearch(e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-400"
                          />
                        </div>
                        <select
                          value={leadTypeFilter}
                          onChange={(e) => setLeadTypeFilter(e.target.value)}
                          className="w-[160px] rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-700"
                        >
                          <option value="">All Types</option>
                          <option value="Manual">Manual</option>
                          <option value="Research Analyst (RA)">Research Analyst (RA)</option>
                          <option value="Investment Advisor (IA)">Investment Advisor (IA)</option>
                          <option value="Portfolio Manager (PM)">Portfolio Manager (PM)</option>
                        </select>
                      </div>

                      {/* Table header */}
                      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 bg-slate-50 shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        <div className="w-8 shrink-0">#</div>
                        <div className="flex-1 min-w-0">Name</div>
                        <div className="w-[200px] shrink-0">Email</div>
                        <div className="w-[140px] shrink-0">Phone</div>
                        <div className="w-5 shrink-0" />
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white" onScroll={handleScrollLeads}>
                        {leadsLoading && leadsPage === 1 ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                          </div>
                        ) : (
                          <>
                            {sortedLeads.map((lead, idx) => {
                              const isSelected = (currentCampaign.leadIds || []).includes(lead.id);
                              const prevSelected = idx > 0 ? (currentCampaign.leadIds || []).includes(sortedLeads[idx - 1].id) : null;
                              const showDivider = idx > 0 && prevSelected === true && !isSelected;
                              return (
                                <React.Fragment key={lead.id}>
                                  {showDivider && (
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100">
                                      All leads
                                    </div>
                                  )}
                                  <div
                                    onClick={() => toggleLead(lead.id)}
                                    className={`flex items-center gap-2 p-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0 hover:bg-slate-50 ${isSelected ? 'bg-teal-50/50' : ''}`}
                                  >
                                    <div className="w-8 shrink-0 text-xs text-slate-400 tabular-nums">{idx + 1}</div>
                                    <div className={`flex-1 min-w-0 text-sm font-medium truncate transition-colors ${isSelected ? 'text-teal-700' : 'text-slate-700'}`}>
                                      {lead.name}
                                    </div>
                                    <div className="w-[200px] shrink-0 text-[11px] text-slate-500 truncate">
                                      {lead.email || <span className="text-slate-300">—</span>}
                                    </div>
                                    <div className={`w-[140px] shrink-0 text-[11px] truncate font-medium tabular-nums ${lead.phone ? (isSelected ? 'text-teal-600/80' : 'text-slate-500') : 'text-red-400'}`}>
                                      {lead.phone || 'No phone'}
                                    </div>
                                    <div className="w-5 shrink-0 flex items-center justify-center">
                                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-teal-600 border-teal-600' : 'border-slate-300 bg-white'}`}>
                                        <CheckCircle2 className={`w-3.5 h-3.5 text-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                                      </div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                            {leadsLoading && leadsPage > 1 && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-primary opacity-50" />
                              </div>
                            )}
                          </>
                        )}
                        {!leadsLoading && sortedLeads.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-8">
                            <Search className="w-8 h-8 opacity-20" />
                            <span className="text-xs">No leads found</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};