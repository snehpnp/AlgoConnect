import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, Phone, Save, Play, Loader2, Key, Server, Hash, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsService } from '../services/settings.service';
import type { IntegrationSetting } from '../services/settings.service';

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

  useEffect(() => {
    fetchSettings();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
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
                      <input
                        type="text"
                        value={settings.EMAIL.host || ''}
                        onChange={(e) => handleChange('EMAIL', 'host', e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Port</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="number"
                        value={settings.EMAIL.port || ''}
                        onChange={(e) => handleChange('EMAIL', 'port', parseInt(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="465"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Username / Email</label>
                  <input
                    type="text"
                    value={settings.EMAIL.apiKey || ''}
                    onChange={(e) => handleChange('EMAIL', 'apiKey', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="your-email@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Password (App Password)</label>
                  <input
                    type="password"
                    value={settings.EMAIL.apiSecret || ''}
                    onChange={(e) => handleChange('EMAIL', 'apiSecret', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="16-digit App Password"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">From Address (Sender)</label>
                  <input
                    type="text"
                    value={settings.EMAIL.senderId || ''}
                    onChange={(e) => handleChange('EMAIL', 'senderId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="AlgoConnect <your-email@gmail.com>"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="secure-checkbox"
                    checked={!!settings.EMAIL.secure}
                    onChange={(e) => handleChange('EMAIL', 'secure', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="secure-checkbox" className="text-sm font-medium text-slate-700">
                    Use Secure Connection (SSL/TLS)
                  </label>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div className="w-full sm:w-1/2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Enter test email address..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => handleTest('EMAIL')}
                    disabled={testingType === 'EMAIL' || !settings.EMAIL.host || !testEmail}
                    className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 whitespace-nowrap"
                  >
                    {testingType === 'EMAIL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Send Test
                  </button>
                  <button
                    onClick={() => handleSave('EMAIL')}
                    disabled={savingType === 'EMAIL'}
                    className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
                  >
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
                  <input
                    type="text"
                    value={settings.SMS.provider || ''}
                    onChange={(e) => handleChange('SMS', 'provider', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="e.g., TWILIO, MSG91"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">API Key / Account SID</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={settings.SMS.apiKey || ''}
                      onChange={(e) => handleChange('SMS', 'apiKey', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">API Secret / Auth Token</label>
                  <input
                    type="password"
                    value={settings.SMS.apiSecret || ''}
                    onChange={(e) => handleChange('SMS', 'apiSecret', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Sender ID / From Number</label>
                  <input
                    type="text"
                    value={settings.SMS.senderId || ''}
                    onChange={(e) => handleChange('SMS', 'senderId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="e.g., +1234567890 or ALGOCO"
                  />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleTest('SMS')}
                  disabled={testingType === 'SMS' || !settings.SMS.apiKey}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                >
                  {testingType === 'SMS' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Test Connection
                </button>
                <button
                  onClick={() => handleSave('SMS')}
                  disabled={savingType === 'SMS'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
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
                    <input
                      type="password"
                      value={settings.WHATSAPP.apiKey || ''}
                      onChange={(e) => handleChange('WHATSAPP', 'apiKey', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="EAA..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Phone Number ID</label>
                  <input
                    type="text"
                    value={settings.WHATSAPP.senderId || ''}
                    onChange={(e) => handleChange('WHATSAPP', 'senderId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="e.g. 102345678912345"
                  />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleTest('WHATSAPP')}
                  disabled={testingType === 'WHATSAPP' || !settings.WHATSAPP.apiKey}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                >
                  {testingType === 'WHATSAPP' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Test Connection
                </button>
                <button
                  onClick={() => handleSave('WHATSAPP')}
                  disabled={savingType === 'WHATSAPP'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
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
    </div>
  );
};
