import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Plus,
  Upload,
  Download,
  Search,
  MoreVertical,
  X,
  Sparkles,
  Edit2,
  Trash2,
  PhoneCall,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  User,
  MapPin,
  Building2,
  Link,
  Briefcase,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsService, getUnifiedStatus } from '../services/leads.service';
import type { Lead } from '../services/leads.service';
import { Lead360Drawer } from '../components/Lead360Drawer';
import { DirectMailModal } from '../components/DirectMailModal';


const hasValue = (val: any): boolean => {
  if (val === undefined || val === null) return false;
  const str = String(val).trim();
  return str !== '' && str.toLowerCase() !== 'null';
};



// Compute a deterministic lead score based on status components and data completeness
const getLeadScore = (lead: Lead): number => {
  let score = 0;

  // --- PART 1: STATUS COMPONENTS (Max 60 points) ---
  
  // 1. Sales Stage component (Max 20 points)
  switch (lead.salesStage) {
    case 'Client Won':
      score += 20;
      break;
    case 'Negotiation':
      score += 17;
      break;
    case 'Follow-up':
      score += 15;
      break;
    case 'Qualified':
      score += 12;
      break;
    case 'Contacted':
      score += 8;
      break;
    case 'New':
      score += 5;
      break;
    case 'Client Lost':
    case 'Do Not Contact':
      score += 0;
      break;
    default:
      score += 3;
  }

  // 2. Verification Status component (Max 15 points)
  switch (lead.verificationStatus) {
    case 'Active':
      score += 15;
      break;
    case 'Imported':
    case 'Enrichment Pending':
    case 'Unverified':
      score += 8;
      break;
    case 'Likely Inactive':
      score += 2;
      break;
    case 'Duplicate':
      score -= 15;
      break;
  }

  // 3. Engagement Status component (Max 15 points)
  switch (lead.engagementStatus) {
    case 'Demo Requested':
      score += 15;
      break;
    case 'Replied':
      score += 13;
      break;
    case 'Clicked':
      score += 11;
      break;
    case 'Opened':
      score += 8;
      break;
    case 'Delivered':
      score += 5;
      break;
    case 'Sent':
      score += 3;
      break;
    case 'Not Engaged':
    default:
      score += 0;
  }

  // 4. Consent Status component (Max 10 points)
  switch (lead.consentStatus) {
    case 'Opted In':
      score += 10;
      break;
    case 'Implied B2B':
      score += 7;
      break;
    case 'Unknown':
      score += 3;
      break;
    case 'Opted Out':
      score -= 15;
      break;
  }

  // --- PART 2: DATA COMPLETENESS & RICHNESS (Max 46 points) ---
  
  // 5. Contact Completeness (Max 8 points)
  if (hasValue(lead.email)) score += 3;
  if (hasValue(lead.email2)) score += 1;
  if (hasValue(lead.phone)) score += 3;
  if (hasValue(lead.phone2)) score += 1;

  // 6. Registration & Business Info (Max 10 points)
  if (hasValue(lead.registrationNo)) score += 5;
  if (hasValue(lead.type) && lead.type.toLowerCase() !== 'manual') score += 3;
  if (hasValue(lead.contactPerson)) score += 2;

  // 7. Location Info (Max 6 points)
  if (hasValue(lead.address)) score += 2;
  if (hasValue(lead.city)) score += 2;
  if (hasValue(lead.state)) score += 2;

  // 8. Online Presence (Max 8 points)
  if (hasValue(lead.website)) score += 4;
  if (hasValue(lead.logoUrl)) score += 2;
  if (hasValue(lead.linkedin) || hasValue(lead.facebook) || hasValue(lead.twitter)) score += 2;

  // 9. Enrichment Content (Max 14 points)
  if (lead.isEnriched) score += 3;
  if (hasValue(lead.servicesSummary)) score += 3;
  if (hasValue(lead.productsOffered)) score += 2;
  if (hasValue(lead.enrichmentNotes)) score += 2;
  if (lead.sellsAlgoTrading === 'Yes') score += 2;
  if (hasValue(lead.brokerPartner)) score += 2;

  // Clamp the score between 0 and 100
  return Math.max(0, Math.min(100, score));
};



