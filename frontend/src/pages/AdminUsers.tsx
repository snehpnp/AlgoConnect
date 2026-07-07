import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Search, Edit, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

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
  const token = localStorage.getItem('algoconnect_token');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

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

  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:7700/api/users', axiosConfig);
      setUsers(response.data.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await axios.get('http://localhost:7700/api/users/roles', axiosConfig);
      setRoles(response.data.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchRoles();
      setLoading(false);
    }
  }, [token]);

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
        await axios.post('http://localhost:7700/api/users', formData, axiosConfig);
        toast.success('User added successfully');
      } else {
        await axios.put(`http://localhost:7700/api/users/${formData.id}`, formData, axiosConfig);
        toast.success('User updated successfully');
      }
      await fetchUsers();
      setShowModal(false);
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Something went wrong');
      toast.error(error.response?.data?.message || 'Something went wrong');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await axios.delete(`http://localhost:7700/api/users/${userToDelete.id}`, axiosConfig);
      toast.success('User deleted successfully');
      await fetchUsers();
      setShowDeleteModal(false);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.message || 'Error deleting user');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-8 h-8 text-blue-600" />
              User Management
            </h1>
            <p className="text-gray-500 mt-1">Add, edit or remove system users.</p>
          </div>
          <button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors">
            + Add New User
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="relative w-72">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Search users..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase">S No.</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Joined</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No users found.</td></tr>
                ) : (
                  users.map((user, index) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-gray-900">{index + 1}</td>
                      <td className="py-4 px-6 font-medium text-gray-900">{user.name}</td>
                      <td className="py-4 px-6 text-gray-500">{user.email}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium 
                          ${user.role?.name === 'System Admin' ? 'bg-purple-100 text-purple-700' :
                            user.role?.name === 'Growth Operator' ? 'bg-blue-100 text-blue-700' :
                              user.role?.name === 'Compliance Admin' ? 'bg-amber-100 text-amber-700' :
                                'bg-green-100 text-green-700'}`}>
                          {user.role?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="py-4 px-6 text-right">
                        <button onClick={() => openEditModal(user)} className="text-gray-400 hover:text-blue-600 p-1 rounded">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setUserToDelete(user); setShowDeleteModal(true); }} className="text-gray-400 hover:text-red-600 p-1 rounded ml-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h3 className="font-semibold text-lg">{modalMode === 'ADD' ? 'Add New User' : 'Edit User'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-5">
              {formError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{formError}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {modalMode === 'ADD' ? 'Password' : 'New Password (Optional)'}
                  </label>
                  <input required={modalMode === 'ADD'} type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select required value={formData.roleId} onChange={e => setFormData({ ...formData, roleId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="" disabled>Select a role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                  {formLoading ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete User?</h3>
            <p className="text-gray-500 text-sm mb-6">Are you sure you want to delete <b>{userToDelete?.name}</b>? This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg w-full">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg w-full">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
