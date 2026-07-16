import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, Mail } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen && lead) {
      fetchTemplates();
      setSubject('');
      setBody('');
      setSelectedTemplateId('');
    }
  }, [isOpen, lead]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await getTemplates();
      const templateList = Array.isArray(res) ? res : (res.data || []);
      console.log("templateList", templateList)
      setTemplates(templateList.filter((t: any) => t.type === 'EMAIL' && t.status === 'APPROVED'));
    } catch (err) {
      console.error('Failed to load templates', err);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

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
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and body are required');
      return;
    }
    if (!lead) return;

    setIsSending(true);
    try {
      await leadsService.sendDirectEmail(lead.id, {
        subject,
        body,
        templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined
      });
      toast.success('Direct email sent successfully!');
      onClose();
    } catch (err: any) {
      console.error('Send failed', err);
      toast.error(err?.response?.data?.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-indigo-600">
            <Mail className="h-5 w-5" />
            <h2 className="text-lg font-bold text-slate-800">Send Direct Email</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">To Recipient</p>
            <p className="text-sm font-bold text-slate-800">{lead.name}</p>
            <p className="text-sm text-slate-600">{lead.email || <span className="text-red-500 text-xs font-semibold">No Email Address Available</span>}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">Select Template (Optional)</label>
            {isLoading ? (
              <div className="h-10 border border-slate-200 rounded-lg bg-slate-50 animate-pulse" />
            ) : (
              <select
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
              >
                <option value="">-- No Template (Write custom message) --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">Message Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here. HTML is supported."
              className="w-full h-40 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !lead.email}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
};
