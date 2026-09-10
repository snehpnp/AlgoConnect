import React, { useState } from 'react';
import type { Lead } from '../services/leads.service';
import { Clock, Phone, MapPin } from 'lucide-react';

interface LeadsBoardProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onUpdateStage: (leadId: number, newStage: string) => Promise<void>;
}

const STAGES = [
  'New',
  'Contacted',
  'Qualified',
  'Follow-up',
  'Negotiation',
  'Client Won',
  'Client Lost',
  'Do Not Contact'
];

export const LeadsBoard: React.FC<LeadsBoardProps> = ({ leads, onLeadClick, onUpdateStage }) => {
  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires some data to be set
    e.dataTransfer.setData('text/plain', leadId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    if (draggedLeadId === null) return;

    const lead = leads.find(l => l.id === draggedLeadId);
    if (lead && lead.salesStage !== targetStage) {
      await onUpdateStage(draggedLeadId, targetStage);
    }
    setDraggedLeadId(null);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Client Won': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Client Lost':
      case 'Do Not Contact': return 'bg-red-100 text-red-800 border-red-200';
      case 'Negotiation': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Contacted':
      case 'Follow-up': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Qualified': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)] items-start">
      {STAGES.map(stage => {
        const stageLeads = leads.filter(l => (l.salesStage || 'New') === stage);
        
        return (
          <div 
            key={stage}
            className="flex-shrink-0 w-80 flex flex-col bg-slate-50/50 rounded-xl border border-slate-200 h-full max-h-full"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage)}
          >
            {/* Column Header */}
            <div className={`px-4 py-3 border-b rounded-t-xl font-bold flex justify-between items-center ${getStageColor(stage)}`}>
              <span>{stage}</span>
              <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs">{stageLeads.length}</span>
            </div>

            {/* Column Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {stageLeads.map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onClick={() => onLeadClick(lead)}
                  className={`bg-white p-3 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-md transition-all ${draggedLeadId === lead.id ? 'opacity-50 border-primary border-dashed' : 'border-slate-200'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{lead.name}</h4>
                    {lead.user ? (
                      <div title={`Assigned to ${lead.user.name}`} className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 shrink-0">
                        {lead.user.name.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div title="Unassigned" className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 shrink-0">
                        ?
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 mb-3">
                    {(lead.email || lead.email2) && (
                      <p className="text-xs text-slate-500 truncate">{lead.email || lead.email2}</p>
                    )}
                    {(lead.phone || lead.phone2) && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone className="h-3 w-3" />
                        <span>{lead.phone || lead.phone2}</span>
                      </div>
                    )}
                    {lead.city && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{lead.city}{lead.state ? `, ${lead.state}` : ''}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {lead.type?.includes('(') ? lead.type.split('(')[1].replace(')', '') : lead.type || 'Manual'}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {new Date(lead.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
