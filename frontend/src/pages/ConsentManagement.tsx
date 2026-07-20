import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, Loader2, AlertCircle, Mail, MessageSquare, Smartphone, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
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

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP'] as const;

export const ConsentManagement = () => {
  const [leads, setLeads] = useState<LeadWithConsents[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [page, setPage] = useState(1);
  const [dncFilter, setDncFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [consentFilter, setConsentFilter] = useState('All');
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
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
  };

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (page !== 1) {
        setPage(1); // triggers the fetch above via the page effect
      } else {
        fetchLeads();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const channelLabel = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return 'Email';
      case 'SMS': return 'SMS';
      case 'WHATSAPP': return 'WhatsApp';
      default: return channel;
    }
  };

  const rangeStart = totalRecords === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalRecords);
  const hasActiveFilters = dncFilter !== 'All' || typeFilter !== 'All' || consentFilter !== 'All';

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-12 px-3 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
            Consent Management
          </h1>
          <p className="hidden sm:block text-sm text-[#64748B] mt-1">
            Manage Do Not Contact (DNC) lists and opt-in status across all communication channels.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={searchQuery}
              onChange={handleSearch}
              className="input-base !pl-9 w-full"
            />
          </div>
          <button
            onClick={() => setShowMobileFilters(prev => !prev)}
            className={`sm:hidden inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold shrink-0 transition-colors ${hasActiveFilters ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
              }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
          </button>
        </div>

        <div className={`grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 ${showMobileFilters ? 'grid' : 'hidden sm:flex'}`}>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary w-full sm:w-auto"
          >
            <option value="All">All Types</option>
            <option value="Manual">Manual</option>
            <option value="API">API</option>
            <option value="Imported">Imported</option>
          </select>

          <select
            value={consentFilter}
            onChange={(e) => { setConsentFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary w-full sm:w-auto"
          >
            <option value="All">All Consents</option>
            <option value="Selected">Selected</option>
            <option value="Not Selected">Not Selected</option>
          </select>

          <select
            value={dncFilter}
            onChange={(e) => { setDncFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary w-full sm:w-auto"
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
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-4">
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
            {/* Mobile Card List */}
            <div className="sm:hidden divide-y divide-[#E2E8F0]">
              {leads.map((lead, index) => {
                const isDnc = getConsentStatus(lead, 'DNC') === 'OPT_IN';
                return (
                  <div key={lead.id} className="p-4 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400">#{rangeStart + index}</span>
                          <p className="font-bold text-sm text-slate-800 truncate">{lead.name}</p>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{lead.email || 'N/A'}</div>
                        <div className="text-xs text-slate-500 truncate">{lead.phone || 'N/A'}</div>
                      </div>
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 shrink-0">
                        {lead.type || 'Manual'}
                      </span>
                    </div>

                    <div className="mt-3">
                      <button
                        onClick={() => toggleConsent(lead.id, 'DNC', getConsentStatus(lead, 'DNC'))}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border ${isDnc
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        {isDnc ? 'DNC Active' : 'Allow'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {CHANNELS.map(channel => {
                        const status = getConsentStatus(lead, channel);
                        const isOptedIn = status === 'OPT_IN';
                        return (
                          <button
                            key={channel}
                            onClick={() => !isDnc && toggleConsent(lead.id, channel, status)}
                            disabled={isDnc}
                            className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-2 text-[10px] font-bold uppercase tracking-wide transition-all ${isDnc
                                ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60'
                                : isOptedIn
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                          >
                            {getChannelIcon(channel)}
                            {channelLabel(channel)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border ${getConsentStatus(lead, 'DNC') === 'OPT_IN'
                              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                          <AlertCircle className="h-4 w-4" />
                          {getConsentStatus(lead, 'DNC') === 'OPT_IN' ? 'DNC Active' : 'Allow'}
                        </button>
                      </td>
                      {CHANNELS.map(channel => {
                        const status = getConsentStatus(lead, channel);
                        const isOptedIn = status === 'OPT_IN';
                        const isDnc = getConsentStatus(lead, 'DNC') === 'OPT_IN';

                        return (
                          <td key={channel} className="px-6 py-4 text-center">
                            <button
                              onClick={() => !isDnc && toggleConsent(lead.id, channel, status)}
                              disabled={isDnc}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border ${isDnc
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
            <div className="flex flex-col gap-3 border-t border-[#E2E8F0] px-4 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold text-[#64748B] text-center sm:text-left">
                Showing <span className="text-[#0F172A]">{rangeStart}–{rangeEnd}</span> of{' '}
                <span className="text-[#0F172A]">{totalRecords}</span> leads
              </span>

              <div className="flex items-center justify-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Prev</span>
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
                        className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors shrink-0 ${p === page
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
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <span className="hidden xs:inline">Next</span>
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