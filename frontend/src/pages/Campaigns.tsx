import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Search, MoreVertical, Edit2, Trash2, Users, X, Loader2, Info, Settings, Mail } from 'lucide-react';
import { campaignService, type Campaign } from '../services/campaign.service';
import { leadsService, type Lead } from '../services/leads.service';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Campaign360Drawer } from '../components/Campaign360Drawer';

export const Campaigns: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'System Admin';
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isEngineRunning, setIsEngineRunning] = useState(true);
  const [isEngineInfoModalOpen, setIsEngineInfoModalOpen] = useState(false);
  const [infoLanguage, setInfoLanguage] = useState<'en' | 'hi'>('hi');

  // Modals state
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<Partial<Campaign>>({});

  // Connected Leads Modal
  const [isConnectedLeadsModalOpen, setIsConnectedLeadsModalOpen] = useState(false);
  const [connectedLeads, setConnectedLeads] = useState<any[]>([]);
  const [connectedLeadsLoading, setConnectedLeadsLoading] = useState(false);

  // Reply Modal
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [currentReply, setCurrentReply] = useState<any>(null);

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

  const fetchCampaigns = async () => {
    try {
      const [campRes, engineRes] = await Promise.all([
        campaignService.getCampaigns(),
        campaignService.getEngineStatus()
      ]);
      setCampaigns(campRes.data || []);
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
    setOpenMenuId(null);
    setIsLeadsModalOpen(true);
    setModalSearch('');
    setModalSalesStage('');

    // Fetch full campaign details to get already connected leads
    try {
      setLeadsLoading(true);
      const campRes = await campaignService.getCampaignById(campaign.id);
      setCurrentCampaign(campRes.data);
      const existingLeadIds = campRes.data.leads?.map((l: any) => l.id) || [];
      setSelectedLeadIds(new Set(existingLeadIds));
    } catch (error) {
      toast.error('Failed to load campaign details');
      setSelectedLeadIds(new Set());
    }

    await fetchModalLeads();
  };

  // Debounced search for Modal
  useEffect(() => {
    if (!isLeadsModalOpen) return;
    const delayDebounceFn = setTimeout(() => {
      fetchModalLeads(modalSearch, modalSalesStage);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [modalSearch, modalSalesStage, isLeadsModalOpen]);

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

  const openConnectedLeadsModal = async (campaign: Campaign) => {
    setCurrentCampaign(campaign);
    setIsConnectedLeadsModalOpen(true);
    setConnectedLeadsLoading(true);
    try {
      const res = await campaignService.getCampaignConnectedLeads(campaign.id);
      setConnectedLeads(res.data || []);
    } catch (err) {
      toast.error('Failed to load connected leads');
    } finally {
      setConnectedLeadsLoading(false);
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
          onClick={() => navigate('/campaigns/create')}
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
          <table className="w-full text-left" style={{ minWidth: '700px', zIndex: -1 }}>
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
                      <button
                        onClick={() => openConnectedLeadsModal(camp)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {camp._count?.leads || 0}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === camp.id ? null : camp.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {openMenuId === camp.id && (
                        <div className="absolute right-8 top-10 z-10 w-48 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                          {isAdmin && (
                            <button onClick={() => toggleCampaignStatus(camp)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 border-b border-slate-100">
                              <div className={`h-2 w-2 rounded-full ${camp.status === 'ACTIVE' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                              {camp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          <button onClick={() => openManageLeads(camp)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <Users className="h-4 w-4" /> Add Leads
                          </button>
                          <button onClick={() => navigate(`/campaigns/${camp.id}/edit`)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <Edit2 className="h-4 w-4" /> Edit
                          </button>
                          <button onClick={() => handleDelete(camp.id)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 border-t border-slate-100">
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Connected Leads Modal */}
      {isConnectedLeadsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-scale-up">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Connected Leads</h2>
                <p className="text-sm text-slate-500 mt-1">{currentCampaign?.name}</p>
              </div>
              <button onClick={() => setIsConnectedLeadsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {connectedLeadsLoading ? (
                <div className="py-12 flex justify-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : connectedLeads.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-medium">No leads connected to this campaign.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Name</th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Contact</th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Last Updated</th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {connectedLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">{lead.name}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            <div>{lead.email || 'No email'}</div>
                            <div className="text-xs text-slate-400">{lead.phone || 'No phone'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${lead.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                                lead.status === 'DELIVERED' ? 'bg-indigo-100 text-indigo-700' :
                                  lead.status === 'OPENED' ? 'bg-purple-100 text-purple-700' :
                                    lead.status === 'REPLIED' ? 'bg-emerald-100 text-emerald-700' :
                                      lead.status === 'FAILED' ? 'bg-rose-100 text-rose-700' :
                                        'bg-slate-100 text-slate-700'
                              }`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-500">
                            {lead.lastInteractionAt ? new Date(lead.lastInteractionAt).toLocaleString() : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {lead.status === 'REPLIED' && lead.latestReply && (
                              <button
                                onClick={() => {
                                  setCurrentReply(lead.latestReply);
                                  setReplyModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                View Reply
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button onClick={() => setIsConnectedLeadsModalOpen(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* View Reply Modal */}
      {replyModalOpen && currentReply && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-500" />
                Reply from Client
              </h2>
              <button onClick={() => setReplyModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto bg-slate-50">
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-4">
                <div className="text-sm text-slate-500 mb-1">From: <span className="font-medium text-slate-800">{currentReply.fromEmail}</span></div>
                <div className="text-sm text-slate-500 mb-3">Subject: <span className="font-medium text-slate-800">{currentReply.subject || 'No Subject'}</span></div>
                <div className="text-sm text-slate-500 border-b border-slate-100 pb-2 mb-3">Date: {new Date(currentReply.receivedAt).toLocaleString()}</div>

                <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed font-sans">
                  {currentReply.body}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCampaignForDrawer && (
        <Campaign360Drawer
          campaign={selectedCampaignForDrawer}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedCampaignForDrawer(null);
          }}
        />
      )}

    </div>
  );
};
