import React, { useState, useEffect } from 'react';
import { X, Mail, BarChart2, Clock, Eye, MousePointer2, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { apiClient as api } from '../services/apiClient';
import toast from 'react-hot-toast';
import { type Campaign } from '../services/campaign.service';

interface MessageSend {
  id: number;
  leadId: number;
  subject: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  lead: { id: number; name: string; email: string };
}

interface CampaignAnalytics {
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  failed: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

interface Campaign360DrawerProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
}

const MessageStatusBadge = ({ status }: { status: string }) => {
  let color = 'bg-slate-100 text-slate-800';
  if (status === 'QUEUED') color = 'bg-slate-100 text-slate-600';
  else if (status === 'SENT') color = 'bg-blue-100 text-blue-700';
  else if (status === 'DELIVERED') color = 'bg-cyan-100 text-cyan-700';
  else if (status === 'OPENED') color = 'bg-emerald-100 text-emerald-700';
  else if (status === 'CLICKED') color = 'bg-purple-100 text-purple-700';
  else if (status === 'REPLIED') color = 'bg-green-100 text-green-700';
  else if (status === 'BOUNCED' || status === 'FAILED') color = 'bg-red-100 text-red-700';

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${color}`}>
      {status}
    </span>
  );
};

export const Campaign360Drawer: React.FC<Campaign360DrawerProps> = ({ campaign, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'messages'>('analytics');
  const [messages, setMessages] = useState<MessageSend[]>([]);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && campaign) {
      fetchData();
    }
  }, [isOpen, campaign]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [msgRes, analyticsRes] = await Promise.all([
        api.get(`/messages/campaigns/${campaign?.id}/messages`),
        api.get(`/messages/analytics/email?campaignId=${campaign?.id}`)
      ]);
      setMessages(msgRes.data.data);
      setAnalytics(analyticsRes.data.data);
    } catch (error) {
      toast.error('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const simulateSend = async () => {
    try {
      await api.post(`/messages/campaigns/${campaign?.id}/send`);
      toast.success('Simulation triggered');
      fetchData();
    } catch (e) {
      toast.error('Failed to simulate');
    }
  };

  if (!isOpen || !campaign) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{campaign.name}</h2>
            <p className="text-sm text-slate-500 mt-1">Campaign 360 View</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={simulateSend}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Simulate Send"
            >
              <Send className="w-5 h-5" />
            </button>
            <button
              onClick={fetchData}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'analytics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            <BarChart2 className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex items-center gap-2 py-4 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'messages'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            <Mail className="w-4 h-4" />
            Messages
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
            </div>
          ) : activeTab === 'analytics' && analytics ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-slate-500 text-sm font-medium flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4" /> Total Sent
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{analytics.total}</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <div className="text-emerald-600 text-sm font-medium flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4" /> Open Rate
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">{analytics.openRate.toFixed(1)}%</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <div className="text-purple-600 text-sm font-medium flex items-center gap-2 mb-1">
                    <MousePointer2 className="w-4 h-4" /> Click Rate
                  </div>
                  <div className="text-2xl font-bold text-purple-700">{analytics.clickRate.toFixed(1)}%</div>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                  <div className="text-red-600 text-sm font-medium flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4" /> Bounce Rate
                  </div>
                  <div className="text-2xl font-bold text-red-700">{analytics.bounceRate.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  No messages sent for this campaign yet.
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="p-4 border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-slate-900">{msg.lead.name}</div>
                      <MessageStatusBadge status={msg.status} />
                    </div>
                    <div className="text-sm text-slate-500 mb-3">{msg.lead.email}</div>

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {msg.sentAt && (
                        <div className="flex items-center gap-1" title="Sent">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(msg.sentAt).toLocaleTimeString()}
                        </div>
                      )}
                      {msg.openedAt && (
                        <div className="flex items-center gap-1 text-emerald-600" title="Opened">
                          <Eye className="w-3.5 h-3.5" />
                          {new Date(msg.openedAt).toLocaleTimeString()}
                        </div>
                      )}
                      {msg.clickedAt && (
                        <div className="flex items-center gap-1 text-purple-600" title="Clicked">
                          <MousePointer2 className="w-3.5 h-3.5" />
                          {new Date(msg.clickedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
