import React, { useState, useEffect } from 'react';
import { Shield, Key, Sliders, Database, Save, Sparkles, Mail } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Platform Settings');
  const [imapSettings, setImapSettings] = useState({ host: '', port: '993', apiKey: '', apiSecret: '', secure: true });

  useEffect(() => {
    if (activeTab === 'API Integrations') {
      apiClient.get('/settings').then(res => {
        const imap = res.data.data.find((s: any) => s.type === 'IMAP');
        if (imap) {
          setImapSettings({ host: imap.host || '', port: String(imap.port || '993'), apiKey: imap.apiKey || '', apiSecret: imap.apiSecret || '', secure: imap.secure });
        }
      });
    }
  }, [activeTab]);

  const saveImapSettings = async () => {
    try {
      await apiClient.post('/settings/IMAP', {
        provider: 'IMAP',
        host: imapSettings.host,
        port: parseInt(imapSettings.port),
        apiKey: imapSettings.apiKey,
        apiSecret: imapSettings.apiSecret,
        secure: imapSettings.secure,
        isActive: true
      });
      alert('IMAP Settings Saved!');
    } catch (e) {
      alert('Failed to save settings.');
    }
  };
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Admin Settings</h1>
        <p className="text-sm text-[#64748B]">Configure global platform settings, scoring metrics, and roles. Restricted to Administrators.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Tabs / Categories */}
        <div className="space-y-1.5 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm h-fit">
          {[
            { label: 'Platform Settings', icon: <Sliders className="h-4.5 w-4.5" /> },
            { label: 'Scoring Rules (AI)', icon: <Sparkles className="h-4.5 w-4.5" /> },
            { label: 'API Integrations', icon: <Database className="h-4.5 w-4.5" /> },
            { label: 'Role Permissions', icon: <Shield className="h-4.5 w-4.5" /> },
          ].map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(tab.label)}
              className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                activeTab === tab.label 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-slate-600 hover:bg-[#F8FAFC]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Configuration Body */}
        <div className="md:col-span-2 space-y-6">
          {activeTab === 'Platform Settings' && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Automated Lead Scoring weights
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">Determine how AlgoConnect calculates lead warmth and health automatically.</p>
  
              <div className="mt-6 space-y-4">
                {[
                  { activity: 'Requested product callback', weight: 40 },
                  { activity: 'Downloaded pricing PDF brochure', weight: 25 },
                  { activity: 'Visited pricing web page', weight: 15 },
                  { activity: 'Opened email sequence message', weight: 5 },
                ].map((activity, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm font-medium text-slate-700">{activity.activity}</span>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        defaultValue={activity.weight} 
                        className="w-16 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-1 px-2.5 text-center text-sm font-bold text-slate-800 outline-none focus:border-primary focus:bg-white"
                      />
                      <span className="text-xs font-semibold text-[#64748B]">pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'API Integrations' && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                IMAP Reply Tracking Settings
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">Configure your inbox credentials so the system can automatically track email replies.</p>
              
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">IMAP Host</label>
                  <input type="text" placeholder="imap.gmail.com" value={imapSettings.host} onChange={(e) => setImapSettings({...imapSettings, host: e.target.value})} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Email (Username)</label>
                    <input type="text" value={imapSettings.apiKey} onChange={(e) => setImapSettings({...imapSettings, apiKey: e.target.value})} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">App Password</label>
                    <input type="password" value={imapSettings.apiSecret} onChange={(e) => setImapSettings({...imapSettings, apiSecret: e.target.value})} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button onClick={saveImapSettings} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">
                    Save IMAP Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Card 2: Security & Permissions */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Access Control & Roles
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">Control the operational permissions mapping for each platform role.</p>

            <div className="mt-6 space-y-4">
              {/* Table of Permissions */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] font-bold text-[#64748B]">
                      <th className="pb-3">Module Permission</th>
                      <th className="pb-3 text-center">Admin</th>
                      <th className="pb-3 text-center">Manager</th>
                      <th className="pb-3 text-center">Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {[
                      { perm: 'Access Dashboard Metrics', admin: true, manager: true, agent: false },
                      { perm: 'View & Edit Lead Records', admin: true, manager: true, agent: true },
                      { perm: 'Create / Trigger Campaigns', admin: true, manager: true, agent: false },
                      { perm: 'Modify Admin Settings', admin: true, manager: false, agent: false },
                    ].map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-3 pr-4 font-semibold text-slate-800">{row.perm}</td>
                        <td className="py-3 text-center">
                          <input type="checkbox" defaultChecked={row.admin} disabled className="h-4 w-4 accent-primary" />
                        </td>
                        <td className="py-3 text-center">
                          <input type="checkbox" defaultChecked={row.manager} disabled className="h-4 w-4 accent-primary" />
                        </td>
                        <td className="py-3 text-center">
                          <input type="checkbox" defaultChecked={row.agent} disabled className="h-4 w-4 accent-primary" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3">
            <button className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[#F8FAFC]">
              Discard Changes
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 hover:bg-blue-600">
              <Save className="h-4.5 w-4.5" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
