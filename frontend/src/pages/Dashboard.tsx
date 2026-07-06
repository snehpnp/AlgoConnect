import React from 'react';
import { 
  Users, 
  Megaphone, 
  Target, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const stats = [
    {
      name: 'Total Leads',
      value: '12,458',
      change: '+14.2%',
      positive: true,
      icon: <Users className="h-5 w-5 text-primary" />,
      bg: 'bg-blue-50',
    },
    {
      name: 'Active Campaigns',
      value: '18',
      change: '+4.3%',
      positive: true,
      icon: <Megaphone className="h-5 w-5 text-emerald-600" />,
      bg: 'bg-emerald-50',
    },
    {
      name: 'Conversion Rate',
      value: '4.82%',
      change: '+1.2%',
      positive: true,
      icon: <Target className="h-5 w-5 text-indigo-600" />,
      bg: 'bg-indigo-50',
    },
    {
      name: 'Response Rate',
      value: '68.4%',
      change: '-2.1%',
      positive: false,
      icon: <Clock className="h-5 w-5 text-amber-600" />,
      bg: 'bg-amber-50',
    },
  ];

  const recentActivities = [
    { id: 1, lead: 'Alice Johnson', action: 'Subscribed to Weekly Tech newsletter', time: '10 mins ago', type: 'campaign' },
    { id: 2, lead: 'Rohan Sharma', action: 'Updated status to Qualified Lead', time: '45 mins ago', type: 'lead' },
    { id: 3, lead: 'Michael Chang', action: 'Opened Campaign Email (Summer Launch)', time: '1 hour ago', type: 'campaign' },
    { id: 4, lead: 'Priya Patel', action: 'Registered via landing page form', time: '3 hours ago', type: 'lead' },
    { id: 5, lead: 'Sarah Connor', action: 'Requested product callback', time: '5 hours ago', type: 'lead' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Dashboard Overview</h1>
          <p className="text-sm text-[#64748B]">Welcome back! Here is a summary of your lead pipelines and campaigns.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI Insights Ready
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`rounded-xl p-3 ${stat.bg}`}>{stat.icon}</div>
              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold ${
                stat.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {stat.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
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

      {/* Analytics Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Funnel Chart */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Lead Generation Analytics</h2>
              <p className="text-xs text-[#64748B]">Monthly performance overview</p>
            </div>
            <select className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#64748B] outline-none">
              <option>Last 6 Months</option>
              <option>Last 30 Days</option>
            </select>
          </div>

          {/* Simple Premium CSS Bar Chart */}
          <div className="mt-8 flex h-60 items-end gap-5 px-2">
            {[
              { label: 'Jan', value: '45%' },
              { label: 'Feb', value: '60%' },
              { label: 'Mar', value: '85%' },
              { label: 'Apr', value: '70%' },
              { label: 'May', value: '95%' },
              { label: 'Jun', value: '110%' },
            ].map((bar, idx) => (
              <div key={idx} className="group flex flex-1 flex-col items-center gap-3">
                <div className="relative w-full rounded-t-lg bg-slate-100 transition-all hover:bg-slate-200" style={{ height: '200px' }}>
                  {/* Inner Fill */}
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

        {/* Lead Distribution (Status breakdown) */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#0F172A]">Lead Distribution</h2>
          <p className="text-xs text-[#64748B]">Categorized by current pipeline state</p>

          <div className="mt-6 space-y-4">
            {[
              { label: 'Qualified Leads', count: '5,280', color: 'bg-primary', percent: 60 },
              { label: 'Pending Response', count: '3,120', color: 'bg-amber-500', percent: 35 },
              { label: 'Contacted', count: '2,900', color: 'bg-indigo-500', percent: 30 },
              { label: 'Lost / Closed', count: '1,158', color: 'bg-red-500', percent: 12 },
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

      {/* Bottom Layout Grid: Activities & Insights */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activities */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#0F172A]">Recent Activity</h2>
          <p className="text-xs text-[#64748B]">Real-time updates across leads and newsletter events</p>

          <div className="mt-5 space-y-4.5">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex gap-4">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  act.type === 'campaign' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-primary'
                }`}>
                  {act.type === 'campaign' ? 'C' : 'L'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">{act.lead}</p>
                  <p className="text-xs text-[#64748B]">{act.action}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-[#64748B]">{act.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Campaign Summary */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#0F172A]">Active Campaigns</h2>
          <p className="text-xs text-[#64748B]">Quick metrics on running outreach automation</p>

          <div className="mt-5 space-y-4">
            {[
              { title: 'Tech Enterprise Q3 Outreach', sent: 1250, openRate: '72.4%', status: 'Running' },
              { title: 'SaaS Startup Inbound Autoresponder', sent: 890, openRate: '64.1%', status: 'Running' },
              { title: 'Finance Broker Lead Activation', sent: 430, openRate: '58.9%', status: 'Paused' },
            ].map((camp, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A]">{camp.title}</h4>
                  <p className="mt-0.5 text-xs text-[#64748B]">Sent: {camp.sent} | Open Rate: {camp.openRate}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  camp.status === 'Running' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {camp.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
