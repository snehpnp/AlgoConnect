import React, { useEffect, useState } from 'react';
import { 
  Users, 
  TrendingUp, 
  Target, 
  Activity,
  Sparkles
} from 'lucide-react';
import { dashboardService } from '../services/dashboard.service';
import type { DashboardResponse } from '../services/dashboard.service';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await dashboardService.getStats();
        setData(result.data);
      } catch (error) {
        console.error('Failed to load dashboard stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  }

  const stats = data?.stats || { totalLeads: 0, qualifiedLeads: 0, pendingLeads: 0, closedLeads: 0, activeCampaigns: 0 };
  const analytics = data?.analytics || [];

  const statCards = [
    { 
      name: 'Total Leads', 
      value: stats.totalLeads, 
      change: '+0%', 
      positive: true, 
      icon: <Users className="h-5 w-5 text-blue-600" />, 
      bg: 'bg-blue-50' 
    },
    { 
      name: 'Qualified Leads', 
      value: stats.qualifiedLeads, 
      change: '+0%', 
      positive: true, 
      icon: <Target className="h-5 w-5 text-emerald-600" />, 
      bg: 'bg-emerald-50' 
    },
    { 
      name: 'Active Campaigns', 
      value: stats.activeCampaigns, 
      change: '0%', 
      positive: true, 
      icon: <TrendingUp className="h-5 w-5 text-indigo-600" />, 
      bg: 'bg-indigo-50' 
    },
    { 
      name: 'Conversion Rate', 
      value: stats.totalLeads > 0 ? `${Math.round((stats.closedLeads / stats.totalLeads) * 100)}%` : '0%', 
      change: '0%', 
      positive: false, 
      icon: <Activity className="h-5 w-5 text-amber-600" />, 
      bg: 'bg-amber-50' 
    },
  ];

  const totalDist = stats.qualifiedLeads + stats.pendingLeads + stats.closedLeads;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Dashboard Overview</h1>
          <p className="text-sm text-[#64748B]">Welcome back! Here is a summary of your lead pipelines and campaigns.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Live DB Connected
          </span>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <div key={i} className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`rounded-xl p-3 ${stat.bg}`}>{stat.icon}</div>
              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold ${
                stat.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
              }`}>
                {stat.change}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-[#64748B]">{stat.name}</h3>
              <p className="mt-1 text-3xl font-bold tracking-tight text-[#0F172A]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Lead Generation Analytics</h2>
              <p className="text-xs text-[#64748B]">Monthly performance overview</p>
            </div>
          </div>
          <div className="mt-8 flex h-60 items-end gap-5 px-2">
            {analytics.map((bar, idx) => (
              <div key={idx} className="group flex flex-1 flex-col items-center gap-3">
                <div className="relative w-full rounded-t-lg bg-slate-100 transition-all hover:bg-slate-200" style={{ height: '200px' }}>
                  <div 
                    className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-primary/80 to-primary transition-all group-hover:from-primary group-hover:to-blue-600" 
                    style={{ height: bar.value }}
                  >
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {bar.value}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#64748B]">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#0F172A]">Lead Distribution</h2>
          <p className="text-xs text-[#64748B]">Categorized by current pipeline state</p>
          <div className="mt-6 space-y-4">
            {[
              { label: 'New Leads', count: stats.qualifiedLeads, color: 'bg-emerald-500', percent: totalDist ? (stats.qualifiedLeads/totalDist)*100 : 0 },
              { label: 'Contacted', count: stats.pendingLeads, color: 'bg-amber-500', percent: totalDist ? (stats.pendingLeads/totalDist)*100 : 0 },
              { label: 'Converted', count: stats.closedLeads, color: 'bg-blue-600', percent: totalDist ? (stats.closedLeads/totalDist)*100 : 0 },
            ].map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{item.label}</span>
                  <span className="font-bold text-[#0F172A]">{item.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
