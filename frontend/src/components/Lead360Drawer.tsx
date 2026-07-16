import { useState, useEffect } from 'react';
import {
  X, Mail, Phone as PhoneIcon, MapPin, Clock,
  CheckCircle2, Sparkles, ArrowRight, Globe,
  Link as LinkIcon, Briefcase, AlertCircle, Edit2
} from 'lucide-react';
import type { Lead } from '../services/leads.service';
import { leadsService, getUnifiedStatus } from '../services/leads.service';
import { apiClient } from '../services/apiClient';

interface Lead360DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onEdit: (lead: Lead) => void;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(d);
};

const getLeadScore = (lead: any) => lead.leadScore || 0;

export const Lead360Drawer = ({ isOpen, onClose, lead, onEdit }: Lead360DrawerProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'enrichment' | 'email'>('details');
  const [logs, setLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    if (isOpen && lead) {
      setActiveTab('details');
      setIsLoadingLogs(true);
      Promise.all([
        leadsService.getLeadLogs(lead.id).catch(() => []),
        apiClient.get(`/messages/leads/${lead.id}`).then(res => res.data.data).catch(() => [])
      ])
        .then(([logsRes, emailRes]) => {
          setLogs(logsRes);
          setEmailLogs(emailRes);
        })
        .finally(() => setIsLoadingLogs(false));
    } else {
      setLogs([]);
      setEmailLogs([]);
    }
  }, [isOpen, lead]);

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl transition-transform duration-300 transform translate-x-0">

        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm z-10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Lead 360 View
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              Complete details and history for this lead
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Profile Section */}
          <div className="flex items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            {lead.logoUrl ? (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl overflow-hidden ring-1 ring-inset ring-slate-200 bg-white">
                <img src={lead.logoUrl} alt={lead.name} className="h-full w-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = `<div class="flex h-16 w-16 items-center justify-center bg-blue-50 text-blue-600 font-bold text-xl">${lead.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>` }} />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold text-2xl ring-1 ring-inset ring-blue-100">
                {lead.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <a
                  href={lead.website ? lead.website : `https://www.google.com/search?q=${encodeURIComponent(lead.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block min-w-0"
                  title="Click to search on Google"
                >
                  <h3 className="text-xl font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors cursor-pointer">{lead.name}</h3>
                </a>
                <div className="flex gap-2 shrink-0">
                  {(() => {
                    const status = getUnifiedStatus(lead);
                    let colorClass = 'bg-slate-100 text-slate-700 ring-slate-500/10';
                    
                    if (['Client Won', 'Qualified', 'Converted / Closed'].includes(status)) colorClass = 'bg-emerald-50 text-emerald-700 ring-emerald-600/10';
                    else if (['Replied', 'Demo Requested', 'Negotiation'].includes(status)) colorClass = 'bg-purple-50 text-purple-700 ring-purple-600/10';
                    else if (['Opened', 'Clicked', 'Contacted'].includes(status)) colorClass = 'bg-blue-50 text-blue-700 ring-blue-600/10';
                    else if (['Active'].includes(status)) colorClass = 'bg-teal-50 text-teal-700 ring-teal-600/10';
                    else if (['Enriched', 'Imported'].includes(status)) colorClass = 'bg-slate-50 text-slate-700 ring-slate-600/10';
                    else if (['Client Lost', 'Likely Inactive'].includes(status)) colorClass = 'bg-red-50 text-red-700 ring-red-600/10';
                    else if (status === 'Unverified') colorClass = 'bg-amber-50 text-amber-700 ring-amber-600/10';

                    return (
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${colorClass}`}>
                        {status}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-1">Lead ID: <span className="font-medium text-slate-700">{lead.id}</span></p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('enrichment')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'enrichment' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              Scraped Data
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              Activity History
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'email' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              Email History
            </button>

          </div>

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Email</p>
                  <p className="text-sm font-medium text-slate-900 truncate mt-0.5">{lead.email || '—'}</p>
                  {lead.email2 && <p className="text-sm font-medium text-slate-900 truncate mt-1">{lead.email2}</p>}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <PhoneIcon className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Phone</p>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.phone || '—'}</p>
                  {lead.phone2 && <p className="text-sm font-medium text-slate-900 mt-1">{lead.phone2}</p>}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Type</p>
                  <span className="inline-flex items-center mt-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {lead.type?.includes('(') ? lead.type.split('(')[1].replace(')', '') : lead.type || 'Manual'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Source & Reg No.</p>
                  {lead.registrationNo && (
                    <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 mt-1 mb-1 ring-1 ring-inset ring-indigo-700/10">
                      {lead.registrationNo}
                    </span>
                  )}
                  <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.source || 'Manual'}</p>
                </div>
              </div>

              {(lead.address || lead.city) && (
                <div className="flex items-start gap-3 col-span-1 sm:col-span-2">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Address</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5 leading-relaxed">{[lead.address, lead.city, lead.state, lead.pincode].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              )}

              {lead.contactPerson && (
                <div className="flex items-start gap-3">
                  <PhoneIcon className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Contact Person</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.contactPerson}</p>
                  </div>
                </div>
              )}

              {lead.validity && (
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Validity</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.validity}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 col-span-1 sm:col-span-2">
                <CheckCircle2 className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">System Statuses</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {lead.status && <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/10">Base: {lead.status}</span>}
                    {lead.engagementStatus && <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/10">Engagement: {lead.engagementStatus}</span>}
                    {lead.consentStatus && <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/10">Consent: {lead.consentStatus}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Lead Score</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-bold text-slate-700 w-5">{getLeadScore(lead)}</span>
                    <div className="h-1.5 w-full rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                        style={{ width: `${getLeadScore(lead)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Timeline</p>
                  <p className="text-[13px] font-medium text-slate-900 mt-0.5">Created: {formatDate(lead.createdAt)}</p>
                  {lead.updatedAt && <p className="text-[13px] font-medium text-slate-900 mt-0.5">Updated: {formatDate(lead.updatedAt)}</p>}
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm font-medium text-slate-500">Loading history...</span>
                </div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No activity history found for this lead.</p>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-4">
                  {logs.map((log) => (
                    <div key={log.id} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-2 border-primary" />
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-slate-800">{log.action.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-medium text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{log.details}</p>
                      {log.changes && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          {Object.entries(JSON.parse(log.changes)).map(([field, vals]: any) => (
                            <div key={field} className="flex items-center text-xs mb-1 last:mb-0">
                              <span className="font-semibold text-slate-700 w-32 capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="text-slate-500 bg-white border px-1.5 py-0.5 rounded mr-2 line-through">{vals.from}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400 mr-2" />
                              <span className="text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded font-medium">{vals.to}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Email History Tab */}
          {activeTab === 'email' && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
              ) : emailLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No email history available for this lead.
                </div>
              ) : (
                <div className="space-y-4">
                  {emailLogs.map((msg) => (
                    <div key={msg.id} className="p-4 border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow relative">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{msg.subject || '(No Subject)'}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Campaign: {msg.campaign?.name}</p>
                        </div>
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${msg.status === 'REPLIED' ? 'bg-green-100 text-green-700' : msg.status === 'CLICKED' ? 'bg-purple-100 text-purple-700' : msg.status === 'OPENED' ? 'bg-emerald-100 text-emerald-700' : msg.status === 'DELIVERED' ? 'bg-cyan-100 text-cyan-700' : msg.status === 'QUEUED' || msg.status === 'SENT' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {msg.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100">
                        <div className="text-xs text-slate-500">
                          <span className="block font-medium text-slate-400 uppercase text-[9px] tracking-wider">Sent</span>
                          {formatDate(msg.sentAt) || '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="block font-medium text-slate-400 uppercase text-[9px] tracking-wider">Opened</span>
                          {formatDate(msg.openedAt) || '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="block font-medium text-slate-400 uppercase text-[9px] tracking-wider">Clicked</span>
                          {formatDate(msg.clickedAt) || '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="block font-medium text-slate-400 uppercase text-[9px] tracking-wider">Replied</span>
                          {formatDate(msg.repliedAt) || '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enrichment Tab */}
          {activeTab === 'enrichment' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${lead.isEnriched ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                  {lead.isEnriched ? '✓ Data Enriched' : '⏳ Pending Enrichment'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6 bg-white rounded-xl p-5 border border-slate-200 shadow-sm">

                {lead.website && (
                  <div className="flex items-start gap-3 col-span-1 sm:col-span-2">
                    <Globe className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Website</p>
                      <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline mt-0.5 break-all block">{lead.website}</a>
                    </div>
                  </div>
                )}

                {(lead as any).scrapedEmail && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Scraped Email</p>
                      <a href={`mailto:${(lead as any).scrapedEmail}`} className="text-sm font-medium text-blue-600 hover:underline mt-0.5 break-all block">{(lead as any).scrapedEmail}</a>
                    </div>
                  </div>
                )}

                {(lead as any).scrapedPhone && (
                  <div className="flex items-start gap-3">
                    <PhoneIcon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Scraped Phone</p>
                      <a href={`tel:${(lead as any).scrapedPhone}`} className="text-sm font-medium text-blue-600 hover:underline mt-0.5 block">{(lead as any).scrapedPhone}</a>
                    </div>
                  </div>
                )}

                {(lead.linkedin || lead.twitter || lead.facebook) && (
                  <div className="flex items-start gap-3">
                    <LinkIcon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Social Links</p>
                      <div className="mt-1.5 space-y-1.5">
                        {lead.linkedin && <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-700 hover:underline block">LinkedIn ↗</a>}
                        {lead.twitter && <a href={lead.twitter} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-400 hover:underline block">Twitter/X ↗</a>}
                        {lead.facebook && <a href={lead.facebook} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline block">Facebook ↗</a>}
                      </div>
                    </div>
                  </div>
                )}

                {lead.companySizeEstimate && lead.companySizeEstimate !== 'Unknown' && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Company Size</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.companySizeEstimate}</p>
                    </div>
                  </div>
                )}

                {lead.sellsAlgoTrading && lead.sellsAlgoTrading !== 'Unknown' && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sells Algo Trading?</p>
                      <span className={`inline-flex items-center mt-1 rounded-md px-2 py-0.5 text-xs font-semibold ${lead.sellsAlgoTrading === 'Yes' ? 'bg-emerald-100 text-emerald-800' :
                        lead.sellsAlgoTrading === 'No' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{lead.sellsAlgoTrading}</span>
                    </div>
                  </div>
                )}

                {lead.enrichmentNotes && (
                  <div className="flex items-start gap-3 col-span-1 sm:col-span-2">
                    <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${lead.enrichmentNotes.startsWith('[SCRAPE_FAILED]') ? 'text-red-500' : 'text-amber-500'}`} />
                    <div className={`min-w-0 flex-1 rounded-lg p-3 border ${lead.enrichmentNotes.startsWith('[SCRAPE_FAILED]') ? 'bg-red-50 border-red-100 text-red-900' : 'bg-amber-50 border-amber-100 text-amber-900'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${lead.enrichmentNotes.startsWith('[SCRAPE_FAILED]') ? 'text-red-700' : 'text-amber-800'}`}>Enrichment Notes</p>
                      <p className="text-sm leading-relaxed break-words">{lead.enrichmentNotes.replace('[SCRAPE_FAILED] ', '')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-slate-200 bg-white p-4 flex items-center justify-end gap-3 z-10">
          <button
            onClick={() => {
              onClose();
              onEdit(lead);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
            Edit Lead
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-primary text-white px-6 py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
          >
            Close
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
