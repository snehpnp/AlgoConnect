import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, Plus, Search, MoreVertical, Edit2, Trash2, Users, X, Loader2, Info, Settings } from 'lucide-react';
import { campaignService, type Campaign } from '../services/campaign.service';
import { leadsService, type Lead } from '../services/leads.service';
import { segmentService, type Segment } from '../services/segment.service';
import { getTemplates, type MessageTemplate } from '../services/template.service';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Campaign360Drawer } from '../components/Campaign360Drawer';

export const Campaigns: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'System Admin';
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isEngineRunning, setIsEngineRunning] = useState(true);
  const [isEngineInfoModalOpen, setIsEngineInfoModalOpen] = useState(false);
  const [infoLanguage, setInfoLanguage] = useState<'en' | 'hi'>('hi');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<Partial<Campaign>>({});
  
  // Drawer state
  const [selectedCampaignForDrawer, setSelectedCampaignForDrawer] = useState<Campaign | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Leads connection state
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSalesStage, setModalSalesStage] = useState('');

  // Row Action Menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu on scroll
  useEffect(() => {
    const handleScroll = () => setOpenMenuId(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  // Close the row action menu when clicking anywhere outside it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCampaigns = async () => {
    try {
      const [campRes, segRes, engineRes, tplRes] = await Promise.all([
        campaignService.getCampaigns(),
        segmentService.getSegments(),
        campaignService.getEngineStatus(),
        getTemplates()
      ]);
      setCampaigns(campRes.data || []);
      setSegments(segRes || []);
      setTemplates(tplRes.data || []);
      setIsEngineRunning(engineRes.data?.isRunning ?? true);
    } catch (error) {
      toast.error('Failed to load campaigns and segments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCampaign.name || !currentCampaign.type) {
      toast.error('Name and Type are required');
      return;
    }
    
    // Auto-fill the correct template ID based on type
    let finalCampaignData = { ...currentCampaign };
    if (finalCampaignData.type === 'EMAIL') {
      finalCampaignData.channels = ['EMAIL'];
    } else if (finalCampaignData.type === 'SMS') {
      finalCampaignData.channels = ['SMS'];
    } else if (finalCampaignData.type === 'WHATSAPP') {
      finalCampaignData.channels = ['WHATSAPP'];
    }

    try {
      if (currentCampaign.id) {
        await campaignService.updateCampaign(currentCampaign.id, finalCampaignData);
        toast.success('Campaign updated successfully');
      } else {
        await campaignService.createCampaign(finalCampaignData);
        toast.success('Campaign created successfully');
      }
      setIsFormOpen(false);
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save campaign');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await campaignService.deleteCampaign(id);
      toast.success('Campaign deleted');
      fetchCampaigns();
    } catch (err) {
      toast.error('Failed to delete campaign');
    }
    setOpenMenuId(null);
  };

  const toggleCampaignStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    try {
      // Optimistic UI update
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));
      await campaignService.updateCampaign(campaign.id, { status: newStatus });
      toast.success(`Campaign marked as ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update campaign status');
      fetchCampaigns(); // Revert
    }
    setOpenMenuId(null);
  };

  const fetchModalLeads = async (searchStr: string = '', stage: string = '') => {
    setLeadsLoading(true);
    try {
      const params: any = { limit: 100 };
      if (searchStr) params.search = searchStr;
      if (stage) params.salesStage = stage;

      const res = await leadsService.getLeads(params);
      setAvailableLeads(res.data);
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setLeadsLoading(false);
    }
  };

  const openManageLeads = async (campaign: Campaign) => {
    setCurrentCampaign(campaign);
    setOpenMenuId(null);
    setIsLeadsModalOpen(true);
    setSelectedLeadIds(new Set());
    setModalSearch('');
    setModalSalesStage('');
    await fetchModalLeads();
  };

  // Debounced search for Modal
  useEffect(() => {
    if (!isLeadsModalOpen && !isFormOpen) return;
    const delayDebounceFn = setTimeout(() => {
      fetchModalLeads(modalSearch, modalSalesStage);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [modalSearch, modalSalesStage, isLeadsModalOpen, isFormOpen]);

  const handleAddLeads = async () => {
    if (!currentCampaign.id || selectedLeadIds.size === 0) return;
    try {
      await campaignService.addLeadsToCampaign(currentCampaign.id, Array.from(selectedLeadIds));
      toast.success(`${selectedLeadIds.size} leads added to campaign`);
      setIsLeadsModalOpen(false);
      fetchCampaigns();
    } catch (error) {
      toast.error('Failed to add leads to campaign');
    }
  };

  const toggleLeadSelection = (id: number) => {
    const newSet = new Set(selectedLeadIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedLeadIds(newSet);
  };

  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length;
  const filteredCampaigns = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleToggleEngine = async () => {
    try {
      const newState = !isEngineRunning;
      setIsEngineRunning(newState); // optimistic
      await campaignService.toggleEngineStatus(newState);
      toast.success(newState ? 'Campaign Engine Started' : 'Campaign Engine Paused');
    } catch (err) {
      toast.error('Failed to toggle engine status');
      setIsEngineRunning(!isEngineRunning); // revert
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
            Campaign Automation
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleEngine}
                className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 font-semibold transition-colors ${isEngineRunning
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                title="Toggle Master Engine Status"
              >
                <div className={`h-2 w-2 rounded-full ${isEngineRunning ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                {isEngineRunning ? 'ENGINE RUNNING' : 'ENGINE PAUSED'}
              </button>
              <button
                onClick={() => setIsEngineInfoModalOpen(true)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="How does the engine work?"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </h1>
          <p className="text-sm text-[#64748B]">Create, deploy, and monitor outreach campaigns.</p>
        </div>
        <button
          onClick={() => { setCurrentCampaign({ type: 'EMAIL', status: 'DRAFT' }); setIsFormOpen(true); }}
          className="btn-primary"
        >
          <Plus className="h-4.5 w-4.5" />
          Create Campaign
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: 'Active Campaigns', value: `${activeCount} Running` },
          { label: 'Total Campaigns', value: campaigns.length.toString() },
          { label: 'Latest Update', value: campaigns.length > 0 ? new Date(campaigns[0].updatedAt).toLocaleDateString() : 'N/A' },
        ].map((crd, i) => (
          <div key={i} className="card group">
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider group-hover:text-primary transition-colors">{crd.label}</p>
            <p className="text-2xl font-extrabold text-[#0F172A] mt-1.5">{crd.value}</p>
          </div>
        ))}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[#E2E8F0] p-4.5 bg-[#F8FAFC] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0F172A]">All Campaigns</h3>
          <div className="relative w-64">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base !pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px] w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-left" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-white">
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Campaign Name</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Target Segment</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Type</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider text-center">Connected Leads</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-[#64748B]">Loading campaigns...</td></tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-[#64748B]">No campaigns found.</td></tr>
              ) : (
                filteredCampaigns.map((camp) => (
                  <tr key={camp.id} className="group hover:bg-[#F8FAFC] transition-colors relative">
                    <td className="py-4 px-6">
                      <div 
                        className="flex items-center gap-3 cursor-pointer group-hover:text-primary transition-colors"
                        onClick={() => {
                          setSelectedCampaignForDrawer(camp);
                          setIsDrawerOpen(true);
                        }}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                          <Megaphone className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#0F172A] group-hover:text-indigo-600 transition-colors">{camp.name}</p>
                          <p className="text-xs text-slate-500 group-hover:text-indigo-400">View Details & Stats →</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-[#475569] bg-slate-100 px-2 py-1 rounded-md font-medium">
                        {camp.segments && camp.segments.length > 0
                          ? camp.segments.map(s => s.name).join(', ')
                          : 'Manual Selection'}
                      </span>
                    </td>
                    <td className="py-4 px-6"><span className="text-sm font-semibold text-[#0F172A]">{camp.type}</span></td>
                    <td className="py-4 px-6">
                      <span className={`badge-${camp.status === 'ACTIVE' ? 'success' : 'neutral'
                        }`}>
                        {camp.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                        <Users className="w-3.5 h-3.5" />
                        {camp._count?.leads || 0}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right relative">
                      <button
                        onClick={(e) => {
                          if (openMenuId === camp.id) {
                            setOpenMenuId(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const MENU_HEIGHT = isAdmin ? 170 : 130;
                            const GAP = 4;
                            const spaceBelow = window.innerHeight - rect.bottom;

                            let top;
                            if (spaceBelow < MENU_HEIGHT) {
                              // niche space nahi hai -> upar kholo
                              top = rect.top - MENU_HEIGHT - GAP;
                            } else {
                              // niche kholo
                              top = rect.bottom + GAP;
                            }

                            setMenuPos({
                              top,
                              right: window.innerWidth - rect.right,
                            });
                            setOpenMenuId(camp.id);
                          }
                        }}
                        className={`rounded-lg p-2 transition-colors ${openMenuId === camp.id ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {openMenuId === camp.id && createPortal(
                        <div
                          ref={menuRef}
                          style={{ top: menuPos.top, right: menuPos.right }}
                          className="fixed z-50 w-48 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
                        >
                          {isAdmin && (
                            <button onClick={() => toggleCampaignStatus(camp)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 border-b border-slate-100">
                              <div className={`h-2 w-2 rounded-full ${camp.status === 'ACTIVE' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                              {camp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          <button onClick={() => openManageLeads(camp)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <Users className="h-4 w-4" /> Add Leads
                          </button>
                          <button onClick={() => { setCurrentCampaign({ ...camp, segmentIds: camp.segments?.map(s => s.id) || [], leadIds: camp.leads?.map(l => l.id) || [] }); setIsFormOpen(true); setOpenMenuId(null); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <Edit2 className="h-4 w-4" /> Edit
                          </button>
                          <button onClick={() => handleDelete(camp.id)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 border-t border-slate-100">
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>,
                        document.body
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto border border-[#E2E8F0] bg-white rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-4">
              <h2 className="text-lg font-bold text-[#0F172A]">{currentCampaign.id ? 'Edit Campaign' : 'Create Campaign'}</h2>
              <button onClick={() => setIsFormOpen(false)} className="rounded-lg p-1 text-[#64748B] hover:bg-[#F8FAFC]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCampaign} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Campaign Name</label>
                <input type="text" required value={currentCampaign.name || ''} onChange={(e) => setCurrentCampaign({ ...currentCampaign, name: e.target.value })} className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Type</label>
                <select value={currentCampaign.type || 'EMAIL'} onChange={(e) => setCurrentCampaign({ ...currentCampaign, type: e.target.value })} className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Target Segments</label>
                <div className="flex flex-col gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 max-h-40 overflow-y-auto">
                  {segments.map(seg => (
                    <label key={seg.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(currentCampaign.segmentIds || []).includes(seg.id)}
                        onChange={(e) => {
                          const currentIds = currentCampaign.segmentIds || [];
                          if (e.target.checked) {
                            setCurrentCampaign({ ...currentCampaign, segmentIds: [...currentIds, seg.id] });
                          } else {
                            setCurrentCampaign({ ...currentCampaign, segmentIds: currentIds.filter((id: number) => id !== seg.id) });
                          }
                        }}
                      />
                      {seg.name}
                    </label>
                  ))}
                  {segments.length === 0 && <span className="text-xs text-slate-500">No segments available</span>}
                </div>
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Direct Leads (Optional)</label>
                <div className="relative mb-2">
                  <Search className="absolute top-1/2 left-3 h-3 w-3 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 max-h-40 overflow-y-auto">
                  {leadsLoading ? (
                    <div className="flex justify-center p-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                  ) : availableLeads.map(lead => (
                    <label key={lead.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(currentCampaign.leadIds || []).includes(lead.id)}
                        onChange={(e) => {
                          const currentIds = currentCampaign.leadIds || [];
                          if (e.target.checked) {
                            setCurrentCampaign({ ...currentCampaign, leadIds: [...currentIds, lead.id] });
                          } else {
                            setCurrentCampaign({ ...currentCampaign, leadIds: currentIds.filter((id: number) => id !== lead.id) });
                          }
                        }}
                      />
                      <span className="truncate">{lead.name} {lead.email ? `(${lead.email})` : ''}</span>
                    </label>
                  ))}
                  {!leadsLoading && availableLeads.length === 0 && <span className="text-xs text-slate-500">No leads found</span>}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Status</label>
                <select value={currentCampaign.status || 'DRAFT'} onChange={(e) => setCurrentCampaign({ ...currentCampaign, status: e.target.value })} className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
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
                    const id = e.target.value ? parseInt(e.target.value) : null;
                    if (currentCampaign.type === 'EMAIL') {
                      setCurrentCampaign({ ...currentCampaign, emailTemplateId: id });
                    } else if (currentCampaign.type === 'SMS') {
                      setCurrentCampaign({ ...currentCampaign, smsTemplateId: id });
                    } else {
                      setCurrentCampaign({ ...currentCampaign, whatsappTemplateId: id });
                    }
                  }} 
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select a template...</option>
                  {templates.filter(t => t.type === currentCampaign.type).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Select the content template to send to the leads.</p>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect Leads Modal */}
      {isLeadsModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl border border-[#E2E8F0] bg-white rounded-xl shadow-2xl p-6 relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Connect Leads to Campaign</h2>
                <p className="text-xs text-slate-500">Target Campaign: <strong className="text-primary">{currentCampaign.name}</strong></p>
              </div>
              <button onClick={() => setIsLeadsModalOpen(false)} className="rounded-lg p-1 text-[#64748B] hover:bg-[#F8FAFC]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Search leads by name, email, phone..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="input-base !pl-9"
                />
              </div>
              <select
                value={modalSalesStage}
                onChange={(e) => setModalSalesStage(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-primary"
              >
                <option value="">All Stages</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 border rounded-lg border-slate-200">
              {leadsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : availableLeads.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No available leads to add.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 sticky top-0 border-b">
                    <tr>
                      <th className="px-4 py-3"><input type="checkbox" onChange={(e) => {
                        if (e.target.checked) setSelectedLeadIds(new Set(availableLeads.map(l => l.id)));
                        else setSelectedLeadIds(new Set());
                      }} /></th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Sales Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {availableLeads.map(lead => (
                      <tr key={lead.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleLeadSelection(lead.id)}>
                        <td className="px-4 py-3"><input type="checkbox" checked={selectedLeadIds.has(lead.id)} readOnly /></td>
                        <td className="px-4 py-3 font-medium text-slate-800">{lead.name}</td>
                        <td className="px-4 py-3 text-slate-500">{lead.email || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold text-slate-600">{lead.salesStage}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-[#E2E8F0]">
              <span className="text-sm font-semibold text-slate-600">{selectedLeadIds.size} leads selected</span>
              <div className="flex gap-3">
                <button onClick={() => setIsLeadsModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>
                <button onClick={handleAddLeads} disabled={selectedLeadIds.size === 0} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Add Selected Leads
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Engine Info Modal */}
      {isEngineInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] p-6">
              <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-500" />
                How the Campaign Engine Works
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                  <button
                    onClick={() => setInfoLanguage('en')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${infoLanguage === 'en' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setInfoLanguage('hi')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${infoLanguage === 'hi' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Hindi
                  </button>
                </div>
                <button onClick={() => setIsEngineInfoModalOpen(false)} className="text-[#64748B] hover:text-[#0F172A] transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6 text-sm text-slate-600 max-h-[60vh] overflow-y-auto">
              {infoLanguage === 'en' ? (
                <div className="space-y-4 animate-fade-in">
                  <p>The <strong>Campaign Engine</strong> is an autonomous background worker that powers all outbound communication in AlgoConnect.</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Background Processing:</strong> It runs automatically every minute, scanning for campaigns with an <span className="font-semibold text-emerald-600">ACTIVE</span> status.</li>
                    <li><strong>Throttling:</strong> It dispatches max 50 messages/minute/campaign to prevent spamming.</li>
                    <li><strong>Compliance:</strong> It automatically checks DND and Opt-Out rules before sending.</li>
                    <li><strong>Master Switch:</strong> Pausing the engine instantly halts ALL outgoing messages globally.</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <p><strong>Campaign Engine</strong> AlgoConnect ka apna khud ka background robot (worker) hai jo saare messages bhejta hai.</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Background Processing:</strong> Ye robot har 1 minute baad check karta hai ki kya koi campaign <span className="font-semibold text-emerald-600">ACTIVE</span> hai? Agar haan, toh wo apne aap messages bhejna shuru kar deta hai.</li>
                    <li><strong>Throttling (Speed Control):</strong> Ye ek sath hazaron message bhejkar spam nahi karta. Ek minute me sirf 50 leads ko messages bheje jate hain.</li>
                    <li><strong>Compliance (Rules):</strong> Kisi ko message bhejne se pehle ye check karta hai ki usne DND (Do Not Disturb) toh on nahi kiya. Agar haan, toh ye us lead ko skip kar dega.</li>
                    <li><strong>Master Switch:</strong> Agar aap ise PAUSE kar dete hain, toh poore system me ek bhi message nahi jayega, chahe campaign ACTIVE hi kyun na ho.</li>
                  </ul>
                </div>
              )}
            </div>
            <div className="border-t border-[#E2E8F0] bg-slate-50 p-6 rounded-b-2xl flex justify-end">
              <button onClick={() => setIsEngineInfoModalOpen(false)} className="btn-primary">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      <Campaign360Drawer
        campaign={selectedCampaignForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedCampaignForDrawer(null);
        }}
      />
    </div>
  );
};
