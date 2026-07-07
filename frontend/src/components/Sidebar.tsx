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

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
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
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-slate-800/60 bg-gradient-to-b from-[#0F172A] to-[#0B1121] text-slate-400 shadow-xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800/50 px-6 backdrop-blur-sm bg-[#0F172A]/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-600 shadow-lg shadow-primary/20">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">AlgoConnect</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto custom-scrollbar">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`group flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${isActive
                  ? 'bg-gradient-to-r from-primary/90 to-blue-600/90 text-white shadow-lg shadow-primary/25 border border-primary/20'
                  : 'hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1'
                  }`}
              >
                <div className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} transition-colors`}>
                  {item.icon}
                </div>
                <span className="tracking-wide">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>


      </aside>
    </>
  );
};
