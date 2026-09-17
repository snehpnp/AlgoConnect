import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Sparkles, Mail, ArrowRight, Activity,
  Database, Globe, Building2, MapPin, CheckSquare,
  AlertTriangle, Filter, MonitorPlay, MailWarning, FileText, Briefcase,
  Trophy, Send, Eye, MousePointerClick, XCircle, Clock, UserCheck
} from 'lucide-react';
import { dashboardService } from '../services/dashboard.service';
import type { DashboardResponse } from '../services/dashboard.service';
import { useNavigate } from 'react-router-dom';

const mapSalesStageToUnifiedStatus = (stage: string) => {
  const map: Record<string, string> = {
    'New': 'NEW',
    'Contacted': 'CONTACTED',
    'Follow-up': 'FOLLOW_UP',
    'Qualified': 'QUALIFIED',
    'Negotiation': 'NEGOTIATION',
    'Client Won': 'WON',
    'Client Lost': 'LOST',
    'Do Not Contact': 'DNC'
  };
  return map[stage] || 'All';
};

// Reusable thin progress bar for rates / coverage — muted, single-tone fill
const ProgressBar: React.FC<{ value: number; colorClass: string; trackClass?: string }> = ({ value, colorClass, trackClass = 'bg-slate-100' }) => (
  <div className={`h-1 w-full rounded-full ${trackClass} overflow-hidden`}>
    <div
      className={`h-full rounded-full ${colorClass} transition-all duration-500`}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

const RANK_STYLES = [
  { badge: 'bg-amber-100 text-amber-700 border border-amber-200' },
  { badge: 'bg-slate-100 text-slate-600 border border-slate-200' },
  { badge: 'bg-orange-50 text-orange-600 border border-orange-200' },
];

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Gathering insights...</p>
      </div>
    );
  }

  const stats = data?.stats || {
    totalLeads: 0, newLeads: 0, contactedLeads: 0, qualifiedLeads: 0,
    convertedLeads: 0, unverifiedLeads: 0, activeLeads: 0,
    engagedLeads: 0, activeCampaigns: 0, totalEmailCampaigns: 0,
    completedCampaigns: 0, totalSegments: 0, totalSmsTemplates: 0
  };

  const coverage = data?.coverageStats || {
    withEmail: 0, withoutEmail: 0, withEmail2: 0, withoutEmail2: 0,
    withPhone: 0, withoutPhone: 0, withWebsite: 0, withoutWebsite: 0,
    withAlgo: 0, withoutAlgo: 0, withOtherListings: 0, withoutOtherListings: 0
  };

  const leadTypes = data?.leadTypes || [];
  const leadsByStatus = data?.leadsByStatus || [];
  const exchangeStats = data?.exchangeStats || [];
  const stateStats = data?.stateStats || [];
  const topCampaigns = data?.topCampaigns || [];
  const leaderboard = data?.leaderboard || [];
  const activities = data?.activities || [];
  const emailEngagement = data?.emailEngagement || { sent: 0, opened: 0, replied: 0, bounced: 0, failed: 0 };

  const overdueFollowUpsCount = data?.overdueFollowUpsCount || 0;
  const bouncedLeads = data?.bouncedLeads || 0;
  const importedLeads = data?.importedLeads || 0;
  const invalidLeads = data?.invalidLeads || 0;

  const totalLeadsSafe = Math.max(1, stats.totalLeads);
  const openRate = emailEngagement.sent > 0 ? (emailEngagement.opened / emailEngagement.sent) * 100 : 0;
  const bounceRate = emailEngagement.sent > 0 ? (emailEngagement.bounced / emailEngagement.sent) * 100 : 0;
  const replyRate = emailEngagement.sent > 0 ? (emailEngagement.replied / emailEngagement.sent) * 100 : 0;
  const maxLeaderScore = Math.max(1, ...leaderboard.map((p: any) => p.score || 0));
  const maxCampaignSent = Math.max(1, ...topCampaigns.map((c: any) => c.totalSent || 0));

  // Key KPI Cards — white cards, tinted icon badge + colored bottom accent, not full gradient fills
  const kpiCards = [
    {
      name: 'Total Leads',
      value: stats.totalLeads,
      icon: <Database className="h-5 w-5 text-indigo-600" />,
      bg: 'bg-indigo-50',
      accent: 'bg-indigo-500',
      action: () => navigate('/leads')
    },
    {
      name: 'Engaged Leads',
      value: stats.engagedLeads,
      icon: <UserCheck className="h-5 w-5 text-violet-600" />,
      bg: 'bg-violet-50',
      accent: 'bg-violet-500',
      action: () => navigate('/leads', { state: { unifiedStatus: 'ENGAGED' } })
    },
    {
      name: 'Bounced Leads',
      value: bouncedLeads,
      icon: <MailWarning className="h-5 w-5 text-rose-600" />,
      bg: 'bg-rose-50',
      accent: 'bg-rose-500',
      action: () => navigate('/leads', { state: { unifiedStatus: 'BOUNCED' } })
    },
    {
      name: 'Overdue Follow-ups',
      value: overdueFollowUpsCount,
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      bg: 'bg-amber-50',
      accent: 'bg-amber-500',
      action: () => navigate('/leads', { state: { unifiedStatus: 'OVERDUE' } })
    },
    {
      name: 'Active Campaigns',
      value: stats.activeCampaigns,
      icon: <TrendingUp className="h-5 w-5 text-emerald-600" />,
      bg: 'bg-emerald-50',
      accent: 'bg-emerald-500',
      action: () => navigate('/campaigns')
    }
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-24 sm:pb-10 px-3 sm:px-6 pt-2 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between px-1 sm:px-0 mb-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Intelligence Hub
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1 font-medium">Explore segments, monitor health, and drive conversions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {overdueFollowUpsCount > 0 && (
            <span
              onClick={() => navigate('/leads', { state: { unifiedStatus: 'OVERDUE' } })}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
            >
              ⚠️ {overdueFollowUpsCount} Overdue Follow-Up(s)
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 whitespace-nowrap shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Live DB Sync
          </span>
        </div>
      </div>

      {/* KPI Row — clean white cards, colored icon badge + thin bottom accent line */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi, idx) => (
          <div
            key={idx}
            onClick={kpi.action}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
          >
            <div className={`absolute bottom-0 left-0 right-0 h-1 ${kpi.accent}`}></div>
            <div className="flex items-center justify-between">
              <div className={`rounded-xl p-2.5 ${kpi.bg}`}>
                {kpi.icon}
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="mt-5">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">{kpi.name}</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight mt-1">{kpi.value.toLocaleString()}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Main working row: campaign performance + engagement (wide) | leaderboard + activity (narrow) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* LEFT / WIDE column — 2 of 3 */}
        <div className="xl:col-span-2 space-y-6">

          {/* Email Engagement Funnel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4.5 w-4.5 text-slate-400" />
                <h3 className="text-base font-bold text-slate-800">Email Engagement</h3>
              </div>
              <span className="text-xs font-medium text-slate-400">{emailEngagement.sent.toLocaleString()} sent</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <Send className="h-4 w-4 text-slate-400 mb-2" />
                <p className="text-lg font-bold text-slate-800">{emailEngagement.sent.toLocaleString()}</p>
                <p className="text-[11px] font-medium text-slate-500">Sent</p>
              </div>
              <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3">
                <Eye className="h-4 w-4 text-indigo-500 mb-2" />
                <p className="text-lg font-bold text-indigo-700">{emailEngagement.opened.toLocaleString()}</p>
                <p className="text-[11px] font-medium text-indigo-500 mb-1.5">Opened · {openRate.toFixed(0)}%</p>
                <ProgressBar value={openRate} colorClass="bg-indigo-400" trackClass="bg-indigo-100" />
              </div>
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-3">
                <MousePointerClick className="h-4 w-4 text-emerald-500 mb-2" />
                <p className="text-lg font-bold text-emerald-700">{emailEngagement.replied.toLocaleString()}</p>
                <p className="text-[11px] font-medium text-emerald-500">Replied</p>
              </div>
              <div className="rounded-xl bg-rose-50/60 border border-rose-100 p-3">
                <MailWarning className="h-4 w-4 text-rose-500 mb-2" />
                <p className="text-lg font-bold text-rose-700">{emailEngagement.bounced.toLocaleString()}</p>
                <p className="text-[11px] font-medium text-rose-500 mb-1.5">Bounced · {bounceRate.toFixed(0)}%</p>
                <ProgressBar value={bounceRate} colorClass="bg-rose-400" trackClass="bg-rose-100" />
              </div>
              <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                <XCircle className="h-4 w-4 text-amber-500 mb-2" />
                <p className="text-lg font-bold text-amber-700">{emailEngagement.failed.toLocaleString()}</p>
                <p className="text-[11px] font-medium text-amber-500">Failed</p>
              </div>
            </div>
          </div>

          {/* Campaign Performance Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4.5 w-4.5 text-slate-400" />
              <h3 className="text-base font-bold text-slate-800">Campaign Performance</h3>
            </div>
            <div className="space-y-3">
              {topCampaigns.map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => navigate('/campaigns', { state: { campaignId: c.id } })}
                  className="group p-3 rounded-xl bg-slate-50/60 hover:bg-slate-100 border border-transparent cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-sm font-semibold text-slate-700 truncate">{c.name || 'Untitled campaign'}</p>
                      <p className="text-[11px] font-medium text-slate-400">{c.type} · {c.totalSent.toLocaleString()} sent · {c.successCount.toLocaleString()} won</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md whitespace-nowrap">
                      {(c.conversionRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={(c.totalSent / maxCampaignSent) * 100} colorClass="bg-emerald-400" trackClass="bg-slate-100" />
                </div>
              ))}
              {topCampaigns.length === 0 && <p className="text-sm text-slate-400">No campaign data available.</p>}
            </div>
          </div>

          {/* Pipeline + Import health, side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4.5 w-4.5 text-slate-400" />
                <h3 className="text-base font-bold text-slate-800">Pipeline Status</h3>
              </div>
              <div className="space-y-3">
                {leadsByStatus.map((status, idx) => {
                  const unified = mapSalesStageToUnifiedStatus(status.status);
                  const pct = (status.count / totalLeadsSafe) * 100;
                  return (
                    <div key={idx} onClick={() => navigate('/leads', { state: { unifiedStatus: unified } })} className="group p-2.5 rounded-xl bg-slate-50/60 hover:bg-slate-100 border border-transparent cursor-pointer transition-all">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-slate-700">{status.status}</span>
                        <span className="text-sm font-bold text-slate-800">{status.count.toLocaleString()}</span>
                      </div>
                      <ProgressBar value={pct} colorClass="bg-blue-400" trackClass="bg-slate-100" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="h-4.5 w-4.5 text-slate-400" />
                <h3 className="text-base font-bold text-slate-800">Import Health</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div onClick={() => navigate('/leads', { state: { unifiedStatus: 'IMPORTED' } })} className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl border border-slate-100 cursor-pointer transition-all">
                  <p className="text-xs font-semibold text-slate-500">Imported</p>
                  <p className="text-xl font-bold text-slate-800">{importedLeads.toLocaleString()}</p>
                </div>
                <div onClick={() => navigate('/leads', { state: { unifiedStatus: 'INVALID' } })} className="bg-rose-50 hover:bg-rose-100 p-3 rounded-xl border border-rose-100 cursor-pointer transition-all">
                  <p className="text-xs font-semibold text-rose-600">Invalid / Dupe</p>
                  <p className="text-xl font-bold text-rose-700">{invalidLeads.toLocaleString()}</p>
                </div>
                <div onClick={() => navigate('/leads', { state: { unifiedStatus: 'BOUNCED' } })} className="bg-amber-50 hover:bg-amber-100 p-3 rounded-xl border border-amber-100 cursor-pointer transition-all">
                  <p className="text-xs font-semibold text-amber-600">Bounced</p>
                  <p className="text-xl font-bold text-amber-700">{bouncedLeads.toLocaleString()}</p>
                </div>
                <div onClick={() => navigate('/leads', { state: { unifiedStatus: 'OVERDUE' } })} className="bg-red-50 hover:bg-red-100 p-3 rounded-xl border border-red-100 cursor-pointer transition-all">
                  <p className="text-xs font-semibold text-red-600">Overdue</p>
                  <p className="text-xl font-bold text-red-700">{overdueFollowUpsCount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT / NARROW column — 1 of 3: who's doing the work, right now */}
        <div className="space-y-6">

          {/* Leaderboard */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4.5 w-4.5 text-slate-400" />
              <h3 className="text-base font-bold text-slate-800">Top Performers</h3>
            </div>
            <div className="space-y-3">
              {leaderboard.map((person: any, idx: number) => {
                const style = RANK_STYLES[idx] || { badge: 'bg-slate-100 text-slate-500 border border-slate-200' };
                const pct = (person.score / maxLeaderScore) * 100;
                return (
                  <div key={person.id} className="p-2.5 rounded-xl bg-slate-50/60 border border-transparent hover:bg-slate-100 transition-all">
                    <div className="flex items-center gap-3">
                      <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ${style.badge}`}>{idx + 1}</span>
                      {person.avatar ? (
                        <img src={person.avatar} alt={person.name} className="h-8 w-8 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold border border-indigo-100">
                          {person.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-700 truncate">{person.name}</p>
                        <p className="text-[11px] font-medium text-slate-400">{person.activities.toLocaleString()} activities</p>
                      </div>
                      <span className="text-sm font-bold text-slate-800 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">{person.score.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 ml-9"><ProgressBar value={pct} colorClass="bg-amber-400" trackClass="bg-slate-100" /></div>
                  </div>
                );
              })}
              {leaderboard.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
            </div>
          </div>

          {/* Live Activity feed */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4.5 w-4.5 text-slate-400" />
              <h3 className="text-base font-bold text-slate-800">Live Activity</h3>
            </div>
            <div className="space-y-3">
              {activities.slice(0, 6).map((act: any) => (
                <div key={act.id} className="flex gap-3 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0"></div>
                  <div className="min-w-0">
                    <p className="text-slate-700 font-medium leading-snug">{act.details}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
              {activities.length === 0 && <p className="text-sm text-slate-400">No recent activity.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Segment filters section */}
      <div className="mt-8 mb-4 border-b border-slate-200 pb-2">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Filter className="h-5 w-5 text-slate-400" />
          Lead Segments & Filters
        </h2>
        <p className="text-sm text-slate-500">Quickly dive into specific categories to take action.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Categories / Types Filter Cards */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-4.5 w-4.5 text-slate-400" />
            <h3 className="text-base font-bold text-slate-800">Entity Types</h3>
          </div>
          <div className="space-y-3 flex-1">
            {leadTypes.map((type, idx) => {
              const pct = (type.count / totalLeadsSafe) * 100;
              return (
                <div key={idx} onClick={() => navigate('/leads', { state: { typeFilter: type.type } })} className="group p-3 rounded-xl bg-slate-50/60 hover:bg-slate-100 border border-transparent cursor-pointer transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700">{type.type}</span>
                      {type.winRate > 0 && <span className="text-[10px] font-medium text-emerald-600">{type.winRate.toFixed(1)}% Win Rate</span>}
                    </div>
                    <span className="text-sm font-bold text-slate-800">{type.count.toLocaleString()}</span>
                  </div>
                  <ProgressBar value={pct} colorClass="bg-purple-400" trackClass="bg-slate-100" />
                </div>
              );
            })}
            {leadTypes.length === 0 && <p className="text-sm text-slate-400">No entity types available.</p>}
          </div>
        </div>

        {/* Data Attributes & Coverage Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <CheckSquare className="h-4.5 w-4.5 text-slate-400" />
            <h3 className="text-base font-bold text-slate-800">Data Coverage</h3>
          </div>
          <div className="space-y-3 flex-1">
            {[
              { label: 'Has Website', value: coverage.withWebsite, icon: <Globe className="w-4 h-4" />, filter: { dataFilter: 'HasWebsite' } },
              { label: 'Has Email', value: coverage.withEmail, icon: <Mail className="w-4 h-4" />, filter: { dataFilter: 'MissingEmail' } },
              { label: 'Sells Algo Trading', value: coverage.withAlgo, icon: <MonitorPlay className="w-4 h-4" />, filter: { algoTradingFilter: 'Yes' } },
              { label: 'Other Listings Present', value: coverage.withOtherListings, icon: <FileText className="w-4 h-4" />, filter: { otherListingsFilter: 'Yes' } },
            ].map((row, idx) => {
              const pct = (row.value / totalLeadsSafe) * 100;
              return (
                <div key={idx} onClick={() => navigate('/leads', { state: row.filter })} className="group p-2.5 rounded-xl bg-slate-50/60 hover:bg-slate-100 border border-transparent cursor-pointer transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><span className="text-slate-400">{row.icon}</span> {row.label}</span>
                    <span className="text-sm font-bold text-slate-800">{row.value.toLocaleString()}</span>
                  </div>
                  <ProgressBar value={pct} colorClass="bg-emerald-400" trackClass="bg-slate-100" />
                </div>
              );
            })}
          </div>
        </div>

        {/* State/Geographical Filter */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4.5 w-4.5 text-slate-400" />
            <h3 className="text-base font-bold text-slate-800">Top Regions (States)</h3>
          </div>
          <div className="space-y-2.5 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
            {stateStats.slice(0, 10).map((state, idx) => (
              <div key={idx} onClick={() => navigate('/leads', { state: { stateFilter: state.name } })} className="group flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 hover:bg-slate-100 border border-transparent cursor-pointer transition-all">
                <span className="text-sm font-semibold text-slate-700 truncate mr-2">{state.name}</span>
                <span className="text-sm font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md">{state.count.toLocaleString()}</span>
              </div>
            ))}
            {stateStats.length === 0 && <p className="text-sm text-slate-400">No regional data available.</p>}
          </div>
        </div>
      </div>

      {/* Exchange Filter — full width, since it's a long tail list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-4.5 w-4.5 text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">Top Exchanges</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {exchangeStats.slice(0, 10).map((ex, idx) => (
            <div key={idx} onClick={() => navigate('/leads', { state: { exchangeNameFilter: ex.name } })} className="group flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 hover:bg-slate-100 border border-transparent cursor-pointer transition-all">
              <span className="text-[11px] font-semibold text-slate-700 truncate mr-2" title={ex.name}>{ex.name}</span>
              <span className="text-sm font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md">{ex.count.toLocaleString()}</span>
            </div>
          ))}
          {exchangeStats.length === 0 && <p className="text-sm text-slate-400 col-span-3">No exchange data available.</p>}
        </div>
      </div>

    </div>
  );
};