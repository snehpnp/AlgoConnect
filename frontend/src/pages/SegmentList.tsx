import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, Search, Trash2, Loader2, AlertCircle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Segment } from '../services/segment.service';
import { segmentService } from '../services/segment.service';

export const SegmentList = () => {
  const navigate = useNavigate();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSegments = async () => {
    setIsLoading(true);
    try {
      const data = await segmentService.getSegments();
      setSegments(data);
    } catch (err) {
      toast.error('Failed to load segments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the segment "${name}"?`)) return;
    try {
      await segmentService.deleteSegment(id);
      toast.success('Segment deleted');
      fetchSegments();
    } catch (err) {
      toast.error('Failed to delete segment');
    }
  };

  const filteredSegments = segments.filter(seg => 
    seg.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2">
            <Target className="h-7 w-7 text-primary" />
            Segments
          </h1>
          <p className="text-sm text-[#64748B]">
            Manage targeted groups of leads for your campaigns.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search segments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-4 pl-9 text-sm outline-none transition-all focus:border-primary focus:bg-white"
            />
          </div>
          <button
            onClick={() => navigate('/segments/create')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 hover:bg-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Segment
          </button>
        </div>
      </div>

      {/* Segments Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium mt-3">Loading segments...</p>
        </div>
      ) : filteredSegments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 rounded-xl border border-[#E2E8F0] bg-white text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">No segments found</p>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery ? "Try adjusting your search." : "Create your first segment to start targeting leads."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSegments.map((segment) => (
            <div key={segment.id} className="flex flex-col rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-[#0F172A] truncate" title={segment.name}>
                    {segment.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-[#64748B]">
                    <Calendar className="h-3 w-3" />
                    {new Date(segment.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(segment.id, segment.name)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Delete Segment"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {segment.description && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {segment.description}
                </p>
              )}

              <div className="mt-auto pt-4 border-t border-[#E2E8F0]">
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Rules Applied</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(segment.rules).map(([key, value]) => {
                    // Filter out null/undefined or 'All' just in case
                    if (!value || value === 'All') return null;
                    return (
                      <span key={key} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                        <span className="capitalize text-slate-500 mr-1">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> 
                        {value}
                      </span>
                    );
                  })}
                  {(!segment.rules || Object.keys(segment.rules).length === 0) && (
                    <span className="text-xs text-slate-400 italic">No specific rules (All Leads)</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
