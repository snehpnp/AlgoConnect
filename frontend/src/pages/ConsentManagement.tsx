import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, Loader2, AlertCircle, Mail, MessageSquare, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import type { LeadWithConsents } from '../services/consent.service';
import { consentService } from '../services/consent.service';

export const ConsentManagement = () => {
  const [leads, setLeads] = useState<LeadWithConsents[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLeads = async (search?: string) => {
    setIsLoading(true);
    try {
      const data = await consentService.getConsents(search);
      setLeads(data);
    } catch (err) {
      toast.error('Failed to load consent data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLeads(searchQuery);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const toggleConsent = async (leadId: number, channel: string, currentStatus: string) => {
    const newStatus = currentStatus === 'OPT_IN' ? 'OPT_OUT' : 'OPT_IN';
    try {
      // Optimistic update
      setLeads(prevLeads => prevLeads.map(lead => {
        if (lead.id === leadId) {
          const consents = [...lead.consents];
          const consentIndex = consents.findIndex(c => c.channel === channel);
          if (consentIndex >= 0) {
            consents[consentIndex] = { ...consents[consentIndex], status: newStatus };
          } else {
            consents.push({ id: 0, leadId, channel, status: newStatus });
          }
          return { ...lead, consents };
        }
        return lead;
      }));

      await consentService.updateConsent(leadId, channel, newStatus);
      toast.success(`${channel} consent updated`);
    } catch (err) {
      toast.error('Failed to update consent');
      fetchLeads(searchQuery); // Revert on failure
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
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-64 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-4 pl-9 text-sm outline-none transition-all focus:border-primary focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-xs font-bold uppercase text-[#64748B]">
                <tr>
                  <th className="px-6 py-4">Lead Name</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4 text-center">Email Consent</th>
                  <th className="px-6 py-4 text-center">SMS Consent</th>
                  <th className="px-6 py-4 text-center">WhatsApp Consent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-[#0F172A]">{lead.name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <div>{lead.email || 'N/A'}</div>
                      <div className="text-xs mt-0.5">{lead.phone || 'N/A'}</div>
                    </td>
                    {['EMAIL', 'SMS', 'WHATSAPP'].map(channel => {
                      const status = getConsentStatus(lead, channel);
                      const isOptedIn = status === 'OPT_IN';
                      
                      return (
                        <td key={channel} className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleConsent(lead.id, channel, status)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border ${
                              isOptedIn
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
        )}
      </div>
    </div>
  );
};
