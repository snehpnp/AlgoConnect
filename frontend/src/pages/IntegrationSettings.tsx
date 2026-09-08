import { useState, useEffect, useCallback } from 'react';
import { Mail, MessageSquare, Phone, Save, Play, Loader2, Key, Server, Hash, Info, ListFilter, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, AlertCircle, Eye, X, History, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsService, type IntegrationSetting, type MessageLog, type EmailLimitAuditLog } from '../services/settings.service';
import { whatsappService, type WhatsAppStatus } from '../services/whatsapp.service';

export const IntegrationSettings = () => {
  const [settings, setSettings] = useState<Record<string, Partial<IntegrationSetting>>>({
    EMAIL: { type: 'EMAIL', provider: 'SMTP', host: '', port: 587, apiKey: '', apiSecret: '', senderId: '', secure: false, isActive: true, limitType: 'DAILY', emailLimit: null },
    SMS: { type: 'SMS', provider: 'TWILIO', apiKey: '', apiSecret: '', senderId: '', isActive: true },
    WHATSAPP: { type: 'WHATSAPP', provider: 'META', apiKey: '', senderId: '', isActive: true },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'EMAIL' | 'SMS' | 'WHATSAPP'>('EMAIL');

  // WhatsApp State
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({ connected: false, qrCode: null });
  const [waLoading, setWaLoading] = useState(false);

  // Email Limit Audit Log state
  const [limitLogs, setLimitLogs] = useState<EmailLimitAuditLog[]>([]);
  const [limitLogsLoading, setLimitLogsLoading] = useState(false);
  const [limitLogsTotal, setLimitLogsTotal] = useState(0);

  // Message Logs State
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [filterChannel, setFilterChannel] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Modal State
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
    fetchLogs();
    fetchWaStatus();
    fetchLimitLogs();
    
    // Poll for QR code or connection status
    const interval = setInterval(() => {
      fetchWaStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync log filter with active tab and fetch
  useEffect(() => {
    setFilterChannel(activeTab);
    setLogsPage(1);
    fetchLogs(1, activeTab);
  }, [activeTab]);

  const fetchWaStatus = async () => {
    try {
      if (!waStatus.qrCode && !waStatus.connected) setWaLoading(true);
      const res = await whatsappService.getStatus();
      setWaStatus(res);
    } catch (err) {
      console.error(err);
    } finally {
      setWaLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await settingsService.getAllIntegrations();
      if (res && res.data) {
        const newSettings = { ...settings };
        res.data.forEach((s: IntegrationSetting) => {
          newSettings[s.type] = { ...newSettings[s.type], ...s };
        });
        setSettings(newSettings);
      }
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLimitLogs = async () => {
    try {
      setLimitLogsLoading(true);
      const res = await settingsService.getEmailLimitLogs(1, 20);
      setLimitLogs(res.data || []);
      setLimitLogsTotal(res.total || 0);
    } catch (err) {
      // silent — not critical
    } finally {
      setLimitLogsLoading(false);
    }
  };

  const fetchLogs = useCallback(async (page = 1, overrideChannel?: string) => {
    try {
      setLogsLoading(true);
      const res = await settingsService.getMessageLogs({
        channel: overrideChannel || filterChannel,
        status: filterStatus,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        page,
        limit: 15,
      });
      setLogs(res.data || []);
      setLogsTotal(res.total || 0);
      setLogsPage(res.page || 1);
      setLogsTotalPages(res.totalPages || 1);
    } catch (err) {
      toast.error('Failed to load message logs');
    } finally {
      setLogsLoading(false);
    }
  }, [filterChannel, filterStatus, filterDateFrom, filterDateTo]);

  const handleApplyFilters = () => {
    setLogsPage(1);
    fetchLogs(1);
  };

  const handleClearFilters = () => {
    setFilterChannel('ALL');
    setFilterStatus('ALL');
    setFilterDateFrom('');
    setFilterDateTo('');
    setTimeout(() => fetchLogs(1), 50);
  };

  const handleSave = async (type: string) => {
    try {
      setSavingType(type);
      await settingsService.updateIntegration(type, settings[type]);
      toast.success(`${type} settings saved successfully`);
      if (type === 'EMAIL') {
        await fetchSettings();
        await fetchLimitLogs();
      }
    } catch (err) {
      toast.error(`Failed to save ${type} settings`);
    } finally {
      setSavingType(null);
    }
  };

  const handleTest = async (type: string) => {
    try {
      setTestingType(type);
      const testData = { ...settings[type] };
      if (type === 'EMAIL' && testEmail) {
        (testData as any).testEmail = testEmail;
      }
      const res = await settingsService.testIntegration(type, testData);
      toast.success(res.message || `${type} test successful`);
      if (type === 'EMAIL') {
        fetchSettings(); // refresh counters after sending
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || `Failed to test ${type} integration`;
      if (err.response?.status === 429) {
        toast.error(`🚫 ${msg}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setTestingType(null);
    }
  };

  const handleChange = (type: string, field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      SENT:      { color: 'bg-blue-50 text-blue-700 border-blue-200',    icon: <CheckCircle2 className="h-3 w-3" /> },
      DELIVERED: { color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle2 className="h-3 w-3" /> },
      OPENED:    { color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <CheckCircle2 className="h-3 w-3" /> },
      CLICKED:   { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <CheckCircle2 className="h-3 w-3" /> },
      REPLIED:   { color: 'bg-teal-50 text-teal-700 border-teal-200',    icon: <CheckCircle2 className="h-3 w-3" /> },
      REPLY:     { color: 'bg-teal-50 text-teal-700 border-teal-200',    icon: <CheckCircle2 className="h-3 w-3" /> },
      FAILED:    { color: 'bg-red-50 text-red-700 border-red-200',       icon: <XCircle className="h-3 w-3" /> },
      PENDING:   { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="h-3 w-3" /> },
    };
    const cfg = map[status] || { color: 'bg-slate-50 text-slate-600 border-slate-200', icon: <AlertCircle className="h-3 w-3" /> };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
        {cfg.icon} {status}
      </span>
    );
  };

  const getChannelBadge = (channel: string) => {
    const map: Record<string, string> = {
      EMAIL:    'bg-blue-100 text-blue-700',
      SMS:      'bg-purple-100 text-purple-700',
      WHATSAPP: 'bg-green-100 text-green-700',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase ${map[channel] || 'bg-slate-100 text-slate-600'}`}>
        {channel === 'EMAIL' && <Mail className="h-3 w-3" />}
        {channel === 'SMS' && <MessageSquare className="h-3 w-3" />}
        {channel === 'WHATSAPP' && <Phone className="h-3 w-3" />}
        {channel}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 sm:space-y-8 pb-12 px-4 sm:px-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Integration Settings</h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">Manage credentials for Email, SMS, and WhatsApp communication channels.</p>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveTab('EMAIL')}
            className={`whitespace-nowrap pb-4 px-3 sm:px-1 mr-4 sm:mr-8 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors shrink-0 ${
              activeTab === 'EMAIL' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Mail className="h-4 w-4" />
            Email
          </button>
          <button
            onClick={() => setActiveTab('SMS')}
            className={`whitespace-nowrap pb-4 px-3 sm:px-1 mr-4 sm:mr-8 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors shrink-0 ${
              activeTab === 'SMS' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            SMS
          </button>
          <button
            onClick={() => setActiveTab('WHATSAPP')}
            className={`whitespace-nowrap pb-4 px-3 sm:px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors shrink-0 ${
              activeTab === 'WHATSAPP' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Phone className="h-4 w-4" />
            WhatsApp
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* Main Form Area */}
        <div className="lg:col-span-2">
          {activeTab === 'EMAIL' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">Email Settings</h2>

              {/* ─── Usage Stats Panel ─── */}
              {(() => {
                const lt = settings.EMAIL.limitType || 'DAILY';
                const lim = settings.EMAIL.emailLimit ?? settings.EMAIL.dailyLimit ?? null;
                const sentToday = settings.EMAIL.emailsSentToday || 0;
                const sentMonth = settings.EMAIL.emailsSentThisMonth || 0;
                const relevantSent = lt === 'MONTHLY' ? sentMonth : sentToday;
                const remaining = lim ? Math.max(0, lim - relevantSent) : null;
                return (
                  <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                    <div className="grid grid-cols-4 divide-x divide-slate-200">
                      <div className="text-center p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          {lt === 'MONTHLY' ? 'Monthly' : 'Daily'} Limit
                        </p>
                        <p className="text-lg font-black text-slate-800">
                          {lim ? lim.toLocaleString() : <span className="text-2xl">∞</span>}
                        </p>
                      </div>
                      <div className="text-center p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sent Today</p>
                        <p className="text-lg font-black text-blue-600">{sentToday.toLocaleString()}</p>
                      </div>
                      <div className="text-center p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sent This Month</p>
                        <p className="text-lg font-black text-indigo-600">{sentMonth.toLocaleString()}</p>
                      </div>
                      <div className="text-center p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Remaining</p>
                        <p className={`text-lg font-black ${remaining === 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {remaining !== null ? remaining.toLocaleString() : <span className="text-2xl">∞</span>}
                        </p>
                      </div>
                    </div>
                    {lim && remaining === 0 && (
                      <div className="bg-red-50 border-t border-red-200 px-4 py-2 flex items-center gap-2 text-sm text-red-700 font-medium">
                        <XCircle className="h-4 w-4 shrink-0" />
                        {lt === 'MONTHLY' ? 'Monthly' : 'Daily'} email limit reached — emails are blocked until the {lt === 'MONTHLY' ? 'next month' : 'next day'}.
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-4">
                {/* ─── Limit Configuration ─── */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email Sending Limit</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Limit Type Toggle */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Limit Type</label>
                      <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white">
                        {(['DAILY', 'MONTHLY'] as const).map(lt => (
                          <button
                            key={lt}
                            type="button"
                            onClick={() => handleChange('EMAIL', 'limitType', lt)}
                            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                              (settings.EMAIL.limitType || 'DAILY') === lt
                                ? 'bg-primary text-white'
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {lt === 'DAILY' ? '📅 Daily' : '📆 Monthly'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Limit Value */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                        {(settings.EMAIL.limitType || 'DAILY') === 'DAILY' ? 'Emails Per Day' : 'Emails Per Month'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.EMAIL.emailLimit ?? settings.EMAIL.dailyLimit ?? ''}
                        onChange={(e) => handleChange('EMAIL', 'emailLimit', e.target.value === '' ? null : parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="Leave empty for unlimited"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {(settings.EMAIL.limitType || 'DAILY') === 'DAILY'
                      ? 'Daily limit resets every midnight. When the limit is reached, all outgoing emails are blocked until the next day.'
                      : 'Monthly limit allows flexible usage within the month (e.g. 300/month can be sent as 100 today, 50 tomorrow, etc.). Resets on the 1st of every month.'}
                  </p>
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span><strong>Note:</strong> Test emails also count toward your limit — they are real sends.</span>
                  </p>
                </div>
                {/* Host + Port — stacked on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Host Server</label>
                    <div className="relative">
                      <Server className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input type="text" value={settings.EMAIL.host || ''} onChange={(e) => handleChange('EMAIL', 'host', e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="smtp.gmail.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Port</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input type="number" value={settings.EMAIL.port || ''} onChange={(e) => handleChange('EMAIL', 'port', parseInt(e.target.value))} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="465" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Username / Email</label>
                  <input type="text" value={settings.EMAIL.apiKey || ''} onChange={(e) => handleChange('EMAIL', 'apiKey', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="your-email@gmail.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Password (App Password)</label>
                  <input type="password" value={settings.EMAIL.apiSecret || ''} onChange={(e) => handleChange('EMAIL', 'apiSecret', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="16-digit App Password" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">From Address (Sender)</label>
                  <input type="text" value={settings.EMAIL.senderId || ''} onChange={(e) => handleChange('EMAIL', 'senderId', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="AlgoConnect <your-email@gmail.com>" />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="secure-checkbox" checked={!!settings.EMAIL.secure} onChange={(e) => handleChange('EMAIL', 'secure', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                  <label htmlFor="secure-checkbox" className="text-sm font-medium text-slate-700">Use Secure Connection (SSL/TLS)</label>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 pt-4 border-t border-slate-100">
                <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="Enter test email address..." className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
                <div className="flex items-center gap-3">
                  <button onClick={() => handleTest('EMAIL')} disabled={testingType === 'EMAIL' || !settings.EMAIL.host || !testEmail} className="flex-1 inline-flex justify-center items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 min-h-[44px]">
                    {testingType === 'EMAIL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Send Test
                  </button>
                  <button onClick={() => handleSave('EMAIL')} disabled={savingType === 'EMAIL'} className="flex-1 inline-flex justify-center items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-600 disabled:opacity-50 min-h-[44px]">
                    {savingType === 'EMAIL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SMS' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">SMS Credentials</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Provider Name</label>
                  <input type="text" value={settings.SMS.provider || ''} onChange={(e) => handleChange('SMS', 'provider', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="e.g., TWILIO, MSG91" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">API Key / Account SID</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input type="text" value={settings.SMS.apiKey || ''} onChange={(e) => handleChange('SMS', 'apiKey', e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">API Secret / Auth Token</label>
                  <input type="password" value={settings.SMS.apiSecret || ''} onChange={(e) => handleChange('SMS', 'apiSecret', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Sender ID / From Number</label>
                  <input type="text" value={settings.SMS.senderId || ''} onChange={(e) => handleChange('SMS', 'senderId', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="e.g., +1234567890 or ALGOCO" />
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => handleTest('SMS')} disabled={testingType === 'SMS' || !settings.SMS.apiKey} className="flex-1 inline-flex justify-center items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 min-h-[44px]">
                  {testingType === 'SMS' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Test
                </button>
                <button onClick={() => handleSave('SMS')} disabled={savingType === 'SMS'} className="flex-1 inline-flex justify-center items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-600 disabled:opacity-50 min-h-[44px]">
                  {savingType === 'SMS' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>
          )}

          {activeTab === 'WHATSAPP' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">WhatsApp Web Link</h2>
              
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 min-h-[300px]">
                {waLoading && !waStatus.qrCode && !waStatus.connected ? (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm">Checking status...</span>
                  </div>
                ) : waStatus.connected ? (
                  <div className="flex flex-col items-center gap-6 text-center w-full max-w-md mx-auto">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-inner relative">
                      <div className="absolute inset-0 border-4 border-white rounded-full"></div>
                      <CheckCircle2 className="w-10 h-10" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-2xl tracking-tight">WhatsApp Connected</h3>
                      <p className="text-sm text-slate-500 mt-2 leading-relaxed">Your system is now ready to send automated WhatsApp messages directly from your linked account.</p>
                      
                      {waStatus.account && (
                        <div className="mt-6 w-full p-4 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200/60 rounded-xl shadow-[0_2px_10px_-4px_rgba(16,185,129,0.2)] text-left relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
                          <div className="flex items-center gap-4 relative z-10">
                            <div className="shrink-0 w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center border border-emerald-100 text-emerald-500">
                              <MessageSquare className="w-5 h-5 fill-emerald-50" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] text-emerald-600/80 uppercase tracking-widest font-bold mb-0.5">Linked Account</p>
                              <p className="text-base font-bold text-slate-800 leading-tight truncate">{waStatus.account.name || waStatus.account.pushname || 'WhatsApp Account'}</p>
                              <p className="text-sm text-slate-600 font-medium font-mono mt-0.5 truncate">+{waStatus.account.number}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={async () => {
                        setWaLoading(true);
                        await whatsappService.logout();
                        await fetchWaStatus();
                      }}
                      className="mt-2 w-full max-w-xs px-5 py-3 bg-white text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 font-bold text-sm rounded-xl transition-all duration-200 border border-slate-200 shadow-sm flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Disconnect WhatsApp
                    </button>
                  </div>
                ) : waStatus.qrCode ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 inline-block">
                      <img src={waStatus.qrCode} alt="WhatsApp QR Code" className="w-56 h-56" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">Scan to Link Device</h3>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm">
                        Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device, and point your camera at this QR code.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2 font-medium">QR code updates automatically</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-500 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    <span className="text-sm font-medium">Starting WhatsApp engine...<br/>Please wait a few moments.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Setup Guide Section */}
        <div className="lg:col-span-1">
          <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm mb-1">Setup Guide</h3>
                {activeTab === 'EMAIL' && (
                  <div className="text-sm text-slate-600 space-y-3">
                    <p>To use <strong>Gmail</strong> as your email sender:</p>
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>Go to your Google Account Settings.</li>
                      <li>Turn on <strong>2-Step Verification</strong>.</li>
                      <li>Search for <strong>App Passwords</strong> and create one for "AlgoConnect".</li>
                      <li>Use <code className="bg-white px-1 py-0.5 rounded text-xs border border-slate-200">smtp.gmail.com</code> and port <code className="bg-white px-1 py-0.5 rounded text-xs border border-slate-200">465</code> (Check "Secure Connection").</li>
                      <li>Use your email as the Username and the generated 16-letter code as the Password.</li>
                    </ol>
                  </div>
                )}
                {activeTab === 'SMS' && (
                  <div className="text-sm text-slate-600 space-y-3">
                    <p>To set up SMS via <strong>Twilio</strong>:</p>
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>Log into the Twilio Console.</li>
                      <li>Find your <strong>Account SID</strong> and paste it into "API Key".</li>
                      <li>Find your <strong>Auth Token</strong> and paste it into "API Secret".</li>
                      <li>Purchase or locate your Twilio Phone Number and put it in "Sender ID" (e.g., +1234567890).</li>
                    </ol>
                  </div>
                )}
                {activeTab === 'WHATSAPP' && (
                  <div className="text-sm text-slate-600 space-y-3">
                    <p>To use <strong>WhatsApp Web</strong> automation:</p>
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>Open WhatsApp on your primary phone.</li>
                      <li>Go to <strong>Settings</strong> and tap on <strong>Linked Devices</strong>.</li>
                      <li>Tap <strong>Link a Device</strong>.</li>
                      <li>Point your phone's camera at the QR code shown on the left.</li>
                      <li>Once connected, the system will send campaign messages using your WhatsApp account. Replies will automatically be saved to the respective Lead.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MESSAGE LOGS SECTION ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50/60 gap-2">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
              <ListFilter className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 shrink-0" />
              Message Logs
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Total: <strong>{logsTotal}</strong> messages</p>
          </div>
          <button
            onClick={() => fetchLogs(logsPage)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors shrink-0 min-h-[36px]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Filters Row — stacked on mobile */}
        <div className="flex flex-col gap-3 px-4 sm:px-6 py-4 bg-slate-50/30 border-b border-slate-100">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
            {/* Channel filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Channel</label>
              <select
                value={filterChannel}
                onChange={(e) => {
                  setFilterChannel(e.target.value);
                  if (['EMAIL', 'SMS', 'WHATSAPP'].includes(e.target.value)) {
                    setActiveTab(e.target.value as any);
                  }
                }}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="ALL">All Channels</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="SENT">Sent</option>
                <option value="DELIVERED">Delivered</option>
                <option value="OPENED">Opened</option>
                <option value="CLICKED">Clicked</option>
                <option value="REPLIED">Replied</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Action buttons — full width on mobile */}
          <div className="flex gap-2">
            <button
              onClick={handleClearFilters}
              className="flex-1 sm:flex-none text-sm font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors min-h-[40px]"
            >
              Clear
            </button>
            <button
              onClick={handleApplyFilters}
              className="flex-1 sm:flex-none text-sm font-semibold text-white bg-primary hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors min-h-[40px]"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Table — horizontal scroll on mobile */}
        <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-left text-sm" style={{ minWidth: '620px' }}>
            <thead>
              <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-3">Date & Time</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    <p className="text-slate-500 text-xs mt-2">Loading logs...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <ListFilter className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No message logs found</p>
                    <p className="text-slate-400 text-xs mt-1">Messages sent via campaigns will appear here.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      <br />
                      <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-4 py-3">{getChannelBadge(log.channel)}</td>
                    <td className="px-4 py-3">{getStatusBadge(log.eventType)}</td>
                    <td className="px-4 py-3">
                      {log.lead ? (
                        <div>
                          <p className="font-medium text-slate-800 text-xs">{log.lead.name}</p>
                          <p className="text-[10px] text-slate-400">{log.lead.email || log.lead.phone || '—'}</p>
                        </div>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {log.campaign ? (
                        <span className="text-xs text-indigo-600 font-medium">{log.campaign.name}</span>
                      ) : <span className="text-xs text-slate-400">Manual</span>}
                    </td>
                    <td className="px-4 py-3">
                      {log.details ? (
                        <button 
                          onClick={() => {
                            let d = log.details;
                            if (typeof d === 'string') {
                              try { d = JSON.parse(d); } catch {}
                            }
                            setSelectedLog({ ...log, parsedDetails: d });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {logsTotalPages > 1 && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/30 gap-3">
            <p className="text-[10px] sm:text-xs text-slate-500">
              <strong>{logsPage}</strong>/<strong>{logsTotalPages}</strong> · {logsTotal} logs
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { const p = logsPage - 1; setLogsPage(p); fetchLogs(p); }}
                disabled={logsPage <= 1}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors min-h-[36px]"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                onClick={() => { const p = logsPage + 1; setLogsPage(p); fetchLogs(p); }}
                disabled={logsPage >= logsTotalPages}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors min-h-[36px]"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ─── EMAIL LIMIT CHANGE LOG ─── */}
      {activeTab === 'EMAIL' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 shrink-0" />
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-800">Email Limit Change Log</h2>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Audit trail of every limit configuration change</p>
              </div>
            </div>
            <button
              onClick={fetchLimitLogs}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors shrink-0 min-h-[36px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${limitLogsLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {limitLogsLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            </div>
          ) : limitLogs.length === 0 ? (
            <div className="py-16 text-center">
              <History className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium text-sm">No limit changes recorded yet</p>
              <p className="text-slate-400 text-xs mt-1">Changes will appear here when you save a new limit configuration.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" style={{ minWidth: '680px' }}>
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-3">Date & Time</th>
                    <th className="px-4 py-3">Changed By</th>
                    <th className="px-4 py-3">Previous Config</th>
                    <th className="px-4 py-3">New Config</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {limitLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <br />
                        <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-slate-700">{log.changedByName || 'System'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {log.prevLimitType ? (
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.prevLimitType === 'MONTHLY' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                              {log.prevLimitType === 'MONTHLY' ? '📆 Monthly' : '📅 Daily'}
                            </span>
                            <span className="ml-1 text-xs text-slate-500">{log.prevLimit ? `· ${log.prevLimit.toLocaleString()}` : '· Unlimited'}</span>
                          </div>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.newLimitType === 'MONTHLY' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                            {log.newLimitType === 'MONTHLY' ? '📆 Monthly' : '📅 Daily'}
                          </span>
                          <span className="ml-1 text-xs text-slate-500">{log.newLimit ? `· ${log.newLimit.toLocaleString()}` : '· Unlimited'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500 italic">{log.reason || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Message Log Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Message Details</h2>
                  <p className="text-xs text-slate-500">
                    {new Date(selectedLog.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To</span>
                  <p className="text-sm font-medium text-slate-800 break-all">{selectedLog.parsedDetails?.recipient || selectedLog.lead?.email || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</span>
                  <div>{getStatusBadge(selectedLog.eventType)}</div>
                </div>
              </div>
              
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Subject</span>
                <div className="text-sm font-medium text-slate-800 px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  {selectedLog.parsedDetails?.subject || selectedLog.parsedDetails?.subject || 'No Subject'}
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Message Body</span>
                <div className="text-sm text-slate-700 bg-white rounded-lg border border-slate-200 p-4 min-h-[150px] shadow-sm overflow-x-auto">
                  {selectedLog.parsedDetails?.htmlContent ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedLog.parsedDetails.htmlContent.replace(/<img[^>]*api\/track\/open[^>]*>/gi, '') }} />
                  ) : selectedLog.parsedDetails?.body ? (
                    <div className="whitespace-pre-wrap font-mono text-xs">{selectedLog.parsedDetails.body}</div>
                  ) : (
                    <div className="whitespace-pre-wrap font-mono text-xs break-all">{typeof selectedLog.parsedDetails === 'object' ? JSON.stringify(selectedLog.parsedDetails, null, 2) : selectedLog.parsedDetails}</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

