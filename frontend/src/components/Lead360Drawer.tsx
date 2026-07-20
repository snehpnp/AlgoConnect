import { useState, useEffect } from 'react';
import {
  X, Mail, Phone as PhoneIcon, MapPin, Clock,
  CheckCircle2, Sparkles, ArrowRight, Globe,
  Link as LinkIcon, Briefcase, AlertCircle, Edit2,
  StickyNote, Calendar, Send, Trash2, Bell,
  MessageSquare, PhoneCall
} from 'lucide-react';
import type { Lead } from '../services/leads.service';
import { leadsService, getUnifiedStatus } from '../services/leads.service';
import { apiClient } from '../services/apiClient';
import { usersService } from '../services/users.service';
import type { User } from '../services/users.service';
import toast from 'react-hot-toast';

interface Lead360DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onEdit: (lead: Lead) => void;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(d);
};

const getLeadScore = (lead: any) => lead.leadScore || 0;

// Helper to strip quoted email threads from replies
const parseEmailBody = (body: string) => {
  if (!body) return '';
  // Split at common quote markers like "On ... wrote:" or original message boundaries
  const quoteRegex = /(?:\n\s*On\s+.+?wrote:)|(?:\n\s*_{2,}\n)|(?:\n\s*--+.*Original Message.*--+)/i;
  const parts = body.split(quoteRegex);
  // Optional: Also remove any trailing lines that start with ">"
  let cleanText = parts[0].trim();
  cleanText = cleanText.split('\n').filter(line => !line.trim().startsWith('>')).join('\n');
  return cleanText.trim();
};

export const Lead360Drawer = ({ isOpen, onClose, lead, onEdit }: Lead360DrawerProps) => {
  const [activeTab, setActiveTab] = useState<'data' | 'timeline' | 'notes' | 'emails'>('data');
  const [dataView, setDataView] = useState<'sebi' | 'scraped' | 'all'>('sebi');
  const [logs, setLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Follow-Up state
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);

  // Call Log state
  const [showCallLogModal, setShowCallLogModal] = useState(false);
  const [callOutcome, setCallOutcome] = useState('Interested');
  const [callNotes, setCallNotes] = useState('');
  const [isLoggingCall, setIsLoggingCall] = useState(false);

  // Email Replies state
  const [emailReplies, setEmailReplies] = useState<any[]>([]);

  useEffect(() => {
    usersService.getUsers().then(res => setTeamMembers(res.data)).catch(console.error);
  }, []);

  const updateStatus = async (newStatus: string) => {
    if (!lead) return;
    setIsUpdatingStatus(true);
    try {
      const updatedLead = await leadsService.updateLead(lead.id, { status: newStatus });
      onEdit(updatedLead);
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssignUser = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUserId = e.target.value ? parseInt(e.target.value) : null;
    try {
      setIsUpdatingStatus(true);
      const res = await leadsService.updateLead(lead!.id, { userId: newUserId } as any);
      toast.success('Lead assigned successfully');
      // Opt: update local lead state or trigger onEdit
      onEdit((res as any).data || res);
    } catch (err) {
      console.error(err);
      toast.error('Failed to assign lead');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen && lead) {
      setActiveTab('data');
      setDataView('sebi');
      setIsLoadingLogs(true);
      // Reset follow-up form
      setFollowUpDate(lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt as any).toISOString().slice(0, 16) : '');
      setFollowUpNote((lead as any).followUpNotes || '');
      setShowFollowUpForm(false);
      Promise.all([
        leadsService.getLeadLogs(lead.id).catch(() => []),
        apiClient.get(`/messages/leads/${lead.id}`).then(res => res.data.data).catch(() => []),
        apiClient.get(`/leads/${lead.id}/notes`).then(res => res.data.data).catch(() => []),
        apiClient.get(`/messages/leads/${lead.id}/email-replies`).then(res => res.data.data).catch(() => [])
      ])
        .then(([logsRes, emailRes, notesRes, repliesRes]) => {
          setLogs(logsRes);
          setEmailLogs(emailRes);
          setNotes(notesRes);
          setEmailReplies(repliesRes);
        })
        .finally(() => setIsLoadingLogs(false));
    } else {
      setLogs([]);
      setEmailLogs([]);
      setNotes([]);
      setEmailReplies([]);
    }
  }, [isOpen, lead]);

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !lead) return;
    setIsSavingNote(true);
    try {
      const res = await apiClient.post(`/leads/${lead.id}/notes`, { content: newNoteContent });
      setNotes(prev => [res.data.data, ...prev]);
      setNewNoteContent('');
      toast.success('Note added!');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await apiClient.delete(`/notes/${noteId}`);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch {
      toast.error('Failed to delete note');
    }
  };

  const handleSaveFollowUp = async () => {
    if (!lead) return;
    setIsSavingFollowUp(true);
    try {
      const res = await apiClient.put(`/leads/${lead.id}/follow-up`, {
        nextFollowUpAt: followUpDate || null,
        followUpNotes: followUpNote
      });
      onEdit({ ...lead, ...res.data.data } as any);
      toast.success('Follow-up saved!');
      setShowFollowUpForm(false);
    } catch {
      toast.error('Failed to save follow-up');
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  const handleLogCall = async () => {
    if (!lead) return;
    setIsLoggingCall(true);
    try {
      const res = await apiClient.post(`/leads/${lead.id}/notes`, {
        content: `📞 Call Logged [${callOutcome}]\n${callNotes}`
      });
      setNotes(prev => [res.data.data, ...prev]);
      
      // Update last contacted date via follow-up endpoint
      await apiClient.put(`/leads/${lead.id}/follow-up`, {
        nextFollowUpAt: (lead as any).nextFollowUpAt, // keep existing
        followUpNotes: (lead as any).followUpNotes // keep existing
        // The backend `setFollowUp` actually logs activity but we might want a real lastContactedAt update.
      });

      // Update lead sales stage if outcome warrants it
      if (callOutcome === 'Interested') {
        await leadsService.updateLead(lead.id, { salesStage: 'Contacted' } as any);
      }
      
      toast.success('Call logged successfully!');
      setShowCallLogModal(false);
      setCallNotes('');
      setCallOutcome('Interested');
      
      // we need to notify parent to refetch
      onEdit({ ...lead, salesStage: callOutcome === 'Interested' ? 'Contacted' : lead.salesStage } as any);

    } catch (err) {
      toast.error('Failed to log call');
    } finally {
      setIsLoggingCall(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="flex h-full w-full sm:w-[500px] md:w-[600px] max-w-2xl flex-col bg-slate-50/95 backdrop-blur-xl shadow-premium border-l border-white/50 transition-transform duration-300"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200/50 bg-white/50 px-6 py-4 z-10">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
              Lead 360 View
            </h2>
            <p className="text-slate-500 text-xs mt-1 font-medium">
              Complete details and history for this lead
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100/50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Profile Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white/80 p-5 rounded-2xl border border-white/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            {lead.logoUrl ? (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl overflow-hidden ring-1 ring-inset ring-slate-200/50 bg-white shadow-sm">
                <img src={lead.logoUrl} alt={lead.name} className="h-full w-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = `<div class="flex h-16 w-16 items-center justify-center bg-blue-50 text-blue-600 font-bold text-xl">${lead.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>` }} />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold text-2xl ring-1 ring-inset ring-blue-100">
                {lead.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <a
                  href={lead.website ? lead.website : `https://www.google.com/search?q=${encodeURIComponent(lead.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block min-w-0"
                  title="Click to search on Google"
                >
                  <h3 className="text-xl font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors cursor-pointer">{lead.name}</h3>
                </a>
                <div className="flex gap-2 shrink-0">
                  {(() => {
                    const status = getUnifiedStatus(lead);
                    let colorClass = 'bg-slate-100 text-slate-700 ring-slate-500/10';

                    if (['Client Won', 'Qualified', 'Converted / Closed'].includes(status)) colorClass = 'bg-emerald-50 text-emerald-700 ring-emerald-600/10';
                    else if (['Replied', 'Demo Requested', 'Negotiation'].includes(status)) colorClass = 'bg-purple-50 text-purple-700 ring-purple-600/10';
                    else if (['Opened', 'Clicked', 'Contacted'].includes(status)) colorClass = 'bg-blue-50 text-blue-700 ring-blue-600/10';
                    else if (['Active'].includes(status)) colorClass = 'bg-teal-50 text-teal-700 ring-teal-600/10';
                    else if (['Enriched', 'Imported'].includes(status)) colorClass = 'bg-slate-50 text-slate-700 ring-slate-600/10';
                    else if (['Client Lost', 'Likely Inactive'].includes(status)) colorClass = 'bg-red-50 text-red-700 ring-red-600/10';
                    else if (status === 'Unverified') colorClass = 'bg-amber-50 text-amber-700 ring-amber-600/10';

                    return (
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${colorClass}`}>
                        {status}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-1">Lead ID: <span className="font-medium text-slate-700">{lead.id}</span></p>
            </div>
            
            <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto gap-2 sm:gap-1 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Assign To</label>
              <select 
                disabled={isUpdatingStatus}
                value={lead.userId || ''} 
                onChange={handleAssignUser}
                className="input-base !py-1.5 !text-xs !min-h-0 disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {teamMembers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes + Follow-Up Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-5">
              {/* Follow-Up Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-slate-800">Follow-Up Reminder</h3>
                  </div>
                  {(lead as any).nextFollowUpAt && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      new Date((lead as any).nextFollowUpAt) < new Date()
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {new Date((lead as any).nextFollowUpAt) < new Date() ? '⚠️ Overdue' : '📅 Scheduled'}: {new Date((lead as any).nextFollowUpAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {!showFollowUpForm ? (
                  <button
                    onClick={() => setShowFollowUpForm(true)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 text-amber-600 rounded-lg py-3 text-sm font-semibold transition-all"
                  >
                    <Calendar className="h-4 w-4" />
                    {(lead as any).nextFollowUpAt ? 'Change Follow-Up Date' : 'Schedule Follow-Up'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">Follow-Up Date & Time</label>
                      <input
                        type="datetime-local"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">Reminder Note (optional)</label>
                      <input
                        type="text"
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        placeholder="e.g. Call about pricing proposal..."
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveFollowUp}
                        disabled={isSavingFollowUp}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isSavingFollowUp ? 'Saving...' : 'Save Follow-Up'}
                      </button>
                      <button
                        onClick={() => setShowFollowUpForm(false)}
                        className="px-4 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <StickyNote className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">Notes</h3>
                  <span className="text-xs text-slate-400">({notes.length} notes)</span>
                </div>

                {/* Add Note */}
                <div className="flex gap-2 mb-5">
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Add a note, call outcome, or observation..."
                    rows={2}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={isSavingNote || !newNoteContent.trim()}
                    className="px-3 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center"
                    title="Add note (Ctrl+Enter)"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>

                {/* Notes List */}
                {notes.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No notes yet. Add your first note above.</p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="group bg-amber-50/60 border border-amber-100 rounded-lg p-3 relative">
                        <p className="text-sm text-slate-800 whitespace-pre-wrap pr-6">{note.content}</p>
                        <p className="text-[10px] text-slate-400 mt-2">{new Date(note.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-white/80 p-3 rounded-xl border border-white/50 shadow-sm">
            {lead.phone && (
              <a 
                href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(lead.name)},`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            {lead.phone && (
              <a 
                href={`tel:${lead.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
              >
                <PhoneIcon className="h-3.5 w-3.5" /> Call
              </a>
            )}
            <button
              onClick={() => setShowCallLogModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-xs font-bold transition-colors"
            >
              <PhoneCall className="h-3.5 w-3.5" /> Log Call
            </button>
          </div>

          {/* Call Log Modal */}
          {showCallLogModal && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 shadow-sm relative animate-in fade-in zoom-in duration-200">
              <button 
                onClick={() => setShowCallLogModal(false)}
                className="absolute top-3 right-3 text-purple-400 hover:text-purple-600"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-3">
                <PhoneCall className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-bold text-purple-900">Log a Call</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-purple-800 mb-1 block">Outcome</label>
                  <select
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value)}
                    className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-700"
                  >
                    <option value="Interested">Interested / Follow Up</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="No Answer">No Answer / Left Voicemail</option>
                    <option value="Invalid Number">Invalid Number</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-800 mb-1 block">Call Notes</label>
                  <textarea
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="What was discussed?"
                    rows={2}
                    className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-700 resize-none"
                  />
                </div>
                <button
                  onClick={handleLogCall}
                  disabled={isLoggingCall || !callNotes.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoggingCall ? 'Saving...' : 'Save Call Log'}
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('data')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'data' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Data
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'notes' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Notes
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'notes' ? 'bg-amber-100' : 'bg-slate-100 text-slate-500'}`}>{notes.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('emails')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'emails' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Inbox
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'emails' ? 'bg-indigo-100' : 'bg-slate-100 text-slate-500'}`}>{emailReplies.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'timeline' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Timeline
            </button>
          </div>

          {/* Email Inbox Tab */}
          {activeTab === 'emails' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-800">Email Replies</h3>
              </div>
              
              {emailReplies.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Mail className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-500">No replies received yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {emailReplies.map((reply) => (
                    <div key={reply.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{reply.fromEmail}</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              Re: {reply.subject || reply.messageSend?.subject || 'Unknown Subject'}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap bg-white px-2 py-1 rounded-md border border-slate-200">
                            {new Date(reply.receivedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {reply.messageSend?.campaign?.name && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                            <Send className="h-3 w-3" />
                            Campaign: {reply.messageSend.campaign.name}
                          </div>
                        )}
                      </div>
                      <div className="p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono bg-white">
                        {parseEmailBody(reply.body)}
                      </div>
                      <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-end">
                        <a 
                          href={`mailto:${reply.fromEmail}?subject=Re: ${encodeURIComponent(reply.subject || '')}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" /> Reply back
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="flex bg-slate-200/50 p-1 rounded-lg self-start inline-flex">
                <button
                  onClick={() => setDataView('sebi')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${dataView === 'sebi' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Sebi Data
                </button>
                <button
                  onClick={() => setDataView('scraped')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${dataView === 'scraped' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Scraped Data
                </button>
                <button
                  onClick={() => setDataView('all')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${dataView === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  All Data
                </button>
              </div>

              {dataView === 'sebi' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Email</p>
                      <p className="text-sm font-medium text-slate-900 truncate mt-0.5">{lead.email || '—'}</p>
                      {lead.email2 && <p className="text-sm font-medium text-slate-900 truncate mt-1">{lead.email2}</p>}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <PhoneIcon className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Phone</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.phone || '—'}</p>
                      {lead.phone2 && <p className="text-sm font-medium text-slate-900 mt-1">{lead.phone2}</p>}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Type</p>
                      <span className="inline-flex items-center mt-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        {lead.type?.includes('(') ? lead.type.split('(')[1].replace(')', '') : lead.type || 'Manual'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Source & Reg No.</p>
                      {lead.registrationNo && (
                        <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 mt-1 mb-1 ring-1 ring-inset ring-indigo-700/10">
                          {lead.registrationNo}
                        </span>
                      )}
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.source || 'Manual'}</p>
                    </div>
                  </div>

                  {(lead.address || lead.city) && (
                    <div className="flex items-start gap-3 col-span-1 sm:col-span-2">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Address</p>
                        <p className="text-sm font-medium text-slate-900 mt-0.5 leading-relaxed">{[lead.address, lead.city, lead.state, lead.pincode].filter(Boolean).join(', ')}</p>
                      </div>
                    </div>
                  )}

                  {lead.contactPerson && (
                    <div className="flex items-start gap-3">
                      <PhoneIcon className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Contact Person</p>
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.contactPerson}</p>
                      </div>
                    </div>
                  )}

                  {lead.validity && (
                    <div className="flex items-start gap-3">
                      <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Validity</p>
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.validity}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 col-span-1 sm:col-span-2">
                    <CheckCircle2 className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Lead Status & Segment</p>
                      <div className="flex items-center gap-3">
                        <select
                          value={lead.status || 'UNVERIFIED'}
                          onChange={(e) => updateStatus(e.target.value)}
                          disabled={isUpdatingStatus}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-primary disabled:opacity-50"
                        >
                          <option value="IMPORTED">Imported</option>
                          <option value="UNVERIFIED">Unverified</option>
                          <option value="NEW">New (Verified)</option>
                          <option value="CONTACTED">Contacted</option>
                          <option value="ENGAGED">Engaged</option>
                          <option value="QUALIFIED">Qualified</option>
                          <option value="NEGOTIATION">Negotiation</option>
                          <option value="WON">Client Won</option>
                          <option value="LOST">Client Lost</option>
                          <option value="INVALID">Invalid/Inactive</option>
                        </select>
                        {isUpdatingStatus && <span className="text-xs text-blue-600 animate-pulse">Updating...</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Lead Score</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs font-bold text-slate-700 w-5">{getLeadScore(lead)}</span>
                        <div className="h-1.5 w-full rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                            style={{ width: `${getLeadScore(lead)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Timeline</p>
                      <p className="text-[13px] font-medium text-slate-900 mt-0.5">Created: {formatDate(lead.createdAt)}</p>
                      {lead.updatedAt && <p className="text-[13px] font-medium text-slate-900 mt-0.5">Updated: {formatDate(lead.updatedAt)}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Enrichment Tab */}
              {dataView === 'scraped' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${lead.isEnriched ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                      {lead.isEnriched ? '✓ Data Enriched' : '⏳ Pending Enrichment'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6 bg-white rounded-xl p-5 border border-slate-200 shadow-sm">

                    {lead.website && (
                      <div className="flex items-start gap-3 col-span-1 sm:col-span-2">
                        <Globe className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Website</p>
                          <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline mt-0.5 break-all block">{lead.website}</a>
                        </div>
                      </div>
                    )}

                    {(lead as any).scrapedEmail && (
                      <div className="flex items-start gap-3">
                        <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Scraped Email</p>
                          <a href={`mailto:${(lead as any).scrapedEmail}`} className="text-sm font-medium text-blue-600 hover:underline mt-0.5 break-all block">{(lead as any).scrapedEmail}</a>
                        </div>
                      </div>
                    )}

                    {(lead as any).scrapedPhone && (
                      <div className="flex items-start gap-3">
                        <PhoneIcon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Scraped Phone</p>
                          <a href={`tel:${(lead as any).scrapedPhone}`} className="text-sm font-medium text-blue-600 hover:underline mt-0.5 block">{(lead as any).scrapedPhone}</a>
                        </div>
                      </div>
                    )}

                    {(lead.linkedin || lead.twitter || lead.facebook) && (
                      <div className="flex items-start gap-3">
                        <LinkIcon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Social Links</p>
                          <div className="mt-1.5 space-y-1.5">
                            {lead.linkedin && <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-700 hover:underline block">LinkedIn ↗</a>}
                            {lead.twitter && <a href={lead.twitter} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-400 hover:underline block">Twitter/X ↗</a>}
                            {lead.facebook && <a href={lead.facebook} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline block">Facebook ↗</a>}
                          </div>
                        </div>
                      </div>
                    )}

                    {lead.companySizeEstimate && lead.companySizeEstimate !== 'Unknown' && (
                      <div className="flex items-start gap-3">
                        <Briefcase className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Company Size</p>
                          <p className="text-sm font-medium text-slate-900 mt-0.5">{lead.companySizeEstimate}</p>
                        </div>
                      </div>
                    )}

                    {lead.sellsAlgoTrading && lead.sellsAlgoTrading !== 'Unknown' && (
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sells Algo Trading?</p>
                          <span className={`inline-flex items-center mt-1 rounded-md px-2 py-0.5 text-xs font-semibold ${lead.sellsAlgoTrading === 'Yes' ? 'bg-emerald-100 text-emerald-800' :
                            lead.sellsAlgoTrading === 'No' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>{lead.sellsAlgoTrading}</span>
                        </div>
                      </div>
                    )}

                    {lead.enrichmentNotes && (
                      <div className="flex items-start gap-3 col-span-1 sm:col-span-2">
                        <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${lead.enrichmentNotes.startsWith('[SCRAPE_FAILED]') ? 'text-red-500' : 'text-amber-500'}`} />
                        <div className={`min-w-0 flex-1 rounded-lg p-3 border ${lead.enrichmentNotes.startsWith('[SCRAPE_FAILED]') ? 'bg-red-50 border-red-100 text-red-900' : 'bg-amber-50 border-amber-100 text-amber-900'}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${lead.enrichmentNotes.startsWith('[SCRAPE_FAILED]') ? 'text-red-700' : 'text-amber-800'}`}>Enrichment Notes</p>
                          <p className="text-sm leading-relaxed break-words">{lead.enrichmentNotes.replace('[SCRAPE_FAILED] ', '')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* All Data Tab */}
              {dataView === 'all' && (
                <div className="space-y-6">
                  {(() => {
                    const categories = {
                      'Basic Information': ['id', 'name', 'type', 'source', 'registrationNo', 'contactPerson', 'companySizeEstimate', 'sellsAlgoTrading'],
                      'Contact Details': ['email', 'email2', 'phone', 'phone2', 'scrapedEmail', 'scrapedPhone'],
                      'Location & Address': ['address', 'city', 'state', 'pincode'],
                      'Social & Web': ['website', 'linkedin', 'twitter', 'facebook', 'logoUrl'],
                      'System & Status': ['status', 'engagementStatus', 'consentStatus', 'leadScore', 'validity', 'isEnriched', 'enrichmentNotes', 'createdAt', 'updatedAt']
                    };

                    const allKeys = Object.keys(lead);
                    const categorizedKeys = new Set(Object.values(categories).flat());
                    const otherKeys = allKeys.filter(k => !categorizedKeys.has(k) && lead[k as keyof typeof lead] !== null && lead[k as keyof typeof lead] !== undefined && lead[k as keyof typeof lead] !== '');

                    const renderField = (key: string, value: any) => {
                      if (value === null || value === undefined || value === '') return null;

                      let parsedValue = value;
                      if (key === 'otherListings' && typeof value === 'string') {
                        try {
                          parsedValue = JSON.parse(value);
                        } catch (e) {
                          // fallback to string if parsing fails
                        }
                      }

                      if (key === 'otherListings' && Array.isArray(parsedValue)) {
                        return (
                          <div key={key} className="col-span-1 sm:col-span-2 lg:col-span-3 flex flex-col gap-3 pt-4 border-t border-slate-200 mt-2">
                            <h4 className="text-sm font-bold text-slate-800">Other Web Listings</h4>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {parsedValue.map((item, index) => (
                                <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                                  {Object.entries(item).map(([k, v]) => {
                                    if (v === null || v === undefined || v === '') return null;
                                    return (
                                      <div key={k} className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <span className="text-[13px] font-medium text-slate-900 break-words leading-relaxed">
                                          {typeof v === 'object' ? JSON.stringify(v) : (
                                            k === 'url' ? <a href={String(v).startsWith('http') ? String(v) : `https://${v}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{String(v)}</a> : String(v)
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      const isLongText = ['servicesSummary', 'productsOffered', 'enrichmentNotes', 'otherListings', 'address'].includes(key) || (typeof value === 'string' && value.length > 100);

                      return (
                        <div key={key} className={`flex flex-col gap-1.5 p-4 border border-slate-200 rounded-xl bg-slate-50 shadow-sm transition-shadow hover:shadow-md ${isLongText ? 'col-span-1 sm:col-span-2 lg:col-span-3' : ''}`}>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <div className="text-[13px] font-medium text-slate-900 break-words leading-relaxed">
                            {typeof value === 'object' ? (
                              JSON.stringify(value)
                            ) : (key === 'createdAt' || key === 'updatedAt' || key.toLowerCase().endsWith('date')) && typeof value === 'string' ? (
                              formatDate(value)
                            ) : (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://') || key.toLowerCase().includes('url') || key.toLowerCase().includes('website') || key.toLowerCase().includes('linkedin') || key.toLowerCase().includes('facebook') || key.toLowerCase().includes('twitter'))) ? (
                              <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 group">
                                <span className="break-all">{value}</span>
                                <svg className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                            ) : (
                              String(value)
                            )}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        {Object.entries(categories).map(([catName, keys]) => {
                          const visibleFields = keys.map(k => ({ key: k, value: lead[k as keyof typeof lead] }))
                            .filter(f => f.value !== null && f.value !== undefined && f.value !== '');

                          if (visibleFields.length === 0) return null;

                          return (
                            <div key={catName} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                              <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">{catName}</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {visibleFields.map(f => renderField(f.key, f.value))}
                              </div>
                            </div>
                          );
                        })}

                        {otherKeys.length > 0 && (
                          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Other Data</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {otherKeys.map(k => renderField(k, lead[k as keyof typeof lead]))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

            </div>
          )}

          {/* Unified Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm font-medium text-slate-500">Loading timeline...</span>
                </div>
              ) : (() => {
                // Merge logs and emailLogs
                const merged = [
                  ...logs.map(log => ({ ...log, _type: 'activity', _date: new Date(log.createdAt).getTime() })),
                  ...emailLogs.map(msg => ({ ...msg, _type: 'email', _date: new Date(msg.sentAt || msg.createdAt).getTime() }))
                ].sort((a, b) => b._date - a._date);

                if (merged.length === 0) {
                  return <p className="text-sm text-slate-500 text-center py-8">No activity history found for this lead.</p>;
                }

                return (
                  <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-4">
                    {merged.map((item, idx) => {
                      if (item._type === 'activity') {
                        const log = item;
                        return (
                          <div key={`act-${log.id}-${idx}`} className="relative pl-6 group">
                            <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-2 border-primary group-hover:scale-125 transition-transform" />
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-slate-800">{log.action.replace(/_/g, ' ')}</span>
                              <span className="text-xs font-medium text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">{log.details}</p>
                            {log.changes && (
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mt-2 text-xs">
                                {Object.entries(JSON.parse(log.changes)).map(([field, vals]: any) => (
                                  <div key={field} className="flex items-center text-xs mb-1 last:mb-0">
                                    <span className="font-semibold text-slate-700 w-32 capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <span className="text-slate-500 bg-white border px-1.5 py-0.5 rounded mr-2 line-through">{vals.from}</span>
                                    <ArrowRight className="w-3 h-3 text-slate-400 mr-2" />
                                    <span className="text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded font-medium">{vals.to}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        const msg = item;
                        return (
                          <div key={`eml-${msg.id}-${idx}`} className="relative pl-6 group">
                            <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-2 border-emerald-500 group-hover:scale-125 transition-transform" />
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-slate-800">Email: {msg.subject || '(No Subject)'}</span>
                              <span className="text-xs font-medium text-slate-500">{new Date(msg.sentAt || msg.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">Campaign: {msg.campaign?.name}</p>
                            <div className="inline-flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${msg.status === 'REPLIED' ? 'bg-green-100 text-green-700' : msg.status === 'CLICKED' ? 'bg-purple-100 text-purple-700' : msg.status === 'OPENED' ? 'bg-emerald-100 text-emerald-700' : msg.status === 'DELIVERED' ? 'bg-cyan-100 text-cyan-700' : msg.status === 'QUEUED' || msg.status === 'SENT' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                {msg.status}
                              </span>
                              {msg.openedAt && <span className="text-[10px] text-slate-500">👁️ Opened: {new Date(msg.openedAt).toLocaleTimeString()}</span>}
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-slate-200 bg-white p-4 flex items-center justify-end gap-3 z-10">
          <button
            onClick={() => {
              onClose();
              onEdit(lead);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
            Edit Lead
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-primary text-white px-6 py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
          >
            Close
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
