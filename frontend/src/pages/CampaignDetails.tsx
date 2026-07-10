import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Megaphone, Plus, Trash2, Edit2, Zap, Clock, ArrowRight } from 'lucide-react';
import { campaignService, type Campaign } from '../services/campaign.service';
import { automationService, type CampaignAutomation } from '../services/automation.service';
import toast from 'react-hot-toast';

export const CampaignDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [automations, setAutomations] = useState<CampaignAutomation[]>([]);
  const [stats, setStats] = useState<any>({ sends: [], engagements: [] });
  const [loading, setLoading] = useState(true);

  // Automation Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentAutomation, setCurrentAutomation] = useState<Partial<CampaignAutomation>>({ status: 'ACTIVE' });
  const [infoLanguage, setInfoLanguage] = useState<'en' | 'hi'>('hi');

  const fetchData = async () => {
    if (!id) return;
    try {
      const [campRes, autoRes, statsRes] = await Promise.all([
        campaignService.getCampaignById(Number(id)),
        automationService.getAutomations(Number(id)),
        campaignService.getCampaignStats(Number(id))
      ]);
      setCampaign(campRes.data);
      setAutomations(autoRes.data || []);
      setStats(statsRes.data || { sends: [], engagements: [] });
    } catch (err) {
      toast.error('Failed to load campaign details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign?.id) return;
    
    try {
      if (currentAutomation.id) {
        await automationService.updateAutomation(currentAutomation.id, currentAutomation);
        toast.success('Automation updated successfully');
      } else {
        await automationService.createAutomation({ ...currentAutomation, campaignId: campaign.id });
        toast.success('Automation created successfully');
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save automation');
    }
  };

  const handleDeleteAutomation = async (autoId: number) => {
    if (!window.confirm('Delete this automation rule?')) return;
    try {
      await automationService.deleteAutomation(autoId);
      toast.success('Automation deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete automation');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading campaign details...</div>;
  }

  if (!campaign) {
    return <div className="p-8 text-center text-red-500">Campaign not found.</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in relative pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => navigate('/campaigns')}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] w-fit transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </button>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Megaphone className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
              {campaign.name}
            </h1>
            <span className={`badge-${
              campaign.status === 'ACTIVE' ? 'success' : 'neutral'
            } ml-2`}>
              {campaign.status}
            </span>
          </div>
          {campaign.description && (
            <p className="text-[#64748B] text-sm mt-1">{campaign.description}</p>
          )}
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4 uppercase tracking-wider">Campaign Info</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Target Segment</p>
                <p className="text-sm font-medium text-slate-800">{campaign.segment?.name || 'Manual Selection'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Primary Channel Type</p>
                <p className="text-sm font-medium text-slate-800">{campaign.type}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Total Leads</p>
                <p className="text-sm font-medium text-slate-800">{campaign._count?.leads || 0} Leads Connected</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Created On</p>
                <p className="text-sm font-medium text-slate-800">{new Date(campaign.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4 uppercase tracking-wider">Performance Stats</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Messages Sent</p>
                <p className="text-sm font-medium text-slate-800">
                  {stats.engagements?.find((e: any) => e.eventType === 'SENT' || e.eventType === 'DELIVERED')?._count?.eventType || 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Failed</p>
                <p className="text-sm font-medium text-slate-800 text-red-500">
                  {stats.engagements?.find((e: any) => e.eventType === 'FAILED')?._count?.eventType || 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Total Opens</p>
                <p className="text-sm font-medium text-slate-800">
                  {stats.engagements?.find((e: any) => e.eventType === 'OPENED')?._count?.eventType || 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Total Clicks</p>
                <p className="text-sm font-medium text-slate-800">
                  {stats.engagements?.find((e: any) => e.eventType === 'CLICKED')?._count?.eventType || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Automations */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card !p-0 overflow-hidden">
            <div className="border-b border-[#E2E8F0] p-5 bg-[#F8FAFC] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  Automation Sequence
                </h3>
                <p className="text-xs text-slate-500 mt-1">Define the automated follow-up steps for this campaign.</p>
              </div>
              <button 
                onClick={() => { setCurrentAutomation({ status: 'ACTIVE' }); setIsFormOpen(true); }}
                className="btn-primary"
              >
                <Plus className="h-4 w-4" />
                Add Step
              </button>
            </div>

            <div className="p-6">
              {automations.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                  <Zap className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700">No automation steps yet.</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Create your first step to automate follow-ups.</p>
                  <button 
                    onClick={() => { setCurrentAutomation({ status: 'ACTIVE' }); setIsFormOpen(true); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" /> Add First Step
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {automations.map((step, index) => (
                    <div key={step.id} className="relative flex items-start gap-4">
                      {/* Connection Line */}
                      {index !== automations.length - 1 && (
                        <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-slate-200"></div>
                      )}
                      
                      {/* Icon */}
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border-2 border-primary shadow-sm text-primary">
                        {index + 1}
                      </div>

                      {/* Content Card */}
                      <div className="flex-1 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-[#0F172A]">{step.name}</h4>
                            <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-600">
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-slate-700">
                                <Clock className="h-3 w-3 text-slate-500" />
                                {step.waitTime ? `Wait ${step.waitTime} days` : 'Immediately'}
                              </span>
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                              <span className="inline-flex items-center gap-1 bg-blue-50 px-2 py-1 rounded text-blue-700">
                                {step.trigger}
                              </span>
                              {step.condition && (
                                <>
                                  <ArrowRight className="h-3 w-3 text-slate-400" />
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded text-emerald-700">
                                    If: {step.condition}
                                  </span>
                                </>
                              )}
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                              <span className="inline-flex items-center gap-1 bg-purple-50 px-2 py-1 rounded text-purple-700">
                                {step.action}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => { setCurrentAutomation(step); setIsFormOpen(true); }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                              title="Edit Step"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteAutomation(step.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete Step"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Automation Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl border border-[#E2E8F0] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
            
            {/* Left Side: Form */}
            <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto">
              <h2 className="text-lg font-bold text-[#0F172A] mb-4 border-b border-[#E2E8F0] pb-4">
                {currentAutomation.id ? 'Edit Automation Step' : 'Add Automation Step'}
              </h2>
              <form onSubmit={handleSaveAutomation} className="space-y-4 flex-1 flex flex-col">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Step Name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Day 3 Follow-up"
                      value={currentAutomation.name || ''} 
                      onChange={(e) => setCurrentAutomation({ ...currentAutomation, name: e.target.value })} 
                      className="input-base w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Trigger *</label>
                      <select 
                        required 
                        value={currentAutomation.trigger || ''} 
                        onChange={(e) => setCurrentAutomation({ ...currentAutomation, trigger: e.target.value })} 
                        className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="">-- Select --</option>
                        <option value="Campaign Started">Campaign Started</option>
                        <option value="Email Delivered">Email Delivered</option>
                        <option value="Email Opened">Email Opened</option>
                        <option value="WhatsApp Read">WhatsApp Read</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Wait Time (Days)</label>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0 = Immediate"
                        value={currentAutomation.waitTime ?? ''} 
                        onChange={(e) => setCurrentAutomation({ ...currentAutomation, waitTime: e.target.value ? parseInt(e.target.value) : 0 })} 
                        className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Condition</label>
                    <select 
                      value={currentAutomation.condition || ''} 
                      onChange={(e) => setCurrentAutomation({ ...currentAutomation, condition: e.target.value || null })} 
                      className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="">No specific condition</option>
                      <option value="Opened">Opened</option>
                      <option value="Not Opened">Not Opened</option>
                      <option value="Replied">Replied</option>
                      <option value="No Reply">No Reply</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Action *</label>
                    <select 
                      required 
                      value={currentAutomation.action || ''} 
                      onChange={(e) => setCurrentAutomation({ ...currentAutomation, action: e.target.value })} 
                      className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="">-- Select --</option>
                      <option value="Send Email">Send Email</option>
                      <option value="Send WhatsApp">Send WhatsApp</option>
                      <option value="Assign Sales Rep">Assign Sales Rep</option>
                      <option value="Stop Campaign">Stop Campaign</option>
                    </select>
                  </div>
                </div>
                
                <div className="pt-4 flex justify-end gap-3 border-t border-[#E2E8F0] mt-6">
                  <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>
                  <button type="submit" className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white">Save Step</button>
                </div>
              </form>
            </div>

            {/* Right Side: Guide */}
            <div className="w-full md:w-1/2 bg-slate-50 border-l border-[#E2E8F0] p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  How this works
                </h3>
                <div className="flex items-center bg-white rounded-lg p-1 border border-slate-200">
                  <button
                    onClick={() => setInfoLanguage('en')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${infoLanguage === 'en' ? 'bg-slate-100 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setInfoLanguage('hi')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${infoLanguage === 'hi' ? 'bg-slate-100 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Hindi
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto text-sm text-slate-600 space-y-4 pr-2">
                {infoLanguage === 'hi' ? (
                  <div className="space-y-4 animate-fade-in">
                    <p>Ye modal <strong>Drip Campaign</strong> ya <strong>Auto Follow-up</strong> sequence banane ke kaam aata hai.</p>
                    <div className="space-y-3">
                      <div>
                        <strong className="text-slate-800">1. Step Name:</strong> 
                        <p className="mt-0.5">Aapki pehchan ke liye naam (Jaise: Day 3 Reminder).</p>
                      </div>
                      <div>
                        <strong className="text-slate-800">2. Trigger (Kab shuru hoga?):</strong> 
                        <p className="mt-0.5">Ye batata hai ki ye step kis event ke baad chalu hoga. Jaise "Email Delivered" matlab jab pichla email deliver ho jaye.</p>
                      </div>
                      <div>
                        <strong className="text-slate-800">3. Wait Time (Kitne din rukna hai?):</strong> 
                        <p className="mt-0.5">Trigger hone ke baad kitne din wait karna hai. <strong>0</strong> likha toh turant action hoga. <strong>2</strong> likha toh 2 din baad action hoga.</p>
                      </div>
                      <div>
                        <strong className="text-slate-800">4. Condition (Kisko bhejna hai?):</strong> 
                        <p className="mt-0.5">Ye ek filter hai. Agar <strong>"Not Opened"</strong> lagaya, toh system sirf unhe agla message bhejega jinhone pichla message nahi khola.</p>
                      </div>
                      <div>
                        <strong className="text-slate-800">5. Action (Kya karna hai?):</strong> 
                        <p className="mt-0.5">Akhir me kya karna hai? Naya Email/WhatsApp bhejna hai, ya Sales Team ko call ke liye lead assign karni hai.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <p>Use this form to build <strong>Drip Campaigns</strong> or <strong>Auto Follow-ups</strong>.</p>
                    <div className="space-y-3">
                      <div>
                        <strong className="text-slate-800">1. Step Name:</strong> 
                        <p className="mt-0.5">For your reference only (e.g., Day 3 Reminder).</p>
                      </div>
                      <div>
                        <strong className="text-slate-800">2. Trigger:</strong> 
                        <p className="mt-0.5">When should this step activate? E.g., "Email Delivered" activates this step after the previous email is delivered.</p>
                      </div>
                      <div>
                        <strong className="text-slate-800">3. Wait Time (Days):</strong> 
                        <p className="mt-0.5">Delay after the trigger. Enter <strong>0</strong> for immediate execution, or <strong>2</strong> to wait 2 days before taking action.</p>
                      </div>
                      <div>
                        <strong className="text-slate-800">4. Condition:</strong> 
                        <p className="mt-0.5">Acts as a filter. If you select <strong>"Not Opened"</strong>, this step will only execute for leads who ignored the previous message.</p>
                      </div>
                      <div>
                        <strong className="text-slate-800">5. Action:</strong> 
                        <p className="mt-0.5">The final task to perform. Send another message, or assign the lead to your Sales Team for a manual follow-up.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
