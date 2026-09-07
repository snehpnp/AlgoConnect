import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Send, Loader2, Mail, MessageSquare, Phone, Check, CheckCheck, Clock } from 'lucide-react';
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

// --- Unified chat message shape used to render the WhatsApp-style thread ---
interface ChatBubble {
  id: string;
  direction: 'OUTBOUND' | 'INBOUND';
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  subject?: string;
  text: string;
  status?: string;
  timestamp: string;
}

/**
 * Flattens the raw history payload (sent messages + their nested reply events)
 * into a single chronological list of chat bubbles, the way a real chat UI works.
 */
function buildChatThread(history: any[], channel: 'EMAIL' | 'SMS' | 'WHATSAPP'): ChatBubble[] {
  const bubbles: ChatBubble[] = [];

  for (const msg of history) {
    if (msg.channel !== channel) continue;

    // Find the first SENT event that has either 'text' or 'htmlContent'
    const sentEventText = msg.events?.reduce((acc: string | null, e: any) => {
      if (acc) return acc;
      if (e.eventType === 'SENT' && e.metadataJson) {
        return e.metadataJson.text || e.metadataJson.htmlContent || null;
      }
      return null;
    }, null);

    // Outbound (sent) bubble
    bubbles.push({
      id: `sent-${msg.id}`,
      direction: 'OUTBOUND',
      channel: msg.channel,
      subject: msg.channel === 'EMAIL' ? msg.subject : undefined,
      text: msg.content || sentEventText || 'Message Sent',
      status: msg.status,
      timestamp: msg.createdAt,
    });

    // Inbound replies — WhatsApp/SMS store them in events, Email stores them in replies[]
    if (channel === 'WHATSAPP' || channel === 'SMS') {
      (msg.events || [])
        .filter((e: any) => e.eventType === 'REPLY')
        .forEach((reply: any) => {
          bubbles.push({
            id: `reply-${reply.id}`,
            direction: 'INBOUND',
            channel: msg.channel,
            text: reply.metadataJson?.text || 'Received a message',
            timestamp: reply.createdAt,
          });
        });
    } else {
      (msg.replies || []).forEach((reply: any) => {
        bubbles.push({
          id: `reply-${reply.id}`,
          direction: 'INBOUND',
          channel: msg.channel,
          subject: reply.subject,
          text: reply.body,
          timestamp: reply.receivedAt,
        });
      });
    }
  }

  // Oldest -> newest, like a real chat thread
  return bubbles.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function StatusTicks({ status, onLight = false }: { status?: string; onLight?: boolean }) {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === 'FAILED' || s === 'BOUNCED') {
    return (
      <span className={`text-[11px] font-medium ${onLight ? 'text-red-500' : 'text-red-200/90'}`}>
        Failed
      </span>
    );
  }
  if (s === 'DELIVERED' || s === 'READ') {
    return <CheckCheck className={`w-3.5 h-3.5 ${onLight ? 'text-sky-500' : 'text-sky-300'}`} />;
  }
  if (s === 'SENT') {
    return <Check className={`w-3.5 h-3.5 ${onLight ? 'text-slate-400' : 'text-white/70'}`} />;
  }
  return <Clock className={`w-3.5 h-3.5 ${onLight ? 'text-slate-400' : 'text-white/60'}`} />;
}

/**
 * Detects whether a message body contains meaningful HTML markup —
 * either a full document (<!DOCTYPE>, <html>) or just HTML tags/snippets
 * (e.g. <div>, <p>, <table>, <span style="...">). Templates aren't always
 * saved as full documents, so we check broadly rather than requiring <html>.
 */
function isHtmlDocument(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('<!doctype html') || /<html[\s>]/.test(lower)) return true;

  // Generic check: does it contain real HTML tags (not just a stray "<" or "3 < 5")?
  const tagMatches = trimmed.match(/<\/?[a-z][a-z0-9]*(\s[^<>]*)?>/gi);
  return !!tagMatches && tagMatches.length >= 1;
}

/**
 * Wraps a raw HTML snippet (no <html>/<body>) in a minimal document shell
 * so it renders correctly and consistently inside the sandboxed iframe.
 */
