import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getTemplateById,
  createTemplate,
  updateTemplate
} from '../services/template.service';
import { ArrowLeft, Save, Sparkles, Code2, Eye, Mail, MessageSquare, Loader2, ChevronDown } from 'lucide-react';
import EmailEditor from 'react-email-editor';
import type { EditorRef } from 'react-email-editor';
import { apiClient } from '../services/apiClient';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Design tokens — kept as constants so every field in the sidebar renders
// with identical spacing, radius, and focus treatment. Change once, applies
// everywhere. This is what actually fixes "alignment" bugs long-term.
// ---------------------------------------------------------------------------
const FIELD =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 shadow-sm outline-none transition-colors ' +
  'focus:border-violet-500 focus:ring-2 focus:ring-violet-100';
const LABEL = 'mb-1.5 block text-[13px] font-medium text-slate-600';
const CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm';

type ChannelType = 'EMAIL' | 'SMS' | 'WHATSAPP';

const CHANNELS: { value: ChannelType; label: string; icon: React.ReactNode }[] = [
  { value: 'EMAIL', label: 'Email', icon: <Mail className="h-3.5 w-3.5" /> },
  { value: 'SMS', label: 'SMS', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: <MessageSquare className="h-3.5 w-3.5" /> },
];

const TOPIC_MAX = 240;

interface TemplateFormData {
  name: string;
  subject: string;
  type: ChannelType;
  status: 'PENDING' | 'APPROVED';
  content: string;
  designJson: any;
  isShared: boolean;
}

const EMPTY_FORM: TemplateFormData = {
  name: '',
  subject: '',
  type: 'EMAIL',
  status: 'PENDING',
  content: '',
  designJson: null,
  isShared: false,
};

