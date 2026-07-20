import React, { useEffect, useState } from 'react';
import { Users, Search, Edit, Trash2, X, Shield, Mail, Calendar, Loader2, AlertCircle, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';

interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  roleId: number;
  role: { id: number; name: string };
  createdAt: string;
}

const AdminUsers = () => {

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT'>('ADD');

  // Form state
  const [formData, setFormData] = useState({ id: 0, name: '', email: '', password: '', roleId: '' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const fetchUsers = async () => {
    try {
      const response = await apiClient.get(`/users`);
      setUsers(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiClient.get(`/users/roles`);
      setRoles(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch roles');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    setLoading(false);
  }, []);

  const openAddModal = () => {
    setModalMode('ADD');
    setFormData({ id: 0, name: '', email: '', password: '', roleId: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setModalMode('EDIT');
    setFormData({ id: user.id, name: user.name, email: user.email, password: '', roleId: user.role?.id?.toString() || '' });
    setFormError('');
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (modalMode === 'ADD') {
        await apiClient.post(`/users`, formData);
        toast.success('User added successfully');
      } else {
        await apiClient.put(`/users/${formData.id}`, formData);
        toast.success('User updated successfully');
      }
      await fetchUsers();
      setShowModal(false);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Something went wrong';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await apiClient.delete(`/users/${userToDelete.id}`);
      toast.success('User deleted successfully');
      await fetchUsers();
      setShowDeleteModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error deleting user');
    }
  };

  // Filter out System Admins from display and apply search & role filters
  const filteredUsers = users.filter(user => {
    if (user.role?.name === 'System Admin') return false; // Hide System Admin entirely
    if (roleFilter !== 'All' && user.role?.name !== roleFilter) return false;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    );
  });

  // Filter out System Admin from roles dropdown
  const selectableRoles = roles.filter(role => role.name !== 'System Admin');

  return (
    <div className="flex flex-col gap-6 pb-12 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2 sm:gap-3">
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            User Management
          </h1>
          <p className="text-[#64748B] text-xs sm:text-sm mt-1">
            Add, edit, or remove staff members and assign their roles.
          </p>
        </div>
        <button 
          onClick={openAddModal} 
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-blue-600 transition-colors"
        >
          + Add New User
        </button>
      </div>

      {/* Main Content Area */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {/* Filters Toolbar */}
        <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm bg-white focus:outline-none focus:border-primary transition-colors" 
            />
          </div>

          <div className="relative w-full sm:w-64 flex items-center gap-3">
            <Filter className="h-4 w-4 text-[#64748B] shrink-0" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm bg-white font-medium text-slate-700 focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="All">All Roles</option>
              {selectableRoles.map(role => (
                <option key={role.id} value={role.name}>{role.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-[#F8FAFC] text-xs font-bold uppercase text-[#64748B] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-6 py-4">S No.</th>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-[#64748B] font-medium">Loading users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-4">
                      <AlertCircle className="w-7 h-7" />
                    </div>
                    <p className="font-bold text-[#0F172A]">No users found</p>
                    <p className="text-xs text-[#64748B] mt-1">Adjust your filters or add a new user.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-[#0F172A]">{index + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#0F172A]">{user.name}</span>
                        <span className="flex items-center gap-1.5 text-xs text-[#64748B] mt-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        <Shield className="h-3 w-3 text-slate-500" />
                        {user.role?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#64748B]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(user)} 
                          className="p-2 text-[#64748B] hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setUserToDelete(user); setShowDeleteModal(true); }} 
                          className="p-2 text-[#64748B] hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                          title="Delete User"
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-[#E2E8F0]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <h3 className="font-bold text-[#0F172A] text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {modalMode === 'ADD' ? 'Add New User' : 'Edit User'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#64748B] hover:bg-white p-1 rounded-md hover:text-[#0F172A] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6">
              {formError && (
                <div className="mb-5 p-3 bg-red-50 border border-red-100 text-red-700 text-sm font-medium rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Full Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 sm:py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-primary focus:bg-white transition-colors" placeholder="e.g. Jane Doe" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Email Address</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 sm:py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-primary focus:bg-white transition-colors" placeholder="jane@algoconnect.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                    {modalMode === 'ADD' ? 'Password' : 'New Password (Optional)'}
                  </label>
                  <input required={modalMode === 'ADD'} type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-3 sm:py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-primary focus:bg-white transition-colors" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Assign Role</label>
                  <select required value={formData.roleId} onChange={e => setFormData({ ...formData, roleId: e.target.value })} className="w-full px-4 py-3 sm:py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:border-primary focus:bg-white transition-colors cursor-pointer">
                    <option value="" disabled>Select a role...</option>
                    {selectableRoles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-[#E2E8F0] bg-white hover:bg-slate-50 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-blue-600 rounded-lg disabled:opacity-50 inline-flex items-center gap-2 transition-colors">
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {formLoading ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center border border-[#E2E8F0]" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#0F172A] mb-2">Remove User</h3>
            <p className="text-[#64748B] text-sm mb-6">
              Are you sure you want to permanently delete <strong>{userToDelete?.name}</strong>? They will immediately lose access to the system.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} className="w-full px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                Yes, Delete User
              </button>
              <button onClick={() => setShowDeleteModal(false)} className="w-full px-4 py-2.5 text-sm font-bold text-slate-700 bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
