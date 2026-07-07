import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, Phone, Save, Play, Loader2, Key, Server, Hash } from 'lucide-react';
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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integration Settings</h1>
        <p className="text-slate-500 mt-1">Manage credentials for Email, SMS, and WhatsApp communication channels.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Email Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Mail className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Email (SMTP)</h2>
          </div>
          
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
                    placeholder="smtp.example.com"
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
                    placeholder="587"
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
                placeholder="your-email@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={settings.EMAIL.apiSecret || ''}
                onChange={(e) => handleChange('EMAIL', 'apiSecret', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="SMTP Password"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">From Address (Sender)</label>
              <input
                type="text"
                value={settings.EMAIL.senderId || ''}
                onChange={(e) => handleChange('EMAIL', 'senderId', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Marketing <marketing@example.com>"
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

          <div className="mt-8 flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex-1 max-w-xs mr-4">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter test email address..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleTest('EMAIL')}
                disabled={testingType === 'EMAIL' || !settings.EMAIL.host || !testEmail}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"
              >
                {testingType === 'EMAIL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Send Test Email
              </button>
              <button
                onClick={() => handleSave('EMAIL')}
                disabled={savingType === 'EMAIL'}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {savingType === 'EMAIL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* SMS Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">SMS Credentials</h2>
          </div>
          
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
              Test SMS API
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

        {/* WhatsApp Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-green-50 text-green-600 rounded-lg">
              <Phone className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">WhatsApp API</h2>
          </div>
          
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
              Test WhatsApp
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
      </div>
    </div>
  );
};