export const TemplateEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [isPreviewingHtml, setIsPreviewingHtml] = useState(false);

  const generateGmailPreview = (content: string, subject: string) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, sans-serif; }
          .gmail-wrapper { max-width: 100%; padding: 20px 24px; }
          .gmail-subject { margin: 0 0 16px 0; font-size: 22px; font-weight: normal; color: #222; }
          .gmail-sender-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
          .gmail-sender-info-left { display: flex; align-items: center; }
          .gmail-avatar { width: 40px; height: 40px; border-radius: 50%; background-color: #f2a60c; color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-right: 12px; }
          .gmail-sender-name { font-size: 14px; font-weight: bold; color: #222; }
          .gmail-sender-email { font-weight: normal; color: #555; font-size: 12px; margin-left: 4px; }
          .gmail-to { font-size: 12px; color: #555; margin-top: 2px; }
          .gmail-timestamp { color: #555; font-size: 12px; }
          .gmail-content { font-size: 14px; line-height: 1.5; color: #222; }
        </style>
      </head>
      <body>
        <div class="gmail-wrapper">
          <h2 class="gmail-subject">${subject || '(No Subject)'}</h2>
          <div class="gmail-sender-row">
            <div class="gmail-sender-info-left">
              <div class="gmail-avatar">A</div>
              <div>
                <div class="gmail-sender-name">AlgoConnect <span class="gmail-sender-email">&lt;noreply@algoconnect.com&gt;</span></div>
                <div class="gmail-to">to me <span style="font-size: 10px; margin-left: 4px; color: #555;">▼</span></div>
              </div>
            </div>
            <div class="gmail-timestamp">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (0 minutes ago)</div>
          </div>
          <div class="gmail-content">
            ${content}
          </div>
        </div>
      </body>
      </html>
    `;
  };
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [formData, setFormData] = useState<TemplateFormData>(EMPTY_FORM);

  const emailEditorRef = useRef<EditorRef>(null);

  useEffect(() => {
    if (id) fetchTemplate(parseInt(id, 10));
  }, [id]);

  const fetchTemplate = async (templateId: number) => {
    try {
      setLoading(true);
      const res = await getTemplateById(templateId);
      if (res.data) {
        setFormData({
          name: res.data.name,
          subject: res.data.subject || '',
          type: res.data.type,
          status: res.data.status,
          content: res.data.content,
          designJson: res.data.designJson || null,
          isShared: res.data.isShared || false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch template', error);
      toast.error('Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const onEditorLoad = () => {
    if (formData.designJson) {
      emailEditorRef.current?.editor?.loadDesign(formData.designJson);
    }
  };

  const persist = useCallback(
    async (payload: TemplateFormData) => {
      setSaving(true);
      try {
        if (id) {
          await updateTemplate(parseInt(id, 10), payload);
        } else {
          await createTemplate(payload);
        }
        toast.success(id ? 'Template updated' : 'Template created');
        navigate('/templates');
      } catch (error) {
        console.error('Failed to save template', error);
        toast.error('Failed to save template');
      } finally {
        setSaving(false);
      }
    },
    [id, navigate]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Email + visual builder: pull the latest HTML/design out of Unlayer first.
    if (formData.type === 'EMAIL' && !showHtml) {
      if (!emailEditorRef.current?.editor) {
        toast.error('Editor is still loading, please wait.');
        return;
      }
      setSaving(true);
      emailEditorRef.current.editor.exportHtml(async (data) => {
        const { design, html } = data;
        await persist({ ...formData, content: html, designJson: design });
      });
      return; // async export continues in the callback above
    }

    await persist(formData);
  };

  const handleGenerateAI = async () => {
    const topic = aiTopic.trim();
    if (!topic) {
      toast.error('Describe what this message should say first');
      return;
    }
    try {
      setIsGenerating(true);
      const res = await apiClient.post('/ai/generate-template', {
        topic,
        channelType: formData.type,
      });
      if (res.data?.success && res.data?.data) {
        setFormData((prev) => ({
          ...prev,
          subject: res.data.data.subject || prev.subject,
          content: res.data.data.content || prev.content,
        }));
        if (formData.type === 'EMAIL') setShowHtml(true);
        setAiOpen(false);
        toast.success('Draft generated — review and tweak below');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate template');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading template…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-50">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                          */}
      {/* ---------------------------------------------------------------- */}
      <header className="flex flex-shrink-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 py-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/templates')}
            aria-label="Back to templates"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight text-slate-900">
              {id ? 'Edit template' : 'Create template'}
            </h1>
            <p className="text-[13px] leading-tight text-slate-500">
              {id ? `Editing template #${id}` : 'Design a new message template'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate('/templates')}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="template-form"
            disabled={saving}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {id ? 'Update template' : 'Save template'}
          </button>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Body                                                             */}
      {/* ---------------------------------------------------------------- */}
      <form id="template-form" onSubmit={handleSubmit} className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full flex-shrink-0 space-y-5 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-4 sm:p-5 lg:w-[340px]">
          {/* AI Magic Generator — collapsed to a single row by default so it
              doesn't push the fields people need on every save below the
              fold. Expands inline only when someone actually wants it. */}
          <section className={`overflow-hidden rounded-lg border ${aiOpen ? 'border-violet-200' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setAiOpen((v) => !v)}
              aria-expanded={aiOpen}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${aiOpen ? 'bg-violet-50' : 'bg-white hover:bg-slate-50'
                }`}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-violet-600 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13px] font-semibold text-slate-700">Generate with AI</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
            </button>

            {aiOpen && (
              <div className="border-t border-violet-100 bg-violet-50/50 p-3">
                <p className="mb-2 text-[12px] leading-snug text-slate-500">
                  Describe the message and get a starting draft for this {formData.type.toLowerCase()}.
                </p>

                <textarea
                  rows={2}
                  maxLength={TOPIC_MAX}
                  autoFocus
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Welcome message for new signups, friendly tone, mention our 14-day trial"
                  className={`${FIELD} resize-none bg-white`}
                />
                <div className="mb-2 mt-1 text-right text-[11px] text-slate-400">
                  {aiTopic.length}/{TOPIC_MAX}
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={isGenerating || !aiTopic.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate draft
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          {/* Template details */}

          <section>
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
              Template details
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="tpl-name" className={LABEL}>Template name</label>
                <input
                  id="tpl-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Welcome email"
                  className={FIELD}
                />
              </div>

              {formData.type === 'EMAIL' && (
                <div>
                  <label htmlFor="tpl-subject" className={LABEL}>Email subject</label>
                  <input
                    id="tpl-subject"
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. Welcome to AlgoConnect!"
                    className={FIELD}
                  />
                </div>
              )}

              {/* Channel — segmented control instead of a bare <select>, so the
                  most-changed field in this form is also the fastest to use. */}
              <div>
                <span className={LABEL}>Channel</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: c.value })}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[12px] font-medium transition-colors ${formData.type === c.value
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                      {c.icon}
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="tpl-status" className={LABEL}>Status</label>
                <select
                  id="tpl-status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TemplateFormData['status'] })}
                  className={FIELD}
                >
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                </select>
              </div>

              <label
                htmlFor="isShared"
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <input
                  id="isShared"
                  type="checkbox"
                  checked={formData.isShared}
                  onChange={(e) => setFormData({ ...formData, isShared: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-sm font-medium text-slate-700">Share this template globally</span>
              </label>
            </div>
          </section>

          {formData.type === 'EMAIL' && (
            <section className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowHtml(!showHtml)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                {showHtml ? (
                  <>
                    <Eye className="h-4 w-4" />
                    Switch to visual builder
                  </>
                ) : (
                  <>
                    <Code2 className="h-4 w-4" />
                    Switch to raw HTML
                  </>
                )}
              </button>
            </section>
          )}
        </aside>

        {/* Editor canvas */}
        <div className="flex flex-1 flex-col p-4 sm:p-5 lg:overflow-hidden min-h-[600px] lg:min-h-0">
          <div className={`${CARD} flex flex-1 flex-col overflow-hidden`}>
            {formData.type === 'EMAIL' ? (
              showHtml ? (
                <div className="flex h-full flex-1 flex-col">
                  <div className="flex flex-shrink-0 justify-end gap-1.5 border-b border-slate-200 bg-slate-50 p-2">
                    <button
                      type="button"
                      onClick={() => setIsPreviewingHtml(false)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${!isPreviewingHtml
                          ? 'border border-slate-200 bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPreviewingHtml(true)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${isPreviewingHtml
                          ? 'border border-slate-200 bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                  </div>

                  {isPreviewingHtml ? (
                    <div className="relative w-full flex-1 bg-[#f6f8fc]">
                      <iframe
                        title="HTML preview"
                        srcDoc={generateGmailPreview(formData.content, formData.subject)}
                        className="absolute inset-0 h-full w-full border-0"
                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                      />
                    </div>
                  ) : (
                    <textarea
                      required
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="custom-scrollbar w-full flex-1 resize-none bg-slate-900 p-4 font-mono text-sm text-slate-100 outline-none"
                      placeholder="<h1>Hello {{name}}</h1>"
                      spellCheck={false}
                    />
                  )}
                </div>
              ) : (
                <div className="h-full w-full flex-1">
                  <EmailEditor
                    ref={emailEditorRef}
                    onLoad={onEditorLoad}
                    minHeight="100%"
                    options={{ displayMode: 'email' }}
                  />
                </div>
              )
            ) : (
              <div className="flex flex-1 flex-col p-4">
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full flex-1 resize-none rounded-lg border border-slate-200 p-4 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  placeholder="Hello {{name}}, welcome to our platform!"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Use variables like {'{{name}}'} to personalize the message.
                </p>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};