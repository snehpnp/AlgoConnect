import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Megaphone, 
  Settings as SettingsIcon, 
  LogOut,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  allowedRoles: UserRole[];
}

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const menuItems: SidebarItem[] = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
      allowedRoles: ['admin', 'manager'],
    },
    {
      name: 'Lead Management',
      path: '/leads',
      icon: <Users className="h-5 w-5" />,
      allowedRoles: ['admin', 'manager', 'agent'],
    },
    {
      name: 'Campaigns',
      path: '/campaigns',
      icon: <Megaphone className="h-5 w-5" />,
      allowedRoles: ['admin', 'manager'],
    },
    {
      name: 'Admin Settings',
      path: '/settings',
      icon: <SettingsIcon className="h-5 w-5" />,
      allowedRoles: ['admin'],
    },
  ];

  // Filter items based on user role
  const visibleItems = menuItems.filter(item => item.allowedRoles.includes(user.role));

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[280px] flex-col border-r border-slate-800 bg-[#0F172A] text-slate-400">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
        <TrendingUp className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold tracking-tight text-white">AlgoConnect</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 px-4 py-6">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3.5 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Info & Footer */}
      <div className="border-t border-slate-800 p-4">
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-900/60 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
            {user.role === 'admin' ? (
              <ShieldCheck className="h-5 w-5" />
            ) : user.role === 'manager' ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <Users className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-200">{user.name}</p>
            <p className="truncate text-xs text-slate-500 capitalize">{user.role}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3.5 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-red-950/30 hover:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
