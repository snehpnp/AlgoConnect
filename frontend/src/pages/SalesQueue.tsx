import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, CheckCircle2, AlertCircle, PhoneCall,
  Star, Calendar, User as UserIcon, ChevronRight,
  Loader2, RefreshCw, Phone, MessageSquare, Bell
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { leadsService } from '../services/leads.service';
import type { Lead } from '../services/leads.service';
import { Lead360Drawer } from '../components/Lead360Drawer';
import toast from 'react-hot-toast';

// Days since last contact
const daysSince = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const STAGE_COLORS: Record<string, string> = {
  'New': 'bg-slate-100 text-slate-600',
  'Contacted': 'bg-blue-100 text-blue-700',
  'Follow-up': 'bg-amber-100 text-amber-700',
  'Qualified': 'bg-emerald-100 text-emerald-700',
  'Negotiation': 'bg-purple-100 text-purple-700',
  'Client Won': 'bg-green-100 text-green-700',
};

export const SalesQueue = () => {
  const navigate = useNavigate();
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  const [overdueLeads, setOverdueLeads] = useState<Lead[]>([]);
  const [todaysFollowUps, setTodaysFollowUps] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'followups' | 'overdue'>('queue');
  const [markingId, setMarkingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [myRes, overdueRes, followupRes] = await Promise.all([
        leadsService.getLeads({ limit: 200, sortBy: 'leadScore', order: 'desc' }),
        apiClient.get('/follow-ups/overdue').then(r => r.data.data).catch(() => []),
        apiClient.get('/follow-ups/today').then(r => r.data.data).catch(() => []),
      ]);
      setMyLeads(myRes.data || []);
      setOverdueLeads(overdueRes || []);
      setTodaysFollowUps(followupRes || []);
    } catch {
      toast.error('Failed to load queue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkContacted = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setMarkingId(lead.id);
    try {
      await leadsService.updateLead(lead.id, { salesStage: 'Contacted' } as any);
      toast.success(`${lead.name} marked as Contacted ✓`);
      fetchData();
    } catch {
      toast.error('Failed to update');
    } finally {
      setMarkingId(null);
    }
  };

  const stats = [
    {
      label: 'My Total Leads',
      value: myLeads.length,
      icon: UserIcon,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: "Today's Follow-Ups",
      value: todaysFollowUps.length,
      icon: Calendar,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Overdue Follow-Ups',
      value: overdueLeads.length,
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Client Won',
      value: myLeads.filter(l => l.salesStage === 'Client Won').length,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  const currentList = activeTab === 'queue' ? myLeads
    : activeTab === 'followups' ? todaysFollowUps
    : overdueLeads;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500" />
            My Sales Queue
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Your personalized leads dashboard — focus, contact, convert.</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg px-4 py-2 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4">
        {[
          { key: 'queue', label: 'All My Leads', count: myLeads.length },
          { key: 'followups', label: "Today's Follow-Ups", count: todaysFollowUps.length },
          { key: 'overdue', label: 'Overdue', count: overdueLeads.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-3.5 text-sm font-bold border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Lead List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : currentList.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700">All clear!</h3>
          <p className="text-sm text-slate-400 mt-1">No leads in this section right now.</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {currentList.map((lead) => {
              const daysSinceContact = daysSince(lead.lastContactedAt || lead.updatedAt);
              const isStale = (daysSinceContact ?? 0) > 7;
              const isOverdue = lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date();

              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="group flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
                    lead.salesStage === 'Client Won' ? 'bg-emerald-100 text-emerald-700'
                    : isStale ? 'bg-red-100 text-red-600'
                    : 'bg-blue-100 text-blue-700'
                  }`}>
                    {lead.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Lead Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 truncate">{lead.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_COLORS[lead.salesStage] || 'bg-slate-100 text-slate-600'}`}>
                        {lead.salesStage}
                      </span>
                      {isStale && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertCircle className="h-2.5 w-2.5" /> {daysSinceContact}d inactive
                        </span>
                      )}
                      {isOverdue && (
                        <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Bell className="h-2.5 w-2.5" /> Follow-up overdue
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                      {lead.city && <span>{lead.city}</span>}
                      {lead.nextFollowUpAt && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Calendar className="h-3 w-3" />
                          {new Date(lead.nextFollowUpAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lead Score */}
                  <div className="hidden sm:flex flex-col items-center shrink-0">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">{lead.leadScore ?? 0}</span>
                    </div>
                    <span className="text-[9px] text-slate-400">Score</span>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.phone && (
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(lead.name)},`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
                        title="WhatsApp"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                    )}
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={e => e.stopPropagation()}
                        className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                        title="Call"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {lead.salesStage !== 'Contacted' && lead.salesStage !== 'Client Won' && (
                      <button
                        onClick={(e) => handleMarkContacted(lead, e)}
                        disabled={markingId === lead.id}
                        className="hidden sm:flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        title="Mark as Contacted"
                      >
                        {markingId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <PhoneCall className="h-3 w-3" />}
                        <span>Contacted</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/leads/${lead.id}`); }}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lead 360 Drawer */}
      <Lead360Drawer
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        lead={selectedLead}
        onEdit={(updated) => {
          setSelectedLead(updated);
          fetchData();
        }}
      />
    </div>
  );
};
