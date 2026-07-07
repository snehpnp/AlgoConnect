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
  TrendingUp,
  BookOpen,
  Target
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
      allowedRoles: ['System Admin', 'Growth Operator', 'Compliance Admin'],
    },
    {
      name: 'User Management',
      path: '/admin/users',
      icon: <Users className="h-5 w-5" />,
      allowedRoles: ['System Admin'],
    },
    {
      name: 'Lead Management',
      path: '/leads',
      icon: <Users className="h-5 w-5" />,
      allowedRoles: ['System Admin', 'Growth Operator', 'Compliance Admin', 'Sales Rep'],
    },
    {
      name: 'Campaigns',
      path: '/campaigns',
      icon: <Megaphone className="h-5 w-5" />,
      allowedRoles: ['System Admin', 'Growth Operator', 'Compliance Admin'],
    },

    {
      name: 'Segments',
      path: '/segments',
      icon: <Target className="h-5 w-5" />,
      allowedRoles: ['System Admin', 'Growth Operator', 'Compliance Admin'],
    },
    {
      name: 'Consent',
      path: '/consent',
      icon: <ShieldCheck className="h-5 w-5" />,
      allowedRoles: ['System Admin', 'Growth Operator', 'Compliance Admin'],
    },
    {
      name: 'Dictionary',
      path: '/dictionary',
      icon: <BookOpen className="h-5 w-5" />,
      allowedRoles: ['System Admin', 'Growth Operator', 'Compliance Admin', 'Sales Rep'],
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
              className={`flex items-center gap-3.5 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${isActive
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


    </aside>
  );
};
