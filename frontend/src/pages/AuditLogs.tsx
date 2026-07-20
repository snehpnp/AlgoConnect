import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Search, Loader2, Calendar, 
  ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import toast from 'react-hot-toast';

export const AuditLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [filterOptions, setFilterOptions] = useState({ users: [], actions: [] });

  const fetchFilters = async () => {
    try {
      const res = await apiClient.get('/audit-logs/filters');
      setFilterOptions(res.data.data);
    } catch (err) {
      console.error('Failed to load filters', err);
    }
  };

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      if (actionFilter !== 'All') params.action = actionFilter;
      if (userFilter !== 'All') params.userId = userFilter;
      if (dateRange.start && dateRange.end) {
        params.startDate = dateRange.start;
        params.endDate = dateRange.end;
      }
      
      const res = await apiClient.get('/audit-logs', { params });
      setLogs(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setTotalRecords(res.data.pagination.total);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, actionFilter, userFilter, dateRange]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handle pagination reset on filter change
  const handleFilterChange = () => setPage(1);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-500" />
            System Audit Logs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Track every change and action performed in the CRM.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg px-4 py-2"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-4 w-full sm:w-auto overflow-x-auto">
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); handleFilterChange(); }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Actions</option>
              {filterOptions.actions.map((action: string) => (
                <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); handleFilterChange(); }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Users</option>
              {filterOptions.users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => { setDateRange({ ...dateRange, start: e.target.value }); handleFilterChange(); }}
                className="bg-transparent text-sm focus:outline-none"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => { setDateRange({ ...dateRange, end: e.target.value }); handleFilterChange(); }}
                className="bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-700">Timestamp</th>
                <th className="px-6 py-4 font-bold text-slate-700">User</th>
                <th className="px-6 py-4 font-bold text-slate-700">Action</th>
                <th className="px-6 py-4 font-bold text-slate-700">Details</th>
                <th className="px-6 py-4 font-bold text-slate-700">Related Lead</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500 font-medium">
                    No logs found matching your filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {log.user ? (
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
                            {log.user.name.charAt(0)}
                          </div>
                          {log.user.name}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-700 max-w-xs truncate" title={log.details || ''}>
                        {log.details || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {log.lead ? (
                        <span className="text-indigo-600 font-bold hover:underline cursor-pointer">
                          {log.lead.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, totalRecords)} of {totalRecords} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded-md border border-slate-300 bg-white text-slate-500 disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded-md border border-slate-300 bg-white text-slate-500 disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
