import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Search } from 'lucide-react';
import { campaignService } from '../services/campaign.service';
import type { Campaign } from '../services/campaign.service';

export const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await campaignService.getCampaigns();
        setCampaigns(response.data);
      } catch (error) {
        console.error('Failed to load campaigns:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length;

  return (
    <div className="space-y-8 animate-fade-in">
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

      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: 'Active Campaigns', value: `${activeCount} Running` },
          { label: 'Total Campaigns', value: campaigns.length.toString() },
          { label: 'Latest Update', value: campaigns.length > 0 ? new Date(campaigns[0].updatedAt).toLocaleDateString() : 'N/A' },
        ].map((card, i) => (
          <div key={i} className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{card.label}</p>
            <p className="text-2xl font-extrabold text-[#0F172A] mt-1.5">{card.value}</p>
          </div>
        ))}
      </div>

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

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-white">
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Campaign Name</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Type</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#64748B] uppercase tracking-wider text-right">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#64748B]">Loading campaigns...</td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#64748B]">No campaigns found. Database is empty.</td>
                </tr>
              ) : (
                campaigns.map((camp) => (
                  <tr key={camp.id} className="group hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <Megaphone className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#0F172A] group-hover:text-primary transition-colors">{camp.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-semibold text-[#0F172A]">{camp.type}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                        camp.status === 'ACTIVE' 
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}>
                        {camp.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-sm font-medium text-[#64748B]">{new Date(camp.createdAt).toLocaleDateString()}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