function toPreviewDoc(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('<html')) return text;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { margin: 0; padding: 16px; font-family: Arial, Helvetica, sans-serif; color: #1e293b; background: #ffffff; }
      img { max-width: 100%; }
    </style>
  </head>
  <body>${text}</body>
</html>`;
}

function formatBubbleTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(ts: string) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

const CHANNEL_THEME: Record<
  'EMAIL' | 'SMS' | 'WHATSAPP',
  { bg: string; outBubble: string; outText: string; accent: string; pattern: string }
> = {
  WHATSAPP: {
    bg: 'bg-[#e5ddd5]',
    outBubble: 'bg-[#d9fdd3]',
    outText: 'text-slate-800',
    accent: 'text-green-600',
    pattern:
      "bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.035)_1px,transparent_0)] bg-[size:16px_16px]",
  },
  SMS: {
    bg: 'bg-indigo-50/60',
    outBubble: 'bg-indigo-600',
    outText: 'text-white',
    accent: 'text-indigo-600',
    pattern: '',
  },
  EMAIL: {
    bg: 'bg-blue-50/60',
    outBubble: 'bg-blue-600',
    outText: 'text-white',
    accent: 'text-blue-600',
    pattern: '',
  },
};

export const DirectMailModal: React.FC<DirectMailModalProps> = ({ isOpen, onClose, lead }) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bodyView, setBodyView] = useState<'code' | 'preview'>('code');

  const [channel, setChannel] = useState<'EMAIL' | 'SMS' | 'WHATSAPP'>('EMAIL');
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [selectedPhone, setSelectedPhone] = useState<string>('');

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Single, optimized pass: build the chronological chat thread for the active channel.
  const chatThread = useMemo(() => buildChatThread(history, channel), [history, channel]);

  // Group bubbles by calendar day so we can render WhatsApp-style day separators.
  const groupedThread = useMemo(() => {
    const groups: { label: string; items: ChatBubble[] }[] = [];
    for (const bubble of chatThread) {
      const label = formatDayLabel(bubble.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(bubble);
      } else {
        groups.push({ label, items: [bubble] });
      }
    }
    return groups;
  }, [chatThread]);

  // Auto-scroll to the latest message whenever the thread updates.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [groupedThread]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTemplateId(val ? Number(val) : '');

    if (val) {
      const tmpl = templates.find(t => t.id === Number(val));
      if (tmpl) {
        setSubject(tmpl.subject || '');
        setBody(tmpl.content || '');
        // Templates are usually full HTML — jump straight to the rendered preview.
        setBodyView(isHtmlDocument(tmpl.content || '') ? 'preview' : 'code');
      }
    } else {
      setSubject('');
      setBody('');
      setBodyView('code');
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

  const availableEmails: { label: string, value: string }[] = [];
  if (lead?.email) availableEmails.push({ label: `Primary (${lead.email})`, value: lead.email });
  if (lead?.email2) availableEmails.push({ label: `Secondary (${lead.email2})`, value: lead.email2 });
  if ((lead as any)?.scrapedEmail) availableEmails.push({ label: `Scraped (${(lead as any).scrapedEmail})`, value: (lead as any).scrapedEmail });

  const availablePhones: { label: string, value: string }[] = [];
  if (lead?.phone) availablePhones.push({ label: `Primary (${lead.phone})`, value: lead.phone });
  if (lead?.phone2) availablePhones.push({ label: `Secondary (${lead.phone2})`, value: lead.phone2 });
  if ((lead as any)?.scrapedPhone) availablePhones.push({ label: `Scraped (${(lead as any).scrapedPhone})`, value: (lead as any).scrapedPhone });

  const theme = CHANNEL_THEME[channel];

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

          <div className="p-5 pb-4 flex-shrink-0 space-y-4 border-b border-slate-100">
            {/* Channel Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setChannel('EMAIL')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-md transition-all ${channel === 'EMAIL' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Mail className="w-4 h-4" /> Email
              </button>
              <button
                onClick={() => setChannel('WHATSAPP')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-md transition-all ${channel === 'WHATSAPP' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
              <button
                onClick={() => setChannel('SMS')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-md transition-all ${channel === 'SMS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Phone className="w-4 h-4" /> SMS
              </button>
            </div>

            {/* Compact row: Recipient + Template side by side to save vertical space */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">To Recipient</p>
                {channel === 'EMAIL' ? (
                  availableEmails.length > 1 ? (
                    <select
                      value={selectedEmail}
                      onChange={(e) => setSelectedEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {availableEmails.map(em => (
                        <option key={em.value} value={em.value}>{em.label}</option>
                      ))}
                    </select>
                  ) : availableEmails.length === 1 ? (
                    <p className="text-sm font-medium text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 truncate">{availableEmails[0].value}</p>
                  ) : (
                    <span className="text-red-500 text-sm font-semibold flex items-center gap-1 bg-red-50 px-3 py-2 rounded-lg"><X className="w-4 h-4" /> No Email</span>
                  )
                ) : (
                  availablePhones.length > 1 ? (
                    <select
                      value={selectedPhone}
                      onChange={(e) => setSelectedPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {availablePhones.map(ph => (
                        <option key={ph.value} value={ph.value}>{ph.label}</option>
                      ))}
                    </select>
                  ) : availablePhones.length === 1 ? (
                    <p className="text-sm font-medium text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 truncate">{availablePhones[0].value}</p>
                  ) : (
                    <span className="text-red-500 text-sm font-semibold flex items-center gap-1 bg-red-50 px-3 py-2 rounded-lg"><X className="w-4 h-4" /> No Phone</span>
                  )
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Template (Optional)</p>
                {isLoading ? (
                  <div className="h-[38px] border border-slate-200 rounded-lg bg-slate-50 animate-pulse" />
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
            </div>

            {channel === 'EMAIL' && (
              <div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            )}
          </div>

          {/* Message Body — gets the remaining space, with a Code/Preview toggle for HTML content */}
          <div className="flex-1 flex flex-col min-h-0 px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Message Body</label>
              {isHtmlDocument(body) && (
                <div className="flex p-0.5 bg-slate-100 rounded-md">
                  <button
                    type="button"
                    onClick={() => setBodyView('code')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${bodyView === 'code' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setBodyView('preview')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${bodyView === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Preview
                  </button>
                </div>
              )}
            </div>

            {isHtmlDocument(body) && bodyView === 'preview' ? (
              <div className="flex-1 min-h-[220px] rounded-lg border border-slate-300 bg-white shadow-inner overflow-hidden">
                <iframe
                  title="email-body-preview"
                  srcDoc={toPreviewDoc(body)}
                  sandbox=""
                  className="w-full h-full"
                  style={{ border: 'none' }}
                />
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`Write your ${channel.toLowerCase()} here...`}
                className="w-full flex-1 min-h-[220px] rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none shadow-inner font-mono"
              />
            )}
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
              className={`inline-flex items-center gap-2 px-6 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-sm ${channel === 'WHATSAPP' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-600/50' :
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

        {/* Right Side: Message History — real chat-style thread */}
        <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col h-[50vh] lg:h-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white z-10">
            <div>
              <h3 className="font-bold text-slate-800">Communication History</h3>
              <p className={`text-xs font-semibold ${theme.accent}`}>
                {channel === 'WHATSAPP' ? 'WhatsApp' : channel === 'SMS' ? 'SMS' : 'Email'} conversation
              </p>
            </div>
            <button onClick={onClose} className="hidden lg:block p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-1 ${theme.bg} ${theme.pattern}`}
          >
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Loading conversation...</p>
              </div>
            ) : groupedThread.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                <MessageSquare className="w-8 h-8 opacity-50" />
                <p className="text-sm">No {channel.toLowerCase()} messages sent yet</p>
              </div>
            ) : (
              groupedThread.map((group) => (
                <div key={group.label} className="space-y-1">
                  {/* Day separator, like WhatsApp */}
                  <div className="flex justify-center my-3">
                    <span className="bg-white/90 text-slate-500 text-[11px] font-semibold px-3 py-1 rounded-full shadow-sm">
                      {group.label}
                    </span>
                  </div>

                  {group.items.map((bubble) => {
                    const isOut = bubble.direction === 'OUTBOUND';
                    const isFullHtml = isHtmlDocument(bubble.text);

                    return (
                      <div
                        key={bubble.id}
                        className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1.5`}
                      >
                        <div
                          className={`relative rounded-lg shadow-sm text-sm leading-snug overflow-hidden ${isFullHtml ? 'w-[85%]' : 'max-w-[80%] px-3 py-2'
                            } ${isOut
                              ? `${theme.outBubble} ${theme.outText} rounded-tr-sm`
                              : 'bg-white text-slate-800 rounded-tl-sm'
                            }`}
                        >
                          {bubble.subject && (
                            <p
                              className={`font-bold text-sm ${isFullHtml ? 'px-3 pt-2' : 'mb-1'} ${isOut ? '' : 'text-slate-800'
                                }`}
                            >
                              {bubble.subject}
                            </p>
                          )}

                          {isFullHtml ? (
                            // Full HTML email template -> render an actual visual preview
                            // instead of dumping raw markup into the bubble.
                            <div className="bg-white border-t border-black/5 mt-2">
                              <iframe
                                title={`email-preview-${bubble.id}`}
                                srcDoc={toPreviewDoc(bubble.text)}
                                sandbox=""
                                className="w-full h-56 sm:h-64"
                                style={{ border: 'none', pointerEvents: 'none' }}
                              />
                            </div>
                          ) : (
                            <div
                              className="whitespace-pre-wrap break-words pr-10"
                              dangerouslySetInnerHTML={{ __html: bubble.text }}
                            />
                          )}

                          <span
                            className={`flex items-center gap-1 mt-1 text-[10px] ${isFullHtml ? 'justify-end px-3 pb-2' : 'float-right ml-2'
                              } ${isOut
                                ? isFullHtml
                                  ? 'text-slate-400'
                                  : channel === 'WHATSAPP'
                                    ? 'text-slate-500'
                                    : 'text-white/70'
                                : 'text-slate-400'
                              }`}
                          >
                            {formatBubbleTime(bubble.timestamp)}
                            {isOut && <StatusTicks status={bubble.status} onLight={isFullHtml} />}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};