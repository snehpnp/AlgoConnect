import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { campaignService, type Campaign } from '../services/campaign.service';
import { segmentService, type Segment } from '../services/segment.service';
import { getTemplates, type MessageTemplate } from '../services/template.service';
import { leadsService, type Lead } from '../services/leads.service';
import { ArrowLeft, Save, Search, Loader2, Users, User, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const CampaignEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentCampaign, setCurrentCampaign] = useState<Partial<Campaign>>({
    name: '',
    type: 'EMAIL',
    status: 'DRAFT',
    segmentIds: [],
    leadIds: []
  });
  
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

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
              leadIds: campRes.data.leads?.map(l => l.id) || []
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

  useEffect(() => {
    const fetchLeads = async () => {
      setLeadsLoading(true);
      try {
        const params: any = { limit: 100 };
        if (modalSearch) params.search = modalSearch;
        const res = await leadsService.getLeads(params);
        setAvailableLeads(res.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLeadsLoading(false);
      }
    };
    
    // Debounce the search
    const timer = setTimeout(() => {
      fetchLeads();
    }, 500);
    return () => clearTimeout(timer);
  }, [modalSearch]);

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
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                <select value={currentCampaign.status || 'DRAFT'} onChange={(e) => setCurrentCampaign({ ...currentCampaign, status: e.target.value })} className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="md:col-span-2 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-[#0F172A]">Audience Targeting</h3>
                    <p className="text-xs text-slate-500 mt-1">Select the segments or individual leads who will receive this campaign.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Segments */}
                  <div className="flex flex-col h-[350px]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Segments</label>
                      {(currentCampaign.segmentIds?.length || 0) > 0 && (
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {currentCampaign.segmentIds?.length} Selected
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-slate-50 p-3 overflow-y-auto custom-scrollbar shadow-inner">
                      {segments.map(seg => {
                        const isSelected = (currentCampaign.segmentIds || []).includes(seg.id);
                        return (
                          <label 
                            key={seg.id} 
                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                              isSelected 
                                ? 'bg-primary/5 border-primary/30 shadow-sm' 
                                : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                            }`}
                          >
                            <div className="mt-0.5 relative flex items-center justify-center">
                              <input
                                type="checkbox"
                                className="peer appearance-none w-4 h-4 rounded border border-gray-300 checked:bg-primary checked:border-primary transition-colors cursor-pointer"
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentIds = currentCampaign.segmentIds || [];
                                  if (e.target.checked) {
                                    setCurrentCampaign({ ...currentCampaign, segmentIds: [...currentIds, seg.id] });
                                  } else {
                                    setCurrentCampaign({ ...currentCampaign, segmentIds: currentIds.filter((id: number) => id !== seg.id) });
                                  }
                                }}
                              />
                              <CheckCircle2 className={`absolute w-3.5 h-3.5 text-white pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                            </div>
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <div className={`p-1.5 rounded-md ${isSelected ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                                <Users className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <div className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-slate-700'}`}>{seg.name}</div>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                      {segments.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                          <Users className="w-8 h-8 opacity-20" />
                          <span className="text-xs">No segments available</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Direct Leads */}
                  <div className="flex flex-col h-[350px]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Direct Leads</label>
                      {(currentCampaign.leadIds?.length || 0) > 0 && (
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {currentCampaign.leadIds?.length} Selected
                        </span>
                      )}
                    </div>
                    <div className="relative mb-2 shrink-0">
                      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        autoComplete="off"
                        placeholder="Search specific leads..."
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-slate-50 p-3 overflow-y-auto custom-scrollbar shadow-inner">
                      {leadsLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                        </div>
                      ) : availableLeads.map(lead => {
                        const isSelected = (currentCampaign.leadIds || []).includes(lead.id);
                        return (
                          <label 
                            key={lead.id} 
                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                              isSelected 
                                ? 'bg-primary/5 border-primary/30 shadow-sm' 
                                : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                            }`}
                          >
                            <div className="mt-0.5 relative flex items-center justify-center">
                              <input
                                type="checkbox"
                                className="peer appearance-none w-4 h-4 rounded border border-gray-300 checked:bg-primary checked:border-primary transition-colors cursor-pointer"
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentIds = currentCampaign.leadIds || [];
                                  if (e.target.checked) {
                                    setCurrentCampaign({ ...currentCampaign, leadIds: [...currentIds, lead.id] });
                                  } else {
                                    setCurrentCampaign({ ...currentCampaign, leadIds: currentIds.filter((id: number) => id !== lead.id) });
                                  }
                                }}
                              />
                              <CheckCircle2 className={`absolute w-3.5 h-3.5 text-white pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                            </div>
                            <div className="flex-1 min-w-0 flex items-center gap-3">
                              <div className={`p-1.5 rounded-full shrink-0 ${isSelected ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                                <User className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-semibold truncate ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{lead.name}</div>
                                {lead.email && <div className="text-[11px] text-slate-500 truncate mt-0.5">{lead.email}</div>}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                      {!leadsLoading && availableLeads.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                          <Search className="w-8 h-8 opacity-20" />
                          <span className="text-xs">No leads found</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
