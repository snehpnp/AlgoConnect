import { useEffect, useState } from 'react';
import {
  getTemplates,
  deleteTemplate,
  type MessageTemplate
} from '../services/template.service';
import { Plus, Edit2, Trash2, X, Eye, PhoneCall, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MessageTemplates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);

  const generateGmailPreview = (content: string, subject: string) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
        <style>
          body { margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, sans-serif; }
          .gmail-wrapper { max-width: 100%; padding: 16px 12px; box-sizing: border-box; }
          @media (min-width: 600px) { .gmail-wrapper { padding: 20px 24px; } }
          .gmail-subject { margin: 0 0 16px 0; font-size: 18px; font-weight: normal; color: #222; }
          @media (min-width: 600px) { .gmail-subject { font-size: 22px; } }
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

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await getTemplates();
      setTemplates(res.data || []);
    } catch (error) {
      console.error('Failed to fetch templates', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteTemplate(id);
        fetchTemplates();
      } catch (error) {
        console.error('Failed to delete template', error);
        alert('Failed to delete template');
      }
    }
  };

  if (loading) {
    return <div className="p-6">Loading templates...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-sm text-gray-500">Manage your Email, SMS, and WhatsApp templates.</p>
        </div>
        <button
          onClick={() => navigate('/templates/create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 sm:py-2 rounded-lg flex items-center shadow-sm transition-colors self-end sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 w-full overflow-hidden">
        {/* Mobile Card List */}
        <div className="sm:hidden divide-y divide-gray-100">
          {templates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No templates found. Create one to get started.
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900 text-sm">
                      {template.name}
                      {template.isShared && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                          Shared
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                        ${template.type === 'EMAIL' ? 'bg-blue-100 text-blue-700' :
                          template.type === 'WHATSAPP' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'}`}>
                        {template.type}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                        ${template.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {template.status}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-gray-500 text-xs line-clamp-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                  {template.type === 'EMAIL'
                    ? template.content.replace(new RegExp('<[^>]*>?', 'gm'), '') // Strip HTML
                    : template.content}
                </div>

                <div className="flex items-center justify-end gap-1 pt-1">
                  <button
                    onClick={() => setPreviewTemplate(template)}
                    className="text-gray-400 hover:text-green-600 p-2 hover:bg-green-50 rounded-lg transition-colors"
                    title="Preview Content"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/templates/${template.id}/edit`)}
                    className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto custom-scrollbar w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Content Preview</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No templates found. Create one to get started.
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">
                      {template.name}
                      {template.isShared && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                          Shared
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${template.type === 'EMAIL' ? 'bg-blue-100 text-blue-700' :
                          template.type === 'WHATSAPP' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'}`}>
                        {template.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${template.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {template.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 text-sm max-w-xs truncate">
                      {template.type === 'EMAIL'
                        ? template.content.replace(new RegExp('<[^>]*>?', 'gm'), '') // Strip HTML for plain text preview in table
                        : template.content}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewTemplate(template)}
                          className="text-gray-400 hover:text-green-600 p-2 hover:bg-green-50 rounded-lg transition-colors"
                          title="Preview Content"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/templates/${template.id}/edit`)}
                          className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#F8FAFC] rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-500" />
                <h2 className="text-[15px] font-semibold text-slate-800">
                  {previewTemplate.type === 'EMAIL' ? 'Email Preview' : 'SMS Preview'}
                </h2>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-0 sm:p-6 h-[75vh] sm:max-h-[75vh] overflow-y-auto custom-scrollbar flex flex-col">
              {previewTemplate.type === 'EMAIL' ? (
                <div className="bg-[#f6f8fc] sm:border border-slate-200 rounded-none sm:rounded-xl shadow-sm overflow-hidden flex-1 flex min-h-0">
                  <iframe
                    title="HTML preview"
                    srcDoc={generateGmailPreview(previewTemplate.content, previewTemplate.subject || '')}
                    className="flex-1 w-full h-full border-0"
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                  />
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-md mx-auto relative mt-4">
                  {/* SMS Tail Pointer Mock */}
                  <div className="absolute -left-2 top-6 w-4 h-4 bg-white border-l border-b border-slate-200 rotate-45 rounded-sm"></div>

                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <PhoneCall className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">SMS Message</div>
                      <div className="text-xs text-slate-500">To: +91 9876543210</div>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[15px] text-slate-800 leading-relaxed bg-[#F0F2F5] p-4 rounded-2xl rounded-tl-sm">
                    {previewTemplate.content}
                  </pre>
                  <div className="text-[10px] text-right text-slate-400 mt-2">Just now</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm shadow-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
