import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  ShieldCheck,
  BookOpen,
  Target,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MessageSquare
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
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, isCollapsed, setIsCollapsed }) => {
  const { user } = useAuth();
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
      name: 'Message Templates',
      path: '/templates',
      icon: <MessageSquare className="h-5 w-5" />,
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

      <aside className={`fixed inset-y-0 left-0 z-40 flex ${isCollapsed ? 'w-[80px]' : 'w-[280px]'} flex-col border-r border-slate-800/60 bg-gradient-to-b from-[#0F172A] to-[#0B1121] text-slate-400 shadow-xl transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand Header */}
        <div className={`flex h-16 items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-6'} border-b border-slate-800/50 backdrop-blur-sm bg-[#0F172A]/50 transition-all duration-300`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-600 shadow-lg shadow-primary/20">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-xl font-extrabold tracking-tight text-white whitespace-nowrap overflow-hidden">
              AlgoConnect
            </span>
          )}
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
                title={isCollapsed ? item.name : undefined}
                className={`group flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3.5 px-4'} rounded-xl py-3 text-sm font-semibold transition-all duration-300 ${isActive
                  ? 'bg-gradient-to-r from-primary/90 to-blue-600/90 text-white shadow-lg shadow-primary/25 border border-primary/20'
                  : 'hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1'
                  }`}
              >
                <div className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} transition-colors shrink-0`}>
                  {item.icon}
                </div>
                {!isCollapsed && (
                  <span className="tracking-wide whitespace-nowrap">{item.name}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Toggle Collapse Button (Desktop Only) */}
        <div className="hidden lg:flex border-t border-slate-800/50 p-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`flex w-full items-center ${isCollapsed ? 'justify-center' : 'justify-end'} text-slate-500 hover:text-slate-300 transition-colors`}
          >
            <div className="rounded-lg bg-slate-800/50 p-2 hover:bg-slate-700/50 transition-colors">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </div>
          </button>
        </div>
      </aside>
    </>
  );
};
