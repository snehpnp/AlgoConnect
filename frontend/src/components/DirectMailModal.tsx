import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, Mail, MessageSquare, Phone } from 'lucide-react';
import { getTemplates } from '../services/template.service';
import type { MessageTemplate } from '../services/template.service';
import { leadsService } from '../services/leads.service';
import type { Lead } from '../services/leads.service';
import toast from 'react-hot-toast';

interface DirectMailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
}

export const DirectMailModal: React.FC<DirectMailModalProps> = ({ isOpen, onClose, lead }) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [channel, setChannel] = useState<'EMAIL' | 'SMS' | 'WHATSAPP'>('EMAIL');
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (isOpen && lead) {
      fetchTemplates();
      fetchHistory();
      setSubject('');
      setBody('');
      setSelectedTemplateId('');
      
      if (lead.email) {
        setSelectedEmail(lead.email);
      } else if (lead.email2) {
        setSelectedEmail(lead.email2);
      } else if ((lead as any).scrapedEmail) {
        setSelectedEmail((lead as any).scrapedEmail);
      } else {
        setSelectedEmail('');
      }

      if (lead.phone) {
        setSelectedPhone(lead.phone);
      } else if (lead.phone2) {
        setSelectedPhone(lead.phone2);
      } else if ((lead as any).scrapedPhone) {
        setSelectedPhone((lead as any).scrapedPhone);
      } else {
        setSelectedPhone('');
      }
    }
  }, [isOpen, lead]);

  const fetchHistory = async () => {
    if (!lead) return;
    setHistoryLoading(true);
    try {
      const res = await leadsService.getLeadMessages(lead.id);
      setHistory(res.data || []);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await getTemplates();
      const templateList = Array.isArray(res) ? res : (res.data || []);
      setTemplates(templateList.filter((t: any) => t.status === 'APPROVED'));
    } catch (err) {
      console.error('Failed to load templates', err);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => t.type === channel);
  const filteredHistory = history.filter(msg => msg.channel === channel);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTemplateId(val ? Number(val) : '');

    if (val) {
      const tmpl = templates.find(t => t.id === Number(val));
      if (tmpl) {
        setSubject(tmpl.subject || '');
        setBody(tmpl.content || '');
      }
    } else {
      setSubject('');
      setBody('');
    }
  };

  const handleSend = async () => {
    if (channel === 'EMAIL' && !subject.trim()) {
      toast.error('Subject is required for emails');
      return;
    }
    if (!body.trim()) {
      toast.error('Message body is required');
      return;
    }
    if (!lead) return;

    setIsSending(true);
    try {
      await leadsService.sendDirectMessage(lead.id, {
        channel,
        subject,
        body,
        templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined,
        recipientEmail: selectedEmail
      });
      toast.success(`${channel} sent successfully!`);
      setBody('');
      setSubject('');
      fetchHistory(); // Refresh history
    } catch (err: any) {
      console.error('Send failed', err);
      toast.error(err?.response?.data?.message || `Failed to send ${channel}`);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !lead) return null;

  const availableEmails: {label: string, value: string}[] = [];
  if (lead?.email) availableEmails.push({label: `Primary (${lead.email})`, value: lead.email});
  if (lead?.email2) availableEmails.push({label: `Secondary (${lead.email2})`, value: lead.email2});
  if ((lead as any)?.scrapedEmail) availableEmails.push({label: `Scraped (${(lead as any).scrapedEmail})`, value: (lead as any).scrapedEmail});

  const availablePhones: {label: string, value: string}[] = [];
  if (lead?.phone) availablePhones.push({label: `Primary (${lead.phone})`, value: lead.phone});
  if (lead?.phone2) availablePhones.push({label: `Secondary (${lead.phone2})`, value: lead.phone2});
  if ((lead as any)?.scrapedPhone) availablePhones.push({label: `Scraped (${(lead as any).scrapedPhone})`, value: (lead as any).scrapedPhone});

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh] lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Compose Area */}
        <div className="flex-1 flex flex-col border-r border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Direct Message</h2>
              <p className="text-sm text-slate-500 mt-1">Send a message directly to {lead.name}</p>
            </div>
            <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* Channel Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setChannel('EMAIL')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${channel === 'EMAIL' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Mail className="w-4 h-4" /> Email
              </button>
              <button
                onClick={() => setChannel('WHATSAPP')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${channel === 'WHATSAPP' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
              <button
                onClick={() => setChannel('SMS')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${channel === 'SMS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Phone className="w-4 h-4" /> SMS
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">To Recipient</p>
              
              {channel === 'EMAIL' ? (
                availableEmails.length > 1 ? (
                  <select
                    value={selectedEmail}
                    onChange={(e) => setSelectedEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {availableEmails.map(em => (
                      <option key={em.value} value={em.value}>{em.label}</option>
                    ))}
                  </select>
                ) : availableEmails.length === 1 ? (
                  <p className="text-sm font-medium text-slate-800 bg-white px-3 py-2 rounded-lg border border-slate-200">{availableEmails[0].value}</p>
                ) : (
                  <span className="text-red-500 text-sm font-semibold flex items-center gap-1 bg-red-50 px-3 py-2 rounded-lg"><X className="w-4 h-4"/> No Email Available</span>
                )
              ) : (
                availablePhones.length > 1 ? (
                  <select
                    value={selectedPhone}
                    onChange={(e) => setSelectedPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {availablePhones.map(ph => (
                      <option key={ph.value} value={ph.value}>{ph.label}</option>
                    ))}
                  </select>
                ) : availablePhones.length === 1 ? (
                  <p className="text-sm font-medium text-slate-800 bg-white px-3 py-2 rounded-lg border border-slate-200">{availablePhones[0].value}</p>
                ) : (
                  <span className="text-red-500 text-sm font-semibold flex items-center gap-1 bg-red-50 px-3 py-2 rounded-lg"><X className="w-4 h-4"/> No Phone Available</span>
                )
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Template (Optional)</label>
              {isLoading ? (
                <div className="h-10 border border-slate-200 rounded-lg bg-slate-50 animate-pulse" />
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={handleTemplateChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">-- Write Custom Message --</option>
                  {filteredTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            {channel === 'EMAIL' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-[200px]">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Message Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`Write your ${channel.toLowerCase()} here...`}
                className="w-full flex-1 min-h-[160px] rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none shadow-inner"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || (channel === 'EMAIL' ? !lead.email && !selectedEmail : !lead.phone && !selectedPhone)}
              className={`inline-flex items-center gap-2 px-6 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-sm ${
                channel === 'WHATSAPP' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-600/50' : 
                channel === 'SMS' ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-600/50' : 
                'bg-primary hover:bg-primary/90 focus:ring-primary/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send {channel === 'WHATSAPP' ? 'WhatsApp' : channel === 'SMS' ? 'SMS' : 'Email'}
            </button>
          </div>
        </div>

        {/* Right Side: Message History */}
        <div className="w-full lg:w-[400px] xl:w-[450px] bg-slate-50 flex flex-col h-[50vh] lg:h-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
            <h3 className="font-bold text-slate-800">Communication History</h3>
            <button onClick={onClose} className="hidden lg:block p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Loading history...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <MessageSquare className="w-8 h-8 opacity-50" />
                <p className="text-sm">No {channel.toLowerCase()} messages sent yet</p>
              </div>
            ) : (
              filteredHistory.map((msg: any) => (
                <div key={msg.id} className="flex flex-col gap-2 relative">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${
                      msg.channel === 'WHATSAPP' ? 'bg-green-100 text-green-700' :
                      msg.channel === 'SMS' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {msg.channel}
                    </span>
                    <span className="text-xs font-medium text-slate-400">{new Date(msg.createdAt).toLocaleString()}</span>
                    <span className={`text-[10px] ml-auto font-bold px-2 py-0.5 rounded-full border ${
                      msg.status === 'DELIVERED' || msg.status === 'SENT' ? 'bg-green-50 text-green-600 border-green-200' :
                      msg.status === 'FAILED' || msg.status === 'BOUNCED' ? 'bg-red-50 text-red-600 border-red-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {msg.status}
                    </span>
                  </div>
                  
                  {/* Outbound Message */}
                  <div className="bg-white border border-slate-200 rounded-xl rounded-tr-sm p-3 sm:p-4 shadow-sm relative ml-4">
                    <div className="absolute -left-2 top-0 w-2 h-2 bg-white border-l border-t border-slate-200"></div>
                    {msg.subject && msg.channel === 'EMAIL' && <h4 className="font-bold text-sm text-slate-800 mb-1">{msg.subject}</h4>}
                    <div className="text-sm text-slate-600 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{__html: msg.content || msg.events?.find((e: any) => e.eventType === 'SENT')?.metadataJson?.text || 'Message Sent'}} />
                  </div>

                  {/* Incoming Replies (if any) */}
                  {msg.channel === 'WHATSAPP' || msg.channel === 'SMS' ? (
                    msg.events?.filter((e: any) => e.eventType === 'REPLY').map((reply: any) => (
                      <div key={reply.id} className="bg-green-50 border border-green-100 rounded-xl rounded-tl-sm p-3 sm:p-4 shadow-sm self-end mr-4 w-[90%] mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold text-green-600 uppercase">Incoming Reply</span>
                          <span className="text-[10px] text-green-500">{new Date(reply.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.metadataJson?.text || 'Received a message'}</p>
                      </div>
                    ))
                  ) : (
                    msg.replies?.map((reply: any) => (
                      <div key={reply.id} className="bg-blue-50 border border-blue-100 rounded-xl rounded-tl-sm p-3 sm:p-4 shadow-sm self-end mr-4 w-[90%] mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold text-blue-600 uppercase">Incoming Reply</span>
                          <span className="text-[10px] text-blue-500">{new Date(reply.receivedAt).toLocaleTimeString()}</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 mb-1">{reply.subject}</h4>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.body}</p>
                      </div>
                    ))
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
