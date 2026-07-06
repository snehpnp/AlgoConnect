import React, { useState, useMemo } from 'react';
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
  Edit2
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  type: string;
  regNo: string;
  email: string;
  phone: string;
  state: string;
  status: 'Active' | 'Pending' | 'Inactive' | 'Qualified';
  score: number;
  lastActivity: string;
}

export const Leads: React.FC = () => {
  const initialLeads: Lead[] = [
    {
      id: 'L-8041',
      name: 'Rohan Sharma',
      type: 'Enterprise',
      regNo: 'REG-2026-0921',
      email: 'rohan.sharma@tatanova.com',
      phone: '+91 98765 43210',
      state: 'Maharashtra',
      status: 'Qualified',
      score: 92,
      lastActivity: 'Downloaded pricing brochure',
    },
    {
      id: 'L-8042',
      name: 'Alice Johnson',
      type: 'SME',
      regNo: 'REG-2026-1102',
      email: 'alice.j@prismtech.io',
      phone: '+1 (555) 019-2834',
      state: 'California',
      status: 'Active',
      score: 78,
      lastActivity: 'Opened sequence email #3',
    },
    {
      id: 'L-8043',
      name: 'Michael Chang',
      type: 'Enterprise',
      regNo: 'REG-2026-3024',
      email: 'm.chang@asiapacific.co',
      phone: '+852 9012 3456',
      state: 'New York',
      status: 'Pending',
      score: 54,
      lastActivity: 'Requested product callback',
    },
    {
      id: 'L-8044',
      name: 'Priya Patel',
      type: 'Startup',
      regNo: 'REG-2026-0419',
      email: 'priya@vistaracapital.in',
      phone: '+91 91234 56789',
      state: 'Karnataka',
      status: 'Qualified',
      score: 88,
      lastActivity: 'Responded to LinkedIn outreach',
    },
    {
      id: 'L-8045',
      name: 'Sarah Connor',
      type: 'SME',
      regNo: 'REG-2026-8091',
      email: 's.connor@cyberdyne.org',
      phone: '+1 (555) 014-9988',
      state: 'Texas',
      status: 'Inactive',
      score: 23,
      lastActivity: 'Email bounced (Soft)',
    },
    {
      id: 'L-8046',
      name: 'David Miller',
      type: 'Enterprise',
      regNo: 'REG-2026-7712',
      email: 'david@millercorp.de',
      phone: '+49 89 2443 2190',
      state: 'Florida',
      status: 'Active',
      score: 65,
      lastActivity: 'Visited website pricing page',
    },
    {
      id: 'L-8047',
      name: 'Carlos Estavez',
      type: 'Startup',
      regNo: 'REG-2026-1049',
      email: 'carlos.e@solaris.es',
      phone: '+34 91 123 4567',
      state: 'Florida',
      status: 'Pending',
      score: 41,
      lastActivity: 'Subscribed to newsletter',
    },
  ];

  const [leads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Filter Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = 
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
      const matchesState = stateFilter === 'All' || lead.state === stateFilter;

      return matchesSearch && matchesStatus && matchesState;
    });
  }, [leads, searchQuery, statusFilter, stateFilter]);

  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const getStatusStyle = (status: Lead['status']) => {
    switch (status) {
      case 'Qualified':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Inactive':
        return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  return (
    <div className="relative flex gap-6">
      {/* Main List Section */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Leads</h1>
            <p className="text-sm text-[#64748B]">Manage, track, and score your inbound and outbound leads.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]">
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 hover:bg-blue-600">
              <Plus className="h-4 w-4" />
              Add Lead
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          {/* Search bar inside filter bar */}
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search by name, email, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-4 pl-9 text-sm outline-none transition-all focus:border-primary focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary focus:bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Qualified">Qualified</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
            </select>

            {/* State Filter */}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary focus:bg-white"
            >
              <option value="All">All States</option>
              <option value="California">California</option>
              <option value="New York">New York</option>
              <option value="Florida">Florida</option>
              <option value="Texas">Texas</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Maharashtra">Maharashtra</option>
            </select>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-[#E2E8F0] p-0.5 bg-[#F8FAFC]">
              <button 
                onClick={() => setViewMode('table')}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                }`}
              >
                Table
              </button>
              <button 
                onClick={() => setViewMode('kanban')}
                className={`rounded-md px-3 py-1 text-xs font-semibold cursor-not-allowed opacity-60 ${
                  viewMode === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                }`}
              >
                Kanban
              </button>
            </div>
          </div>
        </div>

        {/* Leads Table Card */}
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  <th className="py-4.5 px-6 font-semibold">Lead Details</th>
                  <th className="py-4.5 px-6 font-semibold">Contact Info</th>
                  <th className="py-4.5 px-6 font-semibold">Region & Type</th>
                  <th className="py-4.5 px-6 font-semibold text-center">Status</th>
                  <th className="py-4.5 px-6 font-semibold">Lead Score</th>
                  <th className="py-4.5 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredLeads.map((lead) => (
                  <tr 
                    key={lead.id}
                    onClick={() => handleRowClick(lead)}
                    className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                      selectedLead?.id === lead.id ? 'bg-blue-50/55' : ''
                    }`}
                  >
                    {/* Lead Detail */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                          {lead.name.split(' ').map(n=>n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0F172A]">{lead.name}</p>
                          <p className="text-xs text-slate-500">{lead.id} • {lead.regNo}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td className="py-4 px-6">
                      <p className="font-medium text-[#0F172A]">{lead.email}</p>
                      <p className="text-xs text-[#64748B]">{lead.phone}</p>
                    </td>

                    {/* Region & Type */}
                    <td className="py-4 px-6">
                      <p className="font-medium text-[#0F172A]">{lead.state}</p>
                      <p className="text-xs text-[#64748B]">{lead.type}</p>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide ${getStatusStyle(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>

                    {/* Lead Score Progress Bar */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-right text-xs font-bold text-slate-700">{lead.score}</span>
                        <div className="h-2 w-24 rounded-full bg-slate-100">
                          <div 
                            className={`h-full rounded-full ${
                              lead.score >= 80 ? 'bg-gradient-to-r from-blue-600 to-indigo-600' :
                              lead.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${lead.score}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* 3-Dot Actions */}
                    <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors">
                        <MoreVertical className="h-4.5 w-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-[#E2E8F0] px-6 py-4">
            <span className="text-xs font-semibold text-[#64748B]">
              Showing <span className="text-[#0F172A]">{filteredLeads.length}</span> of <span className="text-[#0F172A]">{leads.length}</span> leads
            </span>
            <div className="flex gap-2">
              <button className="rounded-lg border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-bold text-slate-400 cursor-not-allowed bg-slate-50">Previous</button>
              <button className="rounded-lg border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Drawer Quick View Panel */}
      {selectedLead && (
        <div className="w-[380px] shrink-0 border border-[#E2E8F0] bg-white rounded-xl shadow-md p-6 h-fit sticky top-20 animate-slide-in">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Quick Details</span>
            </div>
            <button 
              onClick={() => setSelectedLead(null)}
              className="rounded-lg p-1 text-[#64748B] hover:bg-[#F8FAFC] hover:text-slate-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body Profile */}
          <div className="mt-6 flex flex-col items-center border-b border-[#E2E8F0] pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl mb-3 shadow-inner">
              {selectedLead.name.split(' ').map(n=>n[0]).join('')}
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">{selectedLead.name}</h3>
            <p className="text-xs text-[#64748B] mt-0.5">{selectedLead.id} • {selectedLead.type}</p>
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold mt-2.5 ${getStatusStyle(selectedLead.status)}`}>
              {selectedLead.status}
            </span>
          </div>

          {/* Details Section */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4.5 w-4.5 text-[#64748B]" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Email</p>
                <p className="text-sm font-semibold text-[#0F172A] truncate">{selectedLead.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <PhoneIcon className="h-4.5 w-4.5 text-[#64748B]" />
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Phone</p>
                <p className="text-sm font-semibold text-[#0F172A]">{selectedLead.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="h-4.5 w-4.5 text-[#64748B]" />
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Region State</p>
                <p className="text-sm font-semibold text-[#0F172A]">{selectedLead.state}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-4.5 w-4.5 text-[#64748B]" />
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Last Activity</p>
                <p className="text-sm font-semibold text-[#0F172A]">{selectedLead.lastActivity}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
              <div className="flex-1">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Lead Health Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${selectedLead.score}%` }}></div>
                  </div>
                  <span className="text-xs font-bold text-[#0F172A]">{selectedLead.score}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Actions */}
          <div className="mt-8 pt-4 border-t border-[#E2E8F0] flex gap-3">
            <button className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]">
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
      )}
    </div>
  );
};
