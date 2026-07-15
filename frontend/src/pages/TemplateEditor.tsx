import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getTemplateById,
  createTemplate,
  updateTemplate
} from '../services/template.service';
import { ArrowLeft, Save } from 'lucide-react';
import EmailEditor from 'react-email-editor';
import type { EditorRef } from 'react-email-editor';

export const TemplateEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [isPreviewingHtml, setIsPreviewingHtml] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    type: 'EMAIL',
    status: 'PENDING',
    content: '',
    designJson: null as any,
    isShared: false
  });

  const emailEditorRef = useRef<EditorRef>(null);

  useEffect(() => {
    if (id) {
      fetchTemplate(parseInt(id));
    }
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
          isShared: res.data.isShared || false
        });
      }
    } catch (error) {
      console.error('Failed to fetch template', error);
      alert('Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const onEditorLoad = () => {
    if (formData.designJson) {
      emailEditorRef.current?.editor?.loadDesign(formData.designJson);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If it's an email and we are NOT showing the raw HTML editor, get data from Unlayer
    if (formData.type === 'EMAIL' && !showHtml) {
      if (!emailEditorRef.current?.editor) {
        alert('Editor is still loading, please wait.');
        return;
      }
      emailEditorRef.current.editor.exportHtml(async (data) => {
        const { design, html } = data;
        try {
          const finalData = { ...formData, content: html, designJson: design };
          if (id) {
            await updateTemplate(parseInt(id), finalData);
          } else {
            await createTemplate(finalData);
          }
          navigate('/templates');
        } catch (error) {
          console.error('Failed to save template', error);
          alert('Failed to save template');
        }
      });
      return; // Return early because the export is async
    }

    try {
      if (id) {
        await updateTemplate(parseInt(id), formData);
      } else {
        await createTemplate(formData);
      }
      navigate('/templates');
    } catch (error) {
      console.error('Failed to save template', error);
      alert('Failed to save template');
    }
  };

  if (loading) {
    return <div className="p-6">Loading template...</div>;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/templates')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {id ? 'Edit Template' : 'Create Template'}
            </h1>
            <p className="text-sm text-gray-500">
              {id ? `Editing template #${id}` : 'Design a new message template'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/templates')}
            className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {id ? 'Update Template' : 'Save Template'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <form id="template-form" onSubmit={handleSubmit} className="h-full flex flex-col lg:flex-row">
          {/* Settings Sidebar */}
          <div className="w-full lg:w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Welcome Email"
                />
              </div>

              {formData.type === 'EMAIL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g., Welcome to AlgoConnect!"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                </select>
              </div>

              <div className="flex items-center pt-2">
                <input
                  type="checkbox"
                  id="isShared"
                  checked={formData.isShared}
                  onChange={(e) => setFormData({ ...formData, isShared: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isShared" className="ml-2 block text-sm font-medium text-gray-700">
                  Share this template globally
                </label>
              </div>

              {formData.type === 'EMAIL' && (
                <div className="pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowHtml(!showHtml)}
                    className="w-full py-2 px-4 border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    {showHtml ? 'Switch to Visual Builder' : 'Switch to Raw HTML'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 bg-gray-50 p-6 overflow-hidden flex flex-col">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col relative">
              {formData.type === 'EMAIL' ? (
                showHtml ? (
                  <div className="flex-1 flex flex-col h-full">
                    <div className="bg-slate-50 border-b border-gray-200 p-2 flex justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsPreviewingHtml(false)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!isPreviewingHtml ? 'bg-white shadow-sm text-gray-800 border border-gray-200' : 'text-gray-500 hover:bg-gray-200'}`}
                      >
                        Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPreviewingHtml(true)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${isPreviewingHtml ? 'bg-white shadow-sm text-gray-800 border border-gray-200' : 'text-gray-500 hover:bg-gray-200'}`}
                      >
                        Preview
                      </button>
                    </div>
                    {isPreviewingHtml ? (
                      <div className="flex-1 w-full bg-white relative">
                        <iframe
                          title="HTML Preview"
                          srcDoc={formData.content}
                          className="absolute inset-0 w-full h-full border-0"
                          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                        />
                      </div>
                    ) : (
                      <textarea
                        required
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        className="w-full flex-1 p-4 focus:outline-none resize-none font-mono text-sm bg-gray-900 text-gray-100 custom-scrollbar"
                        placeholder="<h1>Hello {{name}}</h1>"
                        spellCheck={false}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex-1 w-full h-full">
                    <EmailEditor
                      ref={emailEditorRef}
                      onLoad={onEditorLoad}
                      minHeight="100%"
                      options={{
                        displayMode: 'email',
                      }}
                    />
                  </div>
                )
              ) : (
                <div className="p-4 flex-1 flex flex-col">
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full flex-1 border border-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Hello {{name}}, welcome to our platform!"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Use variables like {'{{name}}'} to personalize the message.
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
