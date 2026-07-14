import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, Loader2, AlertCircle, Mail, MessageSquare, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { LeadWithConsents } from '../services/consent.service';
import { consentService } from '../services/consent.service';

const buildPageList = (current: number, total: number): (number | 'ellipsis')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('ellipsis');
    result.push(p);
    prev = p;
  }
  return result;
};

export const ConsentManagement = () => {
  const [leads, setLeads] = useState<LeadWithConsents[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New States
  const [page, setPage] = useState(1);
  const [dncFilter, setDncFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [consentFilter, setConsentFilter] = useState('All');
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 50;

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const response = await consentService.getConsents({
        search: searchQuery || undefined,
        page,
        limit: PAGE_SIZE,
        dncFilter: dncFilter === 'All' ? undefined : dncFilter,
        typeFilter: typeFilter === 'All' ? undefined : typeFilter,
        consentFilter: consentFilter === 'All' ? undefined : consentFilter
      });
      setLeads(response.data);
      if (response.pagination) {
        setTotalRecords(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
      }
    } catch (err) {
      toast.error('Failed to load consent data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, dncFilter, typeFilter, consentFilter]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset page on search
  };

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1); // Reset page on new search
      fetchLeads();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const toggleConsent = async (leadId: number, channel: string, currentStatus: string) => {
    const newStatus = currentStatus === 'OPT_IN' ? 'OPT_OUT' : 'OPT_IN';
    try {
      // Optimistic update
      setLeads(prevLeads => {
        const leadIndex = prevLeads.findIndex(l => l.id === leadId);
        if (leadIndex === -1) return prevLeads;
        
        const lead = prevLeads[leadIndex];
        const consents = [...lead.consents];
        const consentIndex = consents.findIndex(c => c.channel === channel);
        
        if (consentIndex >= 0) {
          consents[consentIndex] = { ...consents[consentIndex], status: newStatus };
        } else {
          consents.push({ id: 0, leadId, channel, status: newStatus });
        }
        
        const updatedLead = { ...lead, consents };
        const newLeads = [...prevLeads];
        newLeads.splice(leadIndex, 1);
        newLeads.unshift(updatedLead);
        
        return newLeads;
      });

      await consentService.updateConsent(leadId, channel, newStatus);
      toast.success(`${channel} consent updated`);
    } catch (err) {
      toast.error('Failed to update consent');
      fetchLeads(); // Revert on failure
    }
  };

  const getConsentStatus = (lead: LeadWithConsents, channel: string) => {
    const consent = lead.consents?.find(c => c.channel === channel);
    return consent?.status === 'OPT_IN' ? 'OPT_IN' : 'OPT_OUT';
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      case 'SMS': return <Smartphone className="h-4 w-4" />;
      case 'WHATSAPP': return <MessageSquare className="h-4 w-4" />;
      default: return null;
    }
  };

  const rangeStart = totalRecords === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalRecords);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Consent Management
          </h1>
          <p className="text-sm text-[#64748B]">
            Manage Do Not Contact (DNC) lists and opt-in status across all communication channels.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search by name, email, phone, city, state..."
            value={searchQuery}
            onChange={handleSearch}
            className="input-base !pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
          >
            <option value="All">All Types</option>
            <option value="Manual">Manual</option>
            <option value="API">API</option>
            <option value="Imported">Imported</option>
          </select>
          
          <select
            value={consentFilter}
            onChange={(e) => { setConsentFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
          >
            <option value="All">All Consents</option>
            <option value="Selected">Selected</option>
            <option value="Not Selected">Not Selected</option>
          </select>

          <select
            value={dncFilter}
            onChange={(e) => { setDncFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
          >
            <option value="All">All Statuses</option>
            <option value="Allowed">Allowed</option>
            <option value="DNC Active">DNC Active</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="card !p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium mt-3">Loading records...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No leads found</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting your search criteria.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-[#F8FAFC] text-xs font-bold uppercase text-[#64748B]">
                  <tr>
                    <th className="px-6 py-4 w-16">Id</th>
                    <th className="px-6 py-4">Lead Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Contact Info</th>
                    <th className="px-6 py-4 text-center">Do Not Contact</th>
                    <th className="px-6 py-4 text-center">Email Consent</th>
                    <th className="px-6 py-4 text-center">SMS Consent</th>
                    <th className="px-6 py-4 text-center">WhatsApp Consent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {leads.map((lead, index) => (
                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-500 text-xs">#{rangeStart + index}</td>
                      <td className="px-6 py-4 font-semibold text-[#0F172A]">{lead.name}</td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800">
                          {lead.type || 'Manual'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div>{lead.email || 'N/A'}</div>
                        <div className="text-xs mt-0.5">{lead.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleConsent(lead.id, 'DNC', getConsentStatus(lead, 'DNC'))}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border ${
                            getConsentStatus(lead, 'DNC') === 'OPT_IN'
                              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <AlertCircle className="h-4 w-4" />
                          {getConsentStatus(lead, 'DNC') === 'OPT_IN' ? 'DNC Active' : 'Allow'}
                        </button>
                      </td>
                      {['EMAIL', 'SMS', 'WHATSAPP'].map(channel => {
                        const status = getConsentStatus(lead, channel);
                        const isOptedIn = status === 'OPT_IN';
                        const isDnc = getConsentStatus(lead, 'DNC') === 'OPT_IN';
                        
                        return (
                          <td key={channel} className="px-6 py-4 text-center">
                            <button
                              onClick={() => !isDnc && toggleConsent(lead.id, channel, status)}
                              disabled={isDnc}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border ${
                                isDnc 
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                                  : isOptedIn
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              }`}
                            >
                              {getChannelIcon(channel)}
                              {isOptedIn ? 'Subscribed' : 'Opted Out'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination footer */}
            <div className="flex flex-col gap-3 border-t border-[#E2E8F0] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold text-[#64748B]">
                Showing <span className="text-[#0F172A]">{rangeStart}–{rangeEnd}</span> of{' '}
                <span className="text-[#0F172A]">{totalRecords}</span> leads
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>

                <div className="flex items-center gap-1">
                  {buildPageList(page, totalPages).map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span key={`e-${idx}`} className="px-1.5 text-xs font-semibold text-slate-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors ${p === page
                          ? 'bg-primary text-white shadow-sm shadow-primary/30'
                          : 'text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
