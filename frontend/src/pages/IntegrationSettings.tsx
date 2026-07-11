import { useState, useEffect, useCallback } from 'react';
import { Mail, MessageSquare, Phone, Save, Play, Loader2, Key, Server, Hash, Info, ListFilter, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsService, type IntegrationSetting, type MessageLog } from '../services/settings.service';

export const IntegrationSettings = () => {
  const [settings, setSettings] = useState<Record<string, Partial<IntegrationSetting>>>({
    EMAIL: { type: 'EMAIL', provider: 'SMTP', host: '', port: 587, apiKey: '', apiSecret: '', senderId: '', secure: false, isActive: true },
    SMS: { type: 'SMS', provider: 'TWILIO', apiKey: '', apiSecret: '', senderId: '', isActive: true },
    WHATSAPP: { type: 'WHATSAPP', provider: 'META', apiKey: '', senderId: '', isActive: true },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'EMAIL' | 'SMS' | 'WHATSAPP'>('EMAIL');

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

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

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

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLogsLoading(true);
      const res = await settingsService.getMessageLogs({
        channel: filterChannel,
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to test ${type} integration`);
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
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integration Settings</h1>
        <p className="text-slate-500 mt-1">Manage credentials for Email, SMS, and WhatsApp communication channels.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('EMAIL')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'EMAIL' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Mail className="h-4 w-4" />
            Email (SMTP)
          </button>
          <button
            onClick={() => setActiveTab('SMS')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'SMS' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            SMS Configuration
          </button>
          <button
            onClick={() => setActiveTab('WHATSAPP')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'WHATSAPP' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Phone className="h-4 w-4" />
            WhatsApp API
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form Area */}
        <div className="lg:col-span-2">
          {activeTab === 'EMAIL' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-6">Email Settings</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div className="w-full sm:w-1/2">
                  <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="Enter test email address..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button onClick={() => handleTest('EMAIL')} disabled={testingType === 'EMAIL' || !settings.EMAIL.host || !testEmail} className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 whitespace-nowrap">
                    {testingType === 'EMAIL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Send Test
                  </button>
                  <button onClick={() => handleSave('EMAIL')} disabled={savingType === 'EMAIL'} className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap">
                    {savingType === 'EMAIL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SMS' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-6">SMS Credentials</h2>
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
              <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => handleTest('SMS')} disabled={testingType === 'SMS' || !settings.SMS.apiKey} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50">
                  {testingType === 'SMS' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Test Connection
                </button>
                <button onClick={() => handleSave('SMS')} disabled={savingType === 'SMS'} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-600 disabled:opacity-50">
                  {savingType === 'SMS' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'WHATSAPP' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-6">WhatsApp API Setup</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Access Token</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input type="password" value={settings.WHATSAPP.apiKey || ''} onChange={(e) => handleChange('WHATSAPP', 'apiKey', e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="EAA..." />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Phone Number ID</label>
                  <input type="text" value={settings.WHATSAPP.senderId || ''} onChange={(e) => handleChange('WHATSAPP', 'senderId', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="e.g. 102345678912345" />
                </div>
              </div>
              <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => handleTest('WHATSAPP')} disabled={testingType === 'WHATSAPP' || !settings.WHATSAPP.apiKey} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50">
                  {testingType === 'WHATSAPP' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Test Connection
                </button>
                <button onClick={() => handleSave('WHATSAPP')} disabled={savingType === 'WHATSAPP'} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-600 disabled:opacity-50">
                  {savingType === 'WHATSAPP' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </button>
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
                    <p>To use the official <strong>Meta WhatsApp Cloud API</strong>:</p>
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>Go to developers.facebook.com and create an App.</li>
                      <li>Add the WhatsApp product.</li>
                      <li>In the API Setup tab, copy the <strong>Temporary Access Token</strong> (or generate a permanent System User token).</li>
                      <li>Copy the <strong>Phone Number ID</strong> (not the actual phone number string).</li>
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ListFilter className="h-5 w-5 text-slate-500" />
              Message Send Logs
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">All outbound Email, SMS, and WhatsApp messages. Total: <strong>{logsTotal}</strong></p>
          </div>
          <button
            onClick={() => fetchLogs(logsPage)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-end gap-3 px-6 py-4 bg-slate-50/30 border-b border-slate-100">
          {/* Channel filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Channel</label>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
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
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
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
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleClearFilters}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 px-4 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleApplyFilters}
              className="text-sm font-semibold text-white bg-primary hover:bg-blue-600 px-4 py-1.5 rounded-lg transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
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
                    <td className="px-4 py-3 max-w-[200px]">
                      {log.details ? (
                        <span className="text-[10px] text-slate-500 truncate block" title={log.details}>
                          {(() => { try { const d = JSON.parse(log.details); return d.isManual ? '🖊 Manual Send' : JSON.stringify(d); } catch { return log.details; } })()}
                        </span>
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
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/30">
            <p className="text-xs text-slate-500">
              Page <strong>{logsPage}</strong> of <strong>{logsTotalPages}</strong> &nbsp;·&nbsp; {logsTotal} total logs
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { const p = logsPage - 1; setLogsPage(p); fetchLogs(p); }}
                disabled={logsPage <= 1}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                onClick={() => { const p = logsPage + 1; setLogsPage(p); fetchLogs(p); }}
                disabled={logsPage >= logsTotalPages}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

