import { useState, useEffect } from 'react';
import {
  BarChart, PieChart as PieChartIcon,
  TrendingUp, Users, Target, Activity, RefreshCw, Loader2
} from 'lucide-react';
import { dashboardService, type DashboardResponse } from '../services/dashboard.service';
import toast from 'react-hot-toast';

export const AnalyticsReports = () => {
  const [data, setData] = useState<DashboardResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await dashboardService.getStats();
      setData(res.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const funnelStages = [
    { label: 'New Leads', count: data.stats.newLeads, color: 'bg-slate-300' },
    { label: 'Contacted', count: data.stats.contactedLeads, color: 'bg-blue-400' },
    { label: 'Qualified', count: data.stats.qualifiedLeads, color: 'bg-emerald-400' },
    { label: 'Converted', count: data.stats.convertedLeads, color: 'bg-green-500' }
  ];

  const maxFunnelCount = Math.max(...funnelStages.map(s => s.count)) || 1;

  const leadTypes = data.leadTypes || [];

  return (
    <div className="space-y-5 sm:space-y-6 pb-10 px-3 sm:px-6 max-w-full overflow-x-hidden">
      {/* Header: stacks on phone, refresh button full-width on very small screens */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <BarChart className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            Analytics & Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Deep dive into your CRM performance and conversion metrics.</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 active:scale-[0.98] bg-white border border-slate-200 rounded-lg px-4 py-2.5 sm:py-2 w-full sm:w-auto shrink-0"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Top stat cards: 2 cols on phone, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Database', value: data.stats.totalLeads, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Conversion Rate', value: `${((data.stats.convertedLeads / (data.stats.totalLeads || 1)) * 100).toFixed(1)}%`, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Active Campaigns', value: data.stats.activeCampaigns, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Engaged Leads', value: data.stats.engagedLeads, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' }
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3 sm:gap-4 !p-3 sm:!p-4">
            <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
              <s.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-black text-slate-800 truncate">{s.value}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-wider truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Funnel Chart (CSS based) */}
        <div className="card">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-5 sm:mb-6 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500 shrink-0" /> Sales Funnel Conversion
          </h2>
          <div className="space-y-5 sm:space-y-4">
            {funnelStages.map((stage, i) => {
              const width = `${(stage.count / maxFunnelCount) * 100}%`;
              const conversionFromPrev = i === 0 ? null : ((stage.count / (funnelStages[i - 1].count || 1)) * 100).toFixed(1);
              return (
                <div key={stage.label} className="relative">
                  <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                    <span>{stage.label}</span>
                    <span>{stage.count}</span>
                  </div>
                  <div className="h-7 sm:h-8 bg-slate-100 rounded-lg overflow-hidden flex items-center">
                    <div
                      className={`h-full ${stage.color} transition-all duration-1000 ease-out`}
                      style={{ width }}
                    />
                  </div>
                  {conversionFromPrev && (
                    <div className="text-right sm:absolute sm:right-0 sm:top-1 mt-0.5 sm:mt-0 text-[10px] font-bold text-slate-400 sm:bg-white sm:px-1">
                      {conversionFromPrev}% from prev
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead Source Breakdown */}
        {/* Top Campaigns ROI */}
        {data.topCampaigns && data.topCampaigns.length > 0 && (
          <div className="card h-full">
            <h2 className="text-base sm:text-lg font-black text-slate-800 mb-5 sm:mb-6 flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500 shrink-0" /> Campaign ROI (Top Performers)
            </h2>
            <div className="space-y-3 sm:space-y-4">
              {data.topCampaigns.map((camp) => (
                <div key={camp.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                  <div className="flex justify-between items-center mb-2 gap-2">
                    <span className="font-bold text-slate-800 truncate text-sm sm:text-base">{camp.name}</span>
                    <span className="text-[10px] sm:text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md shrink-0 whitespace-nowrap">
                      {camp.conversionRate.toFixed(1)}% Conv.
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] sm:text-xs text-slate-500">
                    <span>Sent: <b>{camp.totalSent}</b></span>
                    <span>Success (Replied/Won): <b>{camp.successCount}</b></span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, camp.conversionRate)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Source Attribution */}
        <div className="card h-full lg:col-span-2">
          <h2 className="text-base sm:text-lg font-black text-slate-800 mb-5 sm:mb-6 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-purple-500 shrink-0" /> Source Attribution & Win Rates
          </h2>
          {/* Horizontal scroll on phone so the table never breaks the page layout */}
          <div className="overflow-x-auto w-full -mx-3 px-3 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[500px] text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-700 whitespace-nowrap">Source Type</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-700 whitespace-nowrap">Total Leads</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-700 whitespace-nowrap">Deals Won</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-700 whitespace-nowrap">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leadTypes.map((type) => (
                  <tr key={type.type} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-800 capitalize whitespace-nowrap">{type.type || 'Unknown'}</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600">{type.count}</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600 font-bold">{type.wonCount}</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-purple-600 w-10 sm:w-12">{type.winRate.toFixed(1)}%</span>
                        <div className="w-16 sm:w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${type.winRate}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rep Performance */}
        <div className="card lg:col-span-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-5 sm:mb-6 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500 shrink-0" /> Rep Performance Matrix
          </h2>
          <div className="overflow-x-auto w-full -mx-3 px-3 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[600px] text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-600 whitespace-nowrap">Sales Rep</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-600 whitespace-nowrap">Total Assigned</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-600 whitespace-nowrap">Activities Logged</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-600 whitespace-nowrap">Deals Won</th>
                  <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-600 whitespace-nowrap">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leaderboard && data.leaderboard.map((rep: any) => {
                  const winRate = ((rep.wonLeads / (rep.totalLeads || 1)) * 100).toFixed(1);
                  return (
                    <tr key={rep.id} className="hover:bg-slate-50">
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap">
                        <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                          {rep.name.charAt(0).toUpperCase()}
                        </div>
                        {rep.name}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600">{rep.totalLeads}</td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600">{rep.activities}</td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-emerald-600">{rep.wonLeads}</td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">{winRate}%</span>
                          <div className="w-12 sm:w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${winRate}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};