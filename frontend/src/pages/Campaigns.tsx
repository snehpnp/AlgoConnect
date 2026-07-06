import React from 'react';
import { Megaphone, Plus, Search, Calendar, PauseCircle, Play } from 'lucide-react';

export const Campaigns: React.FC = () => {
  const campaigns = [
    { id: 'C-01', name: 'Tech Enterprise Q3 Outreach', status: 'Running', sent: 1250, open: '72.4%', click: '18.9%', date: 'Started Jul 1, 2026' },
    { id: 'C-02', name: 'SaaS Startup Inbound Autoresponder', status: 'Running', sent: 890, open: '64.1%', click: '12.4%', date: 'Started Jun 15, 2026' },
    { id: 'C-03', name: 'Finance Broker Lead Activation', status: 'Paused', sent: 430, open: '58.9%', click: '9.2%', date: 'Paused Jun 30, 2026' },
    { id: 'C-04', name: 'Automotive Dealership Retargeting', status: 'Draft', sent: 0, open: '0%', click: '0%', date: 'Created Jul 4, 2026' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Campaign Automation</h1>
          <p className="text-sm text-[#64748B]">Create, deploy, and monitor email and outreach campaigns.</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 hover:bg-blue-600">
          <Plus className="h-4.5 w-4.5" />
          Create Campaign
        </button>
      </div>

      {/* Stats row */}
      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: 'Active Campaigns', value: '2 Running' },
          { label: 'Total Emails Sent', value: '2,570' },
          { label: 'Average Click Rate', value: '14.8%' },
        ].map((card, i) => (
          <div key={i} className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{card.label}</p>
            <p className="text-2xl font-extrabold text-[#0F172A] mt-1.5">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Campaigns list */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#E2E8F0] p-4.5 bg-[#F8FAFC] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0F172A]">All Campaigns</h3>
          <div className="relative w-64">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input 
              type="text" 
              placeholder="Search campaigns..." 
              className="w-full rounded-lg border border-[#E2E8F0] bg-white py-1.5 pr-4 pl-9 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {campaigns.map((camp) => (
            <div key={camp.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Megaphone className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#0F172A]">{camp.name}</h4>
                  <div className="flex items-center gap-3.5 mt-1 text-xs text-[#64748B]">
                    <span className="font-semibold">{camp.id}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {camp.date}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats column */}
              <div className="flex flex-wrap items-center gap-6 sm:gap-12">
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Outreach</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{camp.sent} Sent</p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Metrics</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{camp.open} Open | {camp.click} Click</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    camp.status === 'Running' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    camp.status === 'Paused' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {camp.status}
                  </span>
                  
                  {/* Actions buttons */}
                  {camp.status === 'Running' ? (
                    <button className="p-2 rounded-lg border border-slate-200 text-amber-600 hover:bg-amber-50/50">
                      <PauseCircle className="h-4.5 w-4.5" />
                    </button>
                  ) : camp.status === 'Paused' ? (
                    <button className="p-2 rounded-lg border border-slate-200 text-emerald-600 hover:bg-emerald-50/50">
                      <Play className="h-4.5 w-4.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