export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Automatically fetch and open lead drawer if navigated to /leads/:id
  useEffect(() => {
    if (id) {
      const parsedId = parseInt(id);
      if (!isNaN(parsedId)) {
        // Try to find in existing leads first
        const existingLead = leads.find(l => l.id === parsedId);
        if (existingLead) {
          setSelectedLead(existingLead);
        } else {
          // If not in current page, fetch directly
          leadsService.getLeadById(parsedId).then(res => {
            setSelectedLead(res.data);
          }).catch(err => {
            console.error('Error fetching specific lead:', err);
            toast.error('Could not load lead details');
            navigate('/leads');
          });
        }
      }
    } else {
      setSelectedLead(null);
    }
  }, [id, leads, navigate]);

  const handleCloseDrawer = () => {
    setSelectedLead(null);
    if (id) {
      navigate('/leads');
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  
  // Read initial filter from location state, default to 'All'
  const initialFilter = location.state?.unifiedStatus || 'All';
  const [unifiedStatusFilter, setUnifiedStatusFilter] = useState(initialFilter);
  
  const [typeFilter, setTypeFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [cityFilter, setCityFilter] = useState('All');
  const [websiteStatusFilter, setWebsiteStatusFilter] = useState('All');
  const [filterOptions, setFilterOptions] = useState<{ states: string[], cities: string[], types: string[] }>({ states: [], cities: [], types: [] });

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const PAGE_SIZE = 50;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scoreSort, setScoreSort] = useState<'none' | 'asc' | 'desc'>('desc');

  const sortedLeads = useMemo(() => {
    return leads;
  }, [leads]);

  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Load filter options
  useEffect(() => {
    leadsService.getFilterOptions(stateFilter !== 'All' ? stateFilter : undefined)
      .then(setFilterOptions)
      .catch(err => console.error('Error fetching filter options', err));
  }, [stateFilter]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting && page < totalPages && !isLoading) {
        setPage(prev => prev + 1);
      }
    }, {
      root: null,
      rootMargin: '150px',
      threshold: 0.1
    });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [page, totalPages, isLoading]);

  // Row action menu (3-dot dropdown)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [selectedLeadForMail, setSelectedLeadForMail] = useState<Lead | null>(null);

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
        unifiedStatus: unifiedStatusFilter === 'All' ? undefined : unifiedStatusFilter,
        type: typeFilter === 'All' ? undefined : typeFilter,
        state: stateFilter === 'All' ? undefined : stateFilter,
        city: cityFilter === 'All' ? undefined : cityFilter,
        websiteStatus: websiteStatusFilter === 'All' ? undefined : websiteStatusFilter,
        sortBy: scoreSort !== 'none' ? 'leadScore' : undefined,
        order: scoreSort !== 'none' ? scoreSort : undefined
      });
      setLeads(prev => page === 1 ? response.data : [...prev, ...response.data]);
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
  }, [page, searchQuery, unifiedStatusFilter, typeFilter, stateFilter, cityFilter, websiteStatusFilter, scoreSort]);

  // Reset to page 1 on search, filter or sort change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, unifiedStatusFilter, typeFilter, stateFilter, cityFilter, websiteStatusFilter, scoreSort]);

  // Handle immediate page loading for scroll and debounced loading for search/filters
  useEffect(() => {
    if (page > 1) {
      fetchLeads();
      return;
    }

    const delay = setTimeout(() => {
      fetchLeads();
    }, 400);

    return () => clearTimeout(delay);
  }, [page, fetchLeads]);


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



  const rangeStart = totalRecords === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  return (
    <div className="relative flex gap-6">
      {/* Main List Section */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">Leads</h1>
              <span className="text-xs sm:text-sm font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {totalRecords} Total
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Manage, track, and score your inbound and outbound leads.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/leads/import')}
              className="btn-secondary !px-3 sm:!px-4 text-xs sm:text-sm"
            >
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>
            <button className="btn-secondary !px-3 sm:!px-4 text-xs sm:text-sm">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
            <button
              onClick={() => handleOpenForm()}
              className="btn-primary !px-3 sm:!px-4 text-xs sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 sm:p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search by name, email, ID, city, or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base !pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setCityFilter('All'); // Reset city when state changes
              }}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary max-w-[150px]"
            >
              <option value="All">All States</option>
              {filterOptions.states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary max-w-[150px]"
            >
              <option value="All">All Cities</option>
              {filterOptions.cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>

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
              value={unifiedStatusFilter}
              onChange={(e) => setUnifiedStatusFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
            >
              <option value="All">All Statuses</option>
              <option value="IMPORTED">Imported</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="NEW">New (Verified)</option>
              <option value="CONTACTED">Contacted</option>
              <option value="ENGAGED">Engaged</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="NEGOTIATION">Negotiation</option>
              <option value="WON">Client Won</option>
              <option value="LOST">Client Lost</option>
              <option value="INVALID">Invalid/Inactive</option>
            </select>

            <select
              value={websiteStatusFilter}
              onChange={(e) => setWebsiteStatusFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
            >
              <option value="All">All Websites</option>
              <option value="HasWebsite">Has Website</option>
              <option value="NoWebsite">No Website</option>
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
          {isLoading && leads.length === 0 ? (
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
              <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full border-collapse text-left text-sm" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      <th className="py-4 px-6 w-[4%] min-w-[50px]">Id</th>
                      <th className="py-4 px-6 w-[26%] min-w-[280px]">Name</th>
                      <th className="py-4 px-6 w-[22%] min-w-[220px]">Email / Phone</th>
                      <th className="py-4 px-6 w-[6%] min-w-[70px]">Type</th>
                      <th className="py-4 px-6 w-[10%] min-w-[100px]">Reg No.</th>
                      <th className="py-4 px-6 w-[15%] min-w-[130px] text-center">Status</th>
                      <th 
                        onClick={() => {
                          setScoreSort(prev => prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none');
                        }}
                        className="py-4 px-6 w-[11%] min-w-[110px] cursor-pointer select-none hover:text-[#0F172A] transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Lead Score
                          <span className="text-slate-400">
                            {scoreSort === 'none' ? '⇅' : scoreSort === 'asc' ? '▲' : '▼'}
                          </span>
                        </div>
                      </th>
                      <th className="py-4 px-6 w-[5%] min-w-[120px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {sortedLeads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
                          No leads found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      sortedLeads.map((lead, index) => {
                        const score = getLeadScore(lead);
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
                                <div className="relative h-9 w-9 flex-shrink-0 select-none">
                                  {lead.logoUrl ? (
                                    <img 
                                      src={lead.logoUrl} 
                                      alt={lead.name}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        const sibling = (e.target as HTMLImageElement).nextElementSibling as HTMLDivElement;
                                        if (sibling) sibling.style.display = 'flex';
                                      }}
                                      className="h-9 w-9 rounded-full object-cover border border-slate-200 bg-white"
                                    />
                                  ) : null}
                                  <div 
                                    style={{ display: lead.logoUrl ? 'none' : 'flex' }}
                                    className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-600/10 text-primary border border-primary/20 items-center justify-center font-bold text-sm"
                                  >
                                    {lead.name.charAt(0).toUpperCase()}
                                  </div>
                                </div>

                                <div>
                                  <a
                                    href={lead.website ? lead.website : `https://www.google.com/search?q=${encodeURIComponent(lead.name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-primary hover:underline group block min-w-0"
                                    title="Click to search on Google"
                                  >
                                    {lead.name}
                                  </a>
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

                            {/* Unified Status */}
                            <td className="py-4 px-6 text-center">
                              {(() => {
                                const status = getUnifiedStatus(lead);
                                let colorClass = 'bg-slate-100 text-slate-700';
                                
                                if (['Client Won', 'Qualified', 'Converted / Closed'].includes(status)) colorClass = 'bg-emerald-100 text-emerald-700';
                                else if (['Replied', 'Demo Requested', 'Negotiation'].includes(status)) colorClass = 'bg-purple-100 text-purple-700';
                                else if (['Opened', 'Clicked', 'Contacted'].includes(status)) colorClass = 'bg-blue-100 text-blue-700';
                                else if (['Active'].includes(status)) colorClass = 'bg-teal-100 text-teal-700';
                                else if (['Enriched', 'Imported'].includes(status)) colorClass = 'bg-slate-100 text-slate-700';
                                else if (['Client Lost', 'Likely Inactive'].includes(status)) colorClass = 'bg-red-100 text-red-700';
                                else if (status === 'Unverified') colorClass = 'bg-amber-100 text-amber-700';

                                return (
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${colorClass}`}>
                                    {status}
                                  </span>
                                );
                              })()}
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


                            {/* Row Actions */}
                            <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="relative flex justify-end gap-1 sm:gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLeadForMail(lead);
                                    setIsMailModalOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center rounded-lg p-2 text-indigo-500 hover:bg-indigo-50 transition-colors shrink-0 min-w-[32px] sm:min-w-[36px]"
                                  title="Send Direct Email"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                </button>
                                <button
                                  onClick={() => handleRowClick(lead)}
                                  className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0 min-w-[32px] sm:min-w-[36px]"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenForm(lead)}
                                  className="inline-flex items-center justify-center rounded-lg p-2 text-blue-500 hover:bg-blue-50 transition-colors shrink-0 min-w-[32px] sm:min-w-[36px]"
                                  title="Edit Lead"
                                >
                                  <Edit2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
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
                                  className={`inline-flex items-center justify-center rounded-lg p-2 transition-colors shrink-0 min-w-[32px] sm:min-w-[36px] ${openMenuId === lead.id ? 'bg-slate-100 text-[#0F172A]' : 'text-slate-400 hover:bg-[#F8FAFC] hover:text-[#0F172A]'}`}
                                >
                                  <MoreVertical className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
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

              {/* Infinite Scroll Indicator */}
              <div ref={loaderRef} className="flex justify-center items-center py-6 border-t border-[#E2E8F0] select-none">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Loading more leads...
                  </div>
                ) : page < totalPages ? (
                  <span className="text-xs font-semibold text-slate-400">Scroll down to load more</span>
                ) : (
                  <span className="text-xs font-semibold text-slate-400">
                    Showing all {totalRecords} leads
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Lead360Drawer 
        isOpen={!!selectedLead} 
        onClose={handleCloseDrawer} 
        lead={selectedLead} 
        onEdit={(lead) => {
          setFormData(lead);
          setIsFormOpen(true);
          handleCloseDrawer();
        }}
      />

      <DirectMailModal 
        isOpen={isMailModalOpen}
        onClose={() => setIsMailModalOpen(false)}
        lead={selectedLeadForMail}
      />

      {/* Add/Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-[95vw] max-w-3xl border border-[#E2E8F0] bg-white rounded-xl shadow-2xl p-4 sm:p-6 relative max-h-[92vh] overflow-y-auto">
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

            <form onSubmit={handleSaveLead} className="space-y-6">
              {/* Basic Details */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Basic Details
                </h3>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Enter full name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Email</label>
                    <input
                      type="email"
                      pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                      title="Enter a valid email address"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Email 2</label>
                    <input
                      type="email"
                      pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                      title="Enter a valid email address"
                      value={formData.email2 || ''}
                      onChange={(e) => setFormData({ ...formData, email2: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Secondary email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Phone</label>
                    <input
                      type="tel"
                      pattern="^\+?[0-9\s\-\(\)]{7,15}$"
                      title="Enter a valid phone number (min 7 digits)"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Phone 2</label>
                    <input
                      type="tel"
                      pattern="^\+?[0-9\s\-\(\)]{7,15}$"
                      title="Enter a valid phone number (min 7 digits)"
                      value={formData.phone2 || ''}
                      onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Secondary phone"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Contact Person</label>
                    <input
                      type="text"
                      value={formData.contactPerson || ''}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Name of contact person"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Website</label>
                    <input
                      type="url"
                      pattern="https?://.+"
                      title="Include http:// or https://"
                      value={formData.website || ''}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Status & Segmentation */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Status & Segment
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Sales Stage</label>
                    <select
                      value={formData.salesStage || 'New'}
                      onChange={(e) => setFormData({ ...formData, salesStage: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
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
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
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
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
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
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
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
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    >
                      <option value="Manual">Manual</option>
                      <option value="IA">IA</option>
                      <option value="Sub Broker">Sub Broker</option>
                      <option value="RA">RA</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Source</label>
                    <input
                      type="text"
                      value={formData.source || ''}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="e.g. Website Signup"
                    />
                  </div>
                </div>
              </div>

              {/* Company & Registration */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Company & Registration
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Registration No</label>
                    <input
                      type="text"
                      pattern="^[A-Za-z0-9\s\-]{3,25}$"
                      title="Enter a valid registration number"
                      value={formData.registrationNo || ''}
                      onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="e.g. REG12345"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Validity</label>
                    <input
                      type="text"
                      value={formData.validity || ''}
                      onChange={(e) => setFormData({ ...formData, validity: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="e.g. 2025-12-31"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Trade Name</label>
                    <input
                      type="text"
                      value={formData.tradeName || ''}
                      onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="e.g. AlgoTech Solutions"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Exchange Name</label>
                    <input
                      type="text"
                      value={formData.exchangeName || ''}
                      onChange={(e) => setFormData({ ...formData, exchangeName: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="e.g. NSE, BSE"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Location
                </h3>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Address</label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Full street address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">City</label>
                    <input
                      type="text"
                      value={formData.city || ''}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">State</label>
                    <input
                      type="text"
                      value={formData.state || ''}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Pincode</label>
                    <input
                      type="text"
                      pattern="^[0-9A-Za-z\s\-]{3,10}$"
                      title="Enter a valid pincode/zipcode"
                      value={formData.pincode || ''}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Pincode"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Fax</label>
                    <input
                      type="tel"
                      pattern="^\+?[0-9\s\-\(\)]{7,15}$"
                      title="Enter a valid fax number"
                      value={formData.fax || ''}
                      onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Fax number"
                    />
                  </div>
                </div>
              </div>

              {/* Socials */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                  <Link className="h-4 w-4 text-primary" /> Social Links
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">LinkedIn</label>
                    <input
                      type="url"
                      pattern="https?://.+"
                      title="Include http:// or https://"
                      value={formData.linkedin || ''}
                      onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Twitter</label>
                    <input
                      type="url"
                      pattern="https?://.+"
                      title="Include http:// or https://"
                      value={formData.twitter || ''}
                      onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="https://twitter.com/..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Facebook</label>
                    <input
                      type="url"
                      pattern="https?://.+"
                      title="Include http:// or https://"
                      value={formData.facebook || ''}
                      onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="https://facebook.com/..."
                    />
                  </div>
              </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Other Listings / URLs</label>
                  <textarea
                    value={formData.otherListings || ''}
                    onChange={(e) => setFormData({ ...formData, otherListings: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm min-h-[60px]"
                    placeholder="Enter multiple URLs (e.g. separated by commas or lines) of platforms you work with..."
                  />
                </div>
              </div>

              {/* Enrichment Data */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" /> Enrichment Data
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Sells Algo Trading?</label>
                    <input
                      type="text"
                      value={formData.sellsAlgoTrading || ''}
                      onChange={(e) => setFormData({ ...formData, sellsAlgoTrading: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Yes / No"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Broker Partner</label>
                    <input
                      type="text"
                      value={formData.brokerPartner || ''}
                      onChange={(e) => setFormData({ ...formData, brokerPartner: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="e.g. Zerodha, AngelOne"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Company Size</label>
                    <input
                      type="text"
                      value={formData.companySizeEstimate || ''}
                      onChange={(e) => setFormData({ ...formData, companySizeEstimate: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="e.g. 10-50 employees"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Logo URL</label>
                    <input
                      type="url"
                      pattern="https?://.+"
                      title="Include http:// or https://"
                      value={formData.logoUrl || ''}
                      onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Products Offered</label>
                  <textarea
                    value={formData.productsOffered || ''}
                    onChange={(e) => setFormData({ ...formData, productsOffered: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm min-h-[60px]"
                    placeholder="List of products..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Services Summary</label>
                  <textarea
                    value={formData.servicesSummary || ''}
                    onChange={(e) => setFormData({ ...formData, servicesSummary: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm min-h-[60px]"
                    placeholder="Brief description of services..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#0F172A]">Enrichment Notes</label>
                  <textarea
                    value={formData.enrichmentNotes || ''}
                    onChange={(e) => setFormData({ ...formData, enrichmentNotes: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm min-h-[60px]"
                    placeholder="Additional notes from enrichment..."
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white py-3 border-t border-[#E2E8F0] mt-6">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-600 disabled:opacity-50"
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