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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-sm text-gray-500">Manage your Email, SMS, and WhatsApp templates.</p>
        </div>
        <button
          onClick={() => navigate('/templates/create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
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
                      ? template.content.replace(/<[^>]*>?/gm, '') // Strip HTML for plain text preview in table
                      : template.content}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className="text-gray-400 hover:text-green-600 p-2 transition-colors"
                      title="Preview Content"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/templates/${template.id}/edit`)}
                      className="text-gray-400 hover:text-blue-600 p-2 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-gray-400 hover:text-red-600 p-2 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
            <div className="p-0 sm:p-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {previewTemplate.type === 'EMAIL' ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  {/* Email Header */}
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-xl font-medium text-slate-900 mb-4">
                      {previewTemplate.subject || '(No Subject)'}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                          A
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-slate-900">AlgoConnect Sales</span>
                            <span className="text-xs text-slate-500">&lt;sales@algoconnect.com&gt;</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            to <span className="text-slate-700">Client Name</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="p-6">
                    <div
                      className="prose prose-sm sm:prose-base max-w-none prose-slate"
                      dangerouslySetInnerHTML={{ __html: previewTemplate.content }}
                    />
                  </div>
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
