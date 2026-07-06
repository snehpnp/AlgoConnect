import React, { useState, useEffect, useCallback } from 'react';
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
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { leadsService } from '../services/leads.service';
import type { Lead } from '../services/leads.service';
import * as XLSX from 'xlsx';

// Map API status to display badge style
const getStatusStyle = (status: Lead['status']) => {
  switch (status) {
    case 'CONVERTED':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'CONTACTED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'NEW':
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
};

const getStatusLabel = (status: Lead['status']) => {
  switch (status) {
    case 'CONVERTED': return 'Converted';
    case 'CONTACTED': return 'Contacted';
    case 'NEW': return 'New';
  }
};

// Compute a pseudo lead score from status
const getLeadScore = (status: Lead['status']): number => {
  switch (status) {
    case 'CONVERTED': return 90 + Math.floor(Math.random() * 10);
    case 'CONTACTED': return 50 + Math.floor(Math.random() * 25);
    case 'NEW': return 10 + Math.floor(Math.random() * 30);
  }
};

export const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({
    name: '',
    email: '',
    phone: '',
    status: 'NEW',
    source: 'MANUAL',
    registrationNo: '',
  });

  const handleOpenForm = (lead?: Lead) => {
    if (lead) {
      setFormData(lead);
    } else {
      setFormData({
        name: '', email: '', phone: '', status: 'NEW', source: 'MANUAL', registrationNo: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return alert('Name is required');
    setIsSubmitting(true);
    try {
      if (formData.id) {
        await leadsService.updateLead(formData.id, formData as any);
        alert('Lead updated successfully');
      } else {
        await leadsService.createLead(formData as any);
        alert('Lead created successfully');
      }
      setIsFormOpen(false);
      fetchLeads();
    } catch (err: any) {
      alert(err.message || 'Failed to save lead');
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
        limit: 50, 
        search: searchQuery, 
        status: statusFilter 
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
  }, [page, searchQuery, statusFilter]);

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
  }, [searchQuery, statusFilter]);


  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        let headerRowIndex = 0;
        // Search first 20 rows to find actual header row
        for (let i = 0; i < Math.min(20, rawData.length); i++) {
          const row = rawData[i] || [];
          if (row.some(cell => typeof cell === 'string' && (cell.toLowerCase() === 'name' || cell.toLowerCase() === 'registration no.' || cell.toLowerCase() === 'email'))) {
            headerRowIndex = i;
            break;
          }
        }

        const headerCounts: Record<string, number> = {};
        const headers = (rawData[headerRowIndex] || []).map((header: any) => {
          if (!header || typeof header !== 'string') return '';
          const trimmed = header.trim();
          headerCounts[trimmed] = (headerCounts[trimmed] || 0) + 1;
          return headerCounts[trimmed] > 1 ? `${trimmed}_${headerCounts[trimmed]}` : trimmed;
        });

        const data = rawData.slice(headerRowIndex + 1).map(row => {
          const obj: any = {};
          headers.forEach((header, index) => {
            if (header) {
              obj[header] = row[index];
            }
          });
          return obj;
        });

        const formattedLeads = data
          .map((row) => ({
            name: row.Name || row['Full Name'] || row.name || 'Unknown',
            email: row['Email-Id'] || row.Email || row['Email ID'] || row.email || undefined,
            email2: row['Email-Id_2'] || row.Email_2 || row['Email ID_2'] || row.email_2 || undefined,
            phone: row.Telephone || row.Phone || row['Contact'] || row.phone || row['Phone Number'] ? String(row.Telephone || row.Phone || row['Contact'] || row.phone || row['Phone Number']) : undefined,
            phone2: row.Telephone_2 || row.Phone_2 || row['Contact_2'] || row.phone_2 || row['Phone Number_2'] ? String(row.Telephone_2 || row.Phone_2 || row['Contact_2'] || row.phone_2 || row['Phone Number_2']) : undefined,
            registrationNo: row['Registration No.'] || undefined,
            contactPerson: row['Contact Person'] || undefined,
            address: row.Address || row['Correspondence Address'] || undefined,
            city: row.City || undefined,
            state: row.State || undefined,
            pincode: row.Pincode || undefined,
            source: 'SEBI Sheet Import'
          }))
          .filter(lead => lead.name !== 'Unknown' || lead.registrationNo);

        if (formattedLeads.length > 0) {
          await leadsService.importLeads(formattedLeads);
          await fetchLeads();
          alert(`Successfully imported ${formattedLeads.length} leads!`);
        } else {
          alert('No valid data found in the file.');
        }
      } catch (err) {
        console.error('Error importing file:', err);
        alert('Failed to parse the file. Please ensure it is a valid Excel/CSV file.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

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
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isImporting ? 'Importing...' : 'Import CSV/Excel'}
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button 
              onClick={() => handleOpenForm()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 hover:bg-blue-600 transition-colors"
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
              placeholder="Search by name, email or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-4 pl-9 text-sm outline-none transition-all focus:border-primary focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
            >
              <option value="All">All Statuses</option>
              <option value="Converted">Converted</option>
              <option value="Contacted">Contacted</option>
              <option value="New">New</option>
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
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
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
                      <th className="py-4 px-6">Name</th>
                      <th className="py-4 px-6">Email</th>
                      <th className="py-4 px-6">Registration No.</th>
                      <th className="py-4 px-6 text-center">Status</th>
                      <th className="py-4 px-6">Lead Score</th>
                      <th className="py-4 px-6">Created</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-sm text-slate-400">
                          No leads found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead) => {
                        const score = getLeadScore(lead.status);
                        return (
                          <tr
                            key={lead.id}
                            onClick={() => handleRowClick(lead)}
                            className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                              selectedLead?.id === lead.id ? 'bg-blue-50/60' : ''
                            }`}
                          >
                            {/* Lead Details */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                                  {lead.name.split(' ').map((n) => n[0]).join('')}
                                </div>
                                <div>
                                  <p className="font-semibold text-[#0F172A]">{lead.name}</p>
                                  <p className="text-xs text-slate-500">ID: {lead.id}</p>
                                </div>
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

                            {/* Source */}
                            <td className="py-4 px-6">
                              {lead.registrationNo ? (
                                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 block w-fit mb-1">
                                  {lead.registrationNo}
                                </span>
                              ) : null}
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                {lead.source || 'Manual'}
                              </span>
                            </td>

                            {/* Status Badge */}
                            <td className="py-4 px-6 text-center">
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide ${getStatusStyle(lead.status)}`}>
                                {getStatusLabel(lead.status)}
                              </span>
                            </td>

                            {/* Lead Score */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <span className="w-6 text-right text-xs font-bold text-slate-700">{score}</span>
                                <div className="h-2 w-24 rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${
                                      score >= 80
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
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => handleOpenForm(lead)}
                                  className="rounded-lg p-1.5 text-blue-500 hover:bg-blue-50 transition-colors"
                                  title="Edit Lead"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button className="rounded-lg p-1.5 text-slate-400 hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
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
              <div className="flex items-center justify-between border-t border-[#E2E8F0] px-6 py-4">
                <span className="text-xs font-semibold text-[#64748B]">
                  Showing Page <span className="text-[#0F172A]">{page}</span> of <span className="text-[#0F172A]">{totalPages}</span> 
                  {' '} (<span className="text-[#0F172A]">{totalRecords}</span> total leads)
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
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
          <div className="w-full max-w-md border border-[#E2E8F0] bg-white rounded-xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
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
          <div className="mt-6 flex flex-col items-center border-b border-[#E2E8F0] pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl mb-3">
              {selectedLead.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">{selectedLead.name}</h3>
            <p className="text-xs text-[#64748B] mt-0.5">Lead ID: {selectedLead.id}</p>
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold mt-2.5 ${getStatusStyle(selectedLead.status)}`}>
              {getStatusLabel(selectedLead.status)}
            </span>
          </div>

          {/* Detail Rows */}
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-[#64748B] mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Email</p>
                <p className="text-sm font-semibold text-[#0F172A] truncate">{selectedLead.email || '—'}</p>
                {selectedLead.email2 && (
                  <p className="text-sm font-semibold text-[#0F172A] truncate mt-1">{selectedLead.email2}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <PhoneIcon className="h-4 w-4 text-[#64748B] mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Phone</p>
                <p className="text-sm font-semibold text-[#0F172A]">{selectedLead.phone || '—'}</p>
                {selectedLead.phone2 && (
                  <p className="text-sm font-semibold text-[#0F172A] mt-1">{selectedLead.phone2}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-[#64748B] mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Source & Reg No.</p>
                <p className="text-sm font-semibold text-[#0F172A]">{selectedLead.registrationNo ? `${selectedLead.registrationNo} (${selectedLead.source || 'Manual'})` : (selectedLead.source || 'Manual')}</p>
              </div>
            </div>

            {(selectedLead.address || selectedLead.city) && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-[#64748B] mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Address</p>
                  <p className="text-sm font-medium text-[#0F172A]">{[selectedLead.address, selectedLead.city, selectedLead.state, selectedLead.pincode].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            )}
            
            {selectedLead.contactPerson && (
              <div className="flex items-start gap-3">
                <PhoneIcon className="h-4 w-4 text-[#64748B] mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Contact Person</p>
                  <p className="text-sm font-semibold text-[#0F172A]">{selectedLead.contactPerson}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-[#64748B] mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Created At</p>
                <p className="text-sm font-semibold text-[#0F172A]">{formatDate(selectedLead.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Lead Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                      style={{ width: `${getLeadScore(selectedLead.status)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[#0F172A]">{getLeadScore(selectedLead.status)}%</span>
                </div>
              </div>
            </div>
          </div>

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
              Action
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

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Status</label>
                <select
                  value={formData.status || 'NEW'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="CONVERTED">Converted</option>
                </select>
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
