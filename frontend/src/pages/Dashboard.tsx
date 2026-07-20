import React, { useEffect, useState } from 'react';
import { 
  Users, 
  TrendingUp, 
  Target, 
  Sparkles,
  UserCheck,
  AlertCircle,
  MessageCircle,
  PhoneCall,
  Mail,
  MessageSquare,
  Phone,
  Clock,
  ArrowRight,
  Activity,
  Trophy,
  Medal,
  Award,
  CalendarClock,
  Phone as PhoneIcon
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
    return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;
  }

  const stats = data?.stats || { 
    totalLeads: 0, newLeads: 0, contactedLeads: 0, qualifiedLeads: 0, 
    convertedLeads: 0, unverifiedLeads: 0, activeLeads: 0, 
    engagedLeads: 0, activeCampaigns: 0 
  };
  const analytics = data?.analytics || [];
  const recentCommunications = data?.recentCommunications || [];
  const leaderboard = data?.leaderboard || [];
  const todaysFollowUps = (data as any)?.todaysFollowUps || [];
  const overdueFollowUpsCount = (data as any)?.overdueFollowUpsCount || 0;

  const statCards = [
    { 
      name: 'Total Leads', 
      value: stats.totalLeads, 
      icon: <Users className="h-5 w-5 text-blue-600" />, 
      bg: 'bg-blue-50',
      action: () => navigate('/leads', { state: { unifiedStatus: 'All' } })
    },
    { 
      name: 'New Leads', 
      value: stats.newLeads, 
      icon: <Sparkles className="h-5 w-5 text-indigo-600" />, 
      bg: 'bg-indigo-50',
      action: () => navigate('/leads', { state: { unifiedStatus: 'NEW' } })
    },
    { 
      name: 'Contacted', 
      value: stats.contactedLeads, 
      icon: <PhoneCall className="h-5 w-5 text-amber-600" />, 
      bg: 'bg-amber-50',
      action: () => navigate('/leads', { state: { unifiedStatus: 'CONTACTED_OR_FOLLOW_UP' } })
    },
    { 
      name: 'Qualified', 
      value: stats.qualifiedLeads, 
      icon: <Target className="h-5 w-5 text-emerald-600" />, 
      bg: 'bg-emerald-50',
      action: () => navigate('/leads', { state: { unifiedStatus: 'QUALIFIED' } })
    },
    { 
      name: 'Client Won', 
      value: stats.convertedLeads, 
      icon: <UserCheck className="h-5 w-5 text-green-600" />, 
      bg: 'bg-green-50',
      action: () => navigate('/leads', { state: { unifiedStatus: 'WON' } })
    },
    { 
      name: 'Engaged Leads', 
      value: stats.engagedLeads, 
      icon: <MessageCircle className="h-5 w-5 text-purple-600" />, 
      bg: 'bg-purple-50',
      action: () => navigate('/leads', { state: { unifiedStatus: 'ENGAGED' } })
    },
    { 
      name: 'Unverified', 
      value: stats.unverifiedLeads, 
      icon: <AlertCircle className="h-5 w-5 text-rose-600" />, 
      bg: 'bg-rose-50',
      action: () => navigate('/leads', { state: { unifiedStatus: 'UNVERIFIED' } })
    },
    { 
      name: 'Active Campaigns', 
      value: stats.activeCampaigns, 
      icon: <TrendingUp className="h-5 w-5 text-cyan-600" />, 
      bg: 'bg-cyan-50',
      action: () => navigate('/campaigns')
    },
  ];


  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">Dashboard Overview</h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">Welcome back! Here is a summary of your lead pipelines and campaigns.</p>
        </div>
        <div className="flex items-center gap-3">
          {overdueFollowUpsCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 animate-pulse">
              ⚠️ {overdueFollowUpsCount} Overdue Follow-Up{overdueFollowUpsCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Live DB Connected
          </span>
        </div>
      </div>

      {/* 8 Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            onClick={stat.action}
            className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/60 p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer group"
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-white/40 to-transparent blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
            <div className="flex items-center justify-between relative z-10">
              <div className={`rounded-2xl p-3 ${stat.bg} shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>{stat.icon}</div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <ArrowRight className="h-4 w-4 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
              </div>
            </div>
            <div className="mt-5 relative z-10">
              <h3 className="text-sm font-semibold text-slate-500">{stat.name}</h3>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-3xl font-extrabold tracking-tight text-slate-800">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-4">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Lead Generation Analytics</h2>
              <p className="text-xs text-[#64748B]">Monthly performance overview</p>
            </div>
          </div>
          <div className="mt-8 flex h-60 items-end gap-4 px-2">
            {analytics.map((bar, idx) => (
              <div key={idx} className="group flex flex-1 flex-col items-center gap-3">
                <div className="relative w-full rounded-xl bg-slate-50 overflow-hidden border border-slate-100 transition-all hover:bg-slate-100 hover:border-slate-200 shadow-inner" style={{ height: '200px' }}>
                  <div 
                    className="absolute bottom-0 w-full rounded-xl bg-gradient-to-t from-indigo-500 to-blue-400 transition-all duration-500 group-hover:from-indigo-600 group-hover:to-blue-500" 
                    style={{ height: bar.value }}
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-white opacity-0 transition-all duration-300 group-hover:-top-8 group-hover:opacity-100 shadow-lg z-10 whitespace-nowrap">
                     {bar.value}
                     <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 transition-colors">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card shadow-sm border-slate-100 hover:shadow-md transition-shadow duration-300">
          <h2 className="text-base font-bold text-slate-800">Sales Pipeline</h2>
          <p className="text-xs text-slate-500">Dynamic categorization by sales stage</p>
          <div className="mt-6 space-y-4">
            {(data?.leadsByStatus || []).map((item, idx) => {
              const colors = ['bg-indigo-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-600', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];
              const color = colors[idx % colors.length];
              const percent = stats.totalLeads ? (item.count / stats.totalLeads) * 100 : 0;
              return (
              <div 
                key={idx} 
                className="space-y-1.5 group cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors"
                onClick={() => navigate('/leads', { state: { unifiedStatus: mapSalesStageToUnifiedStatus(item.status || '') } })}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{item.status || 'Unassigned'}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{item.count}</span>
                    <span className="text-[10px] text-slate-400 font-medium w-8 text-right">{percent.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100/80 overflow-hidden shadow-inner">
                  <div className={`h-full rounded-full ${color} transition-all duration-1000 relative`} style={{ width: `${percent}%` }}>
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>
              </div>
            )})}
            {(!data?.leadsByStatus || data.leadsByStatus.length === 0) && (
              <div className="text-center text-sm text-slate-500 py-8">No statuses found</div>
            )}
          </div>
        </div>
        <div className="card">
          <h2 className="text-base font-bold text-[#0F172A]">Lead Types</h2>
          <p className="text-xs text-[#64748B]">Distribution of total leads</p>
          <div className="mt-6 space-y-4 flex flex-col justify-center h-[calc(100%-4rem)]">
            {data?.leadTypes?.map((item, idx) => {
              const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];
              const color = colors[idx % colors.length];
              const percent = stats.totalLeads ? (item.count / stats.totalLeads) * 100 : 0;
              return (
                <div 
                  key={idx} 
                  className="space-y-1.5 group cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors"
                  onClick={() => navigate('/leads', { state: { typeFilter: item.type } })}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{item.type}</span>
                    <span className="font-bold text-[#0F172A]">{item.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
            {(!data?.leadTypes || data.leadTypes.length === 0) && (
              <div className="text-center text-sm text-slate-500 py-8">No leads found</div>
            )}
          </div>
        </div>
      </div>

      {/* Gamification / Leaderboard Section */}
      {leaderboard.length > 0 && (
        <div className="card mt-6">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Sales Leaderboard</h2>
              <p className="text-xs text-slate-500">Top performers this month based on converted leads & activity.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {leaderboard.map((user, index) => {
              const isTop = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;
              
              return (
                <div 
                  key={user.id} 
                  className={`relative overflow-hidden flex flex-col rounded-xl border p-4 transition-all hover:-translate-y-1 hover:shadow-lg ${
                    isTop ? 'bg-gradient-to-br from-yellow-50 to-white border-yellow-200' :
                    isSecond ? 'bg-gradient-to-br from-slate-50 to-white border-slate-200' :
                    isThird ? 'bg-gradient-to-br from-orange-50 to-white border-orange-200' :
                    'bg-white border-slate-100'
                  }`}
                >
                  {isTop && <div className="absolute -right-4 -top-4 text-yellow-500 opacity-10"><Trophy className="h-24 w-24" /></div>}
                  
                  <div className="flex justify-between items-start z-10 relative">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm" />
                        ) : (
                          <div className={`h-10 w-10 flex items-center justify-center rounded-full text-sm font-bold shadow-sm border-2 border-white ${
                            isTop ? 'bg-yellow-500 text-white' : 
                            isSecond ? 'bg-slate-400 text-white' : 
                            isThird ? 'bg-orange-400 text-white' : 
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white ${
                          isTop ? 'bg-yellow-500 text-white' : 
                          isSecond ? 'bg-slate-400 text-white' : 
                          isThird ? 'bg-orange-400 text-white' : 
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {index + 1}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-800">{user.name}</h3>
                        <p className="text-[11px] text-slate-500">{user.score} pts</p>
                      </div>
                    </div>
                    {isTop ? <Trophy className="h-5 w-5 text-yellow-500" /> : 
                     isSecond ? <Medal className="h-5 w-5 text-slate-400" /> : 
                     isThird ? <Medal className="h-5 w-5 text-orange-400" /> : 
                     <Award className="h-5 w-5 text-slate-300" />}
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-2 z-10 relative">
                    <div className="bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-white">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Converted</p>
                      <p className="text-lg font-black text-emerald-600">{user.wonLeads}</p>
                    </div>
                    <div className="bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-white">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Activities</p>
                      <p className="text-lg font-black text-blue-600">{user.activities}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Side-by-Side: Trace and Follow-ups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Communication Trace Report */}
        <div className="card flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-[#0F172A]">Recent Communications Trace</h2>
          </div>
          
          {recentCommunications.length > 0 ? (
            <div className="space-y-3 flex-1 overflow-y-auto pr-1" style={{ maxHeight: '400px' }}>
              {recentCommunications.map((event) => {
                // Determine styles based on eventType and channel
                let icon = <Mail className="h-4 w-4" />;
                let colorClass = 'text-blue-600 bg-blue-50 border-blue-100';
                
                if (event.channel === 'WHATSAPP') {
                  icon = <MessageSquare className="h-4 w-4" />;
                  colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-100';
                } else if (event.channel === 'SMS') {
                  icon = <Phone className="h-4 w-4" />;
                  colorClass = 'text-amber-600 bg-amber-50 border-amber-100';
                }

                let statusColor = 'bg-slate-100 text-slate-600';
                let nextStep = 'Wait for response';
                if (event.eventType === 'SENT') {
                  statusColor = 'bg-blue-100 text-blue-700';
                  nextStep = 'Wait for delivery';
                } else if (event.eventType === 'DELIVERED') {
                  statusColor = 'bg-cyan-100 text-cyan-700';
                  nextStep = 'Wait for open/read';
                } else if (event.eventType === 'OPENED' || event.eventType === 'READ') {
                  statusColor = 'bg-purple-100 text-purple-700';
                  nextStep = 'Follow up via call';
                } else if (event.eventType === 'CLICKED') {
                  statusColor = 'bg-amber-100 text-amber-700';
                  nextStep = 'Hot lead - call immediately';
                } else if (event.eventType === 'REPLIED') {
                  statusColor = 'bg-emerald-100 text-emerald-800';
                  nextStep = 'Respond to reply';
                } else if (event.eventType === 'BOUNCED' || event.eventType === 'FAILED') {
                  statusColor = 'bg-red-100 text-red-700';
                  nextStep = 'Update contact info';
                }

                return (
                  <div 
                    key={event.id} 
                    className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-xl border border-white/40 bg-white/60 p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] backdrop-blur-sm hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 transition-all cursor-pointer gap-4" 
                    onClick={() => navigate(`/leads`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl border shadow-sm ${colorClass} group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}>
                        {icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-800 text-sm truncate max-w-[150px]" title={event.lead.name}>{event.lead.name}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusColor}`}>
                            {event.eventType}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 truncate max-w-[200px]" title={event.campaign?.name || 'Direct Message'}>
                          {event.campaign?.name || 'Direct Message'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0 gap-2 sm:gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {new Date(event.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                        <span>{nextStep}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-8 bg-slate-50 rounded-xl border border-slate-100 border-dashed flex-1 flex flex-col justify-center">
              <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No recent communications found.</p>
            </div>
          )}
        </div>

        {/* Today's Follow-Up Widget */}
        <div className="card flex flex-col h-full">
          {todaysFollowUps.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-5">
                <CalendarClock className="h-6 w-6 text-amber-500" />
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-slate-800">Today's Follow-Ups</h2>
                  <p className="text-xs text-slate-500">{todaysFollowUps.length} lead{todaysFollowUps.length > 1 ? 's' : ''} scheduled for contact today.</p>
                </div>
                {overdueFollowUpsCount > 0 && (
                  <span className="text-xs font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full shrink-0">
                    + {overdueFollowUpsCount} overdue
                  </span>
                )}
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto pr-1" style={{ maxHeight: '400px' }}>
                {todaysFollowUps.map((lead: any) => (
                  <div key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} className="group flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 cursor-pointer transition-all">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-sm">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{lead.name}</p>
                      {lead.followUpNotes && <p className="text-xs text-slate-500 truncate">{lead.followUpNotes}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-slate-400 hover:text-blue-600 transition-colors">
                          <PhoneIcon className="h-4 w-4" />
                        </a>
                      )}
                      <span className="text-xs font-medium text-amber-600 whitespace-nowrap">
                        {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <CalendarClock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <h2 className="text-lg font-bold text-slate-800">Today's Follow-Ups</h2>
              <p className="text-slate-500 text-sm mt-1">No follow-ups scheduled for today. You're all caught up!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
