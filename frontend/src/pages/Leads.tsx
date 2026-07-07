import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Upload,
  Download,
  Search,
  MoreVertical,
  X,
  Phone as PhoneIcon,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Edit2,
  Trash2,
  PhoneCall,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsService } from '../services/leads.service';
import type { Lead } from '../services/leads.service';


// Compute a pseudo lead score from salesStage
const getLeadScore = (stage: string): number => {
  switch (stage) {
    case 'Client Won': return 90 + Math.floor(Math.random() * 10);
    case 'Negotiation': return 70 + Math.floor(Math.random() * 20);
    case 'Qualified': return 60 + Math.floor(Math.random() * 10);
    case 'Contacted': return 40 + Math.floor(Math.random() * 15);
    case 'New': default: return 10 + Math.floor(Math.random() * 30);
  }
};

// Build a compact page list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 20
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

export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [salesStageFilter, setSalesStageFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const PAGE_SIZE = 50;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Row action menu (3-dot dropdown)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu on scroll
  useEffect(() => {
    const handleScroll = () => setOpenMenuId(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({
    name: '',
    email: '',
    phone: '',
    salesStage: 'New',
    verificationStatus: 'Unverified',
    engagementStatus: 'Not Engaged',
    consentStatus: 'Unknown',
    type: 'Manual',
    registrationNo: '',
  });

  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  useEffect(() => {
    if (selectedLead) {
      leadsService.getLeadLogs(selectedLead.id)
        .then(setLogs)
        .catch(err => console.error('Error fetching logs', err));
      setActiveTab('details');
    } else {
      setLogs([]);
    }
  }, [selectedLead]);

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

  const handleOpenForm = (lead?: Lead) => {
    if (lead) {
      setFormData(lead);
    } else {
      setFormData({
        name: '', email: '', phone: '', status: 'NEW', source: 'MANUAL', type: 'Manual', registrationNo: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error('Name is required');
    setIsSubmitting(true);
    try {
      if (formData.id) {
        await leadsService.updateLead(formData.id, formData as any);
        toast.success('Lead updated successfully');
      } else {
        await leadsService.createLead(formData as any);
        toast.success('Lead created successfully');
      }
      setIsFormOpen(false);
      fetchLeads();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await leadsService.getLeads({
        page,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
        salesStage: salesStageFilter === 'All' ? undefined : salesStageFilter,
        type: typeFilter === 'All' ? undefined : typeFilter
      });
      setLeads(response.data);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotalRecords(response.pagination.total);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Failed to load leads.');
      } else {
        setError('Cannot connect to server. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, salesStageFilter, typeFilter]);

  // Handle Debounce for Search and Filters
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchLeads();
    }, 400);
    return () => clearTimeout(delay);
  }, [fetchLeads]);

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, salesStageFilter, typeFilter]);


  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const handleDeleteLead = async (lead: Lead) => {
    setOpenMenuId(null);
    if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    try {
      await leadsService.deleteLead(lead.id);
      toast.success('Lead deleted successfully');
      await fetchLeads();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete lead');
    }
  };

  const handleUpdateStatus = async (lead: Lead, salesStage: string) => {
    setOpenMenuId(null);
    try {
      await leadsService.updateLead(lead.id, { salesStage } as any);
      toast.success('Status updated successfully');
      await fetchLeads();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };



  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const rangeStart = totalRecords === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalRecords);

  return (
    <div className="relative flex gap-6">
      {/* Main List Section */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Leads</h1>
            <p className="text-sm text-[#64748B]">
              Manage, track, and score your inbound and outbound leads.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/leads/import')}
              className="btn-secondary"
            >
              <Upload className="h-4 w-4" />
              Import CSV/Excel
            </button>
            <button className="btn-secondary">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={() => handleOpenForm()}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Add Lead
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search by name, email, ID, city, or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base !pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
            >
              <option value="All">All Types</option>
              <option value="Manual">Manual</option>
              <option value="Investment Advisor (IA)">Investment Advisor (IA)</option>
              <option value="Sub Broker">Sub Broker</option>
              <option value="Research Analyst (RA)">Research Analyst (RA)</option>
            </select>

            <select
              value={salesStageFilter}
              onChange={(e) => setSalesStageFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
            >
              <option value="All">All Stages</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Client Won">Client Won</option>
              <option value="Client Lost">Client Lost</option>
            </select>

            <button
              onClick={fetchLeads}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Leads Table */}
        <div className="card !p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading leads from server...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertCircle className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Failed to load leads</p>
                <p className="mt-1 text-xs text-slate-500">{error}</p>
              </div>
              <button
                onClick={fetchLeads}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      <th className="py-4 px-6 w-[8%] min-w-[80px]">Id</th>
                      <th className="py-4 px-6 w-[18%] min-w-[200px]">Name</th>
                      <th className="py-4 px-6 w-[20%] min-w-[220px]">Email</th>
                      <th className="py-4 px-6 w-[10%] min-w-[120px]">Type</th>
                      <th className="py-4 px-6 w-[12%] min-w-[130px]">Reg No.</th>
                      <th className="py-4 px-6 w-[10%] min-w-[110px] text-center">Sales Stage</th>
                      <th className="py-4 px-6 w-[10%] min-w-[110px] text-center">Verification</th>
                      <th className="py-4 px-6 w-[12%] min-w-[140px]">Lead Score</th>
                      <th className="py-4 px-6 w-[10%] min-w-[100px]">Created</th>
                      <th className="py-4 px-6 w-[5%] min-w-[80px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
                          No leads found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead, index) => {
                        const score = getLeadScore(lead.salesStage);
                        return (
                          <tr
                            key={lead.id}
                            className={`hover:bg-slate-50 transition-colors ${selectedLead?.id === lead.id ? 'bg-blue-50/60' : ''
                              }`}
                          >
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <p className="text-xs font-bold text-slate-500">
                                  #{rangeStart + index}
                                </p>
                              </div>
                            </td>
                            {/* Lead Details */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">

                                <div>
                                  <a
                                    href={`https://www.google.com/search?q=${encodeURIComponent(lead.name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-primary hover:underline group block min-w-0"
                                    title="Click to search on Google"
                                  >
                                    {lead.name}
                                  </a></div>
                              </div>
                            </td>

                            {/* Contact Info */}
                            <td className="py-4 px-6">
                              <div className="flex flex-col gap-1">
                                {lead.email && <p className="font-medium text-[#0F172A]">{lead.email}</p>}
                                {lead.email2 && <p className="font-medium text-[#0F172A]">{lead.email2}</p>}
                                {(!lead.email && !lead.email2) && <p className="font-medium text-[#0F172A]">—</p>}

                                {lead.phone && <p className="text-xs text-[#64748B]">{lead.phone}</p>}
                                {lead.phone2 && <p className="text-xs text-[#64748B]">{lead.phone2}</p>}
                                {(!lead.phone && !lead.phone2) && <p className="text-xs text-[#64748B]">—</p>}
                              </div>
                            </td>

                            {/* Type */}
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                {lead.type?.includes('(') ? lead.type.split('(')[1].replace(')', '') : lead.type || 'Manual'}
                              </span>
                            </td>

                            {/* Source and Reg No */}
                            <td className="py-4 px-6">
                              {lead.registrationNo ? (
                                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                                  {lead.registrationNo}
                                </span>
                              ) : <span className="text-slate-400">—</span>}

                            </td>

                            <td className="py-4 px-6 text-center">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${lead.salesStage === 'New'
                                ? 'bg-emerald-100 text-emerald-700'
                                : lead.salesStage === 'Client Won'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                                }`}>
                                {lead.salesStage}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700">
                                {lead.verificationStatus}
                              </span>
                            </td>

                            {/* Lead Score */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <span className="w-6 text-right text-xs font-bold text-slate-700">{score}</span>
                                <div className="h-2 w-24 rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${score >= 80
                                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                                      : score >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                      }`}
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Created Date */}
                            <td className="py-4 px-6 text-xs text-[#64748B] font-medium">
                              {formatDate(lead.createdAt)}
                            </td>

                            {/* Row Actions */}
                            <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="relative flex justify-end gap-2">
                                <button
                                  onClick={() => handleRowClick(lead)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenForm(lead)}
                                  className="rounded-lg p-1.5 text-blue-500 hover:bg-blue-50 transition-colors"
                                  title="Edit Lead"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    if (openMenuId === lead.id) {
                                      setOpenMenuId(null);
                                    } else {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                      setOpenMenuId(lead.id);
                                    }
                                  }}
                                  className={`rounded-lg p-1.5 transition-colors ${openMenuId === lead.id ? 'bg-slate-100 text-[#0F172A]' : 'text-slate-400 hover:bg-[#F8FAFC] hover:text-[#0F172A]'}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>

                                {/* Dropdown Menu */}
                                {openMenuId === lead.id && createPortal(
                                  <div
                                    ref={menuRef}
                                    style={{ top: menuPos.top, right: menuPos.right }}
                                    className="fixed z-50 mt-1 w-52 rounded-xl border border-[#E2E8F0] bg-white py-1.5 shadow-lg"
                                  >
                                    <button
                                      onClick={() => { setOpenMenuId(null); handleRowClick(lead); }}
                                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                                      View details
                                    </button>
                                    <button
                                      onClick={() => { setOpenMenuId(null); handleOpenForm(lead); }}
                                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                                    >
                                      <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                                      Edit lead
                                    </button>

                                    <div className="my-1 border-t border-[#E2E8F0]" />

                                    {lead.status !== 'CONTACTED' && (
                                      <button
                                        onClick={() => handleUpdateStatus(lead, 'CONTACTED')}
                                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                                      >
                                        <PhoneCall className="h-3.5 w-3.5 text-amber-500" />
                                        Mark as contacted
                                      </button>
                                    )}
                                    {lead.status !== 'CONVERTED' && (
                                      <button
                                        onClick={() => handleUpdateStatus(lead, 'CONVERTED')}
                                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                                        Mark as converted
                                      </button>
                                    )}

                                    <div className="my-1 border-t border-[#E2E8F0]" />

                                    <button
                                      onClick={() => handleDeleteLead(lead)}
                                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete lead
                                    </button>
                                  </div>,
                                  document.body
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
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
                          onClick={() => setPage(p)}
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

      {/* Quick-View Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl border border-[#E2E8F0] bg-white rounded-xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                Quick Details
              </span>
              <button
                onClick={() => setSelectedLead(null)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F8FAFC] hover:text-slate-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Section */}
            <div className="mt-4 flex items-center gap-4 pb-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold text-xl ring-1 ring-inset ring-blue-100">
                {selectedLead.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(selectedLead.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block min-w-0"
                    title="Click to search on Google"
                  >
                    <h3 className="text-lg font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors cursor-pointer">{selectedLead.name}</h3>
                  </a>
                  <div className="flex gap-2 shrink-0">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${selectedLead.salesStage === 'New' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10' : selectedLead.salesStage === 'Client Won' ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10' : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10'}`}>
                      {selectedLead.salesStage}
                    </span>
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/10">
                      {selectedLead.verificationStatus}
                    </span>
                  </div>
                </div>
                <p className="text-[13px] text-slate-500 mt-1">Lead ID: <span className="font-medium text-slate-700">{selectedLead.id}</span></p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#E2E8F0] mb-6">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}
              >
                Activity History
              </button>
            </div>

            {activeTab === 'details' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 bg-slate-50/50 rounded-xl p-5 border border-slate-100">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Email</p>
                    <p className="text-sm font-medium text-slate-900 truncate mt-0.5">{selectedLead.email || '—'}</p>
                    {selectedLead.email2 && (
                      <p className="text-sm font-medium text-slate-900 truncate mt-1">{selectedLead.email2}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <PhoneIcon className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Phone</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedLead.phone || '—'}</p>
                    {selectedLead.phone2 && (
                      <p className="text-sm font-medium text-slate-900 mt-1">{selectedLead.phone2}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Type</p>
                    <span className="inline-flex items-center mt-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {selectedLead.type?.includes('(') ? selectedLead.type.split('(')[1].replace(')', '') : selectedLead.type || 'Manual'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Source & Reg No.</p>
                    {selectedLead.registrationNo && (
                      <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 mt-1 mb-1 ring-1 ring-inset ring-indigo-700/10">
                        {selectedLead.registrationNo}
                      </span>
                    )}
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedLead.source || 'Manual'}</p>
                  </div>
                </div>

                {(selectedLead.address || selectedLead.city) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Address</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5 leading-relaxed">{[selectedLead.address, selectedLead.city, selectedLead.state, selectedLead.pincode].filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                )}

                {selectedLead.contactPerson && (
                  <div className="flex items-start gap-3">
                    <PhoneIcon className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Contact Person</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedLead.contactPerson}</p>
                    </div>
                  </div>
                )}

                {(selectedLead.exchangeName || selectedLead.tradeName) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Trade Details</p>
                      {selectedLead.exchangeName && <p className="text-sm font-medium text-slate-900 mt-0.5">Exchange: {selectedLead.exchangeName}</p>}
                      {selectedLead.tradeName && <p className="text-sm font-medium text-slate-900 mt-0.5">Trade Name: {selectedLead.tradeName}</p>}
                    </div>
                  </div>
                )}

                {selectedLead.fax && (
                  <div className="flex items-start gap-3">
                    <PhoneIcon className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Fax</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedLead.fax}</p>
                    </div>
                  </div>
                )}

                {selectedLead.validity && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Validity</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedLead.validity}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">System Statuses</p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {selectedLead.status && <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/10">Base: {selectedLead.status}</span>}
                      {selectedLead.engagementStatus && <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/10">Engagement: {selectedLead.engagementStatus}</span>}
                      {selectedLead.consentStatus && <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/10">Consent: {selectedLead.consentStatus}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Timeline</p>
                    <p className="text-[13px] font-medium text-slate-900 mt-0.5">Created: {formatDate(selectedLead.createdAt)}</p>
                    {selectedLead.updatedAt && <p className="text-[13px] font-medium text-slate-900 mt-0.5">Updated: {formatDate(selectedLead.updatedAt)}</p>}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Lead Score</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-bold text-slate-700 w-5">{getLeadScore(selectedLead.salesStage)}</span>
                      <div className="h-1.5 w-full rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                          style={{ width: `${getLeadScore(selectedLead.salesStage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.length === 0 ? (
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
                        {log.user && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700">
                              {log.user.name.charAt(0)}
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{log.user.name}</span>
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">{log.user.role?.name || 'User'}</span>
                          </div>
                        )}
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

            {/* Drawer Actions */}
            <div className="mt-8 pt-4 border-t border-[#E2E8F0] flex gap-3">
              <button
                onClick={() => {
                  setSelectedLead(null);
                  handleOpenForm(selectedLead);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                <Edit2 className="h-4 w-4" />
                Edit Lead
              </button>
              <button
                onClick={() => setSelectedLead(null)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-900 bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
              >
                Close
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-[#E2E8F0] bg-white rounded-xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-4">
              <h2 className="text-lg font-bold text-[#0F172A]">
                {formData.id ? 'Edit Lead' : 'Add New Lead'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F8FAFC] hover:text-slate-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                  placeholder="Enter full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Phone</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Sales Stage</label>
                  <select
                    value={formData.salesStage || 'New'}
                    onChange={(e) => setFormData({ ...formData, salesStage: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Client Won">Client Won</option>
                    <option value="Client Lost">Client Lost</option>
                    <option value="Do Not Contact">Do Not Contact</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Verification</label>
                  <select
                    value={formData.verificationStatus || 'Unverified'}
                    onChange={(e) => setFormData({ ...formData, verificationStatus: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                  >
                    <option value="Imported">Imported</option>
                    <option value="Enrichment Pending">Enrichment Pending</option>
                    <option value="Active">Active</option>
                    <option value="Likely Inactive">Likely Inactive</option>
                    <option value="Unverified">Unverified</option>
                    <option value="Duplicate">Duplicate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Engagement</label>
                  <select
                    value={formData.engagementStatus || 'Not Engaged'}
                    onChange={(e) => setFormData({ ...formData, engagementStatus: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                  >
                    <option value="Not Engaged">Not Engaged</option>
                    <option value="Sent">Sent</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Opened">Opened</option>
                    <option value="Clicked">Clicked</option>
                    <option value="Replied">Replied</option>
                    <option value="Demo Requested">Demo Requested</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Consent</label>
                  <select
                    value={formData.consentStatus || 'Unknown'}
                    onChange={(e) => setFormData({ ...formData, consentStatus: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                  >
                    <option value="Unknown">Unknown</option>
                    <option value="Opted In">Opted In</option>
                    <option value="Opted Out">Opted Out</option>
                    <option value="Implied B2B">Implied B2B</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Type</label>
                  <select
                    value={formData.type || 'Manual'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                  >
                    <option value="Manual">Manual</option>
                    <option value="IA">IA</option>
                    <option value="Sub Broker">Sub Broker</option>
                    <option value="RA">RA</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};