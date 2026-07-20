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
  MessageSquare,
  Activity
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
      name: 'Users',
      path: '/admin/users',
      icon: <Users className="h-5 w-5" />,
      allowedRoles: ['System Admin'],
    },
    {
      name: 'Leads',
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
      name: 'Msg Templates',
      path: '/templates',
      icon: <MessageSquare className="h-5 w-5" />,
      allowedRoles: ['System Admin', 'Growth Operator', 'Compliance Admin'],
    },
    {
      name: 'Reports',
      path: '/reports',
      icon: <Activity className="h-5 w-5" />,
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

      <aside className={`fixed inset-y-0 left-0 z-40 flex ${isCollapsed ? 'w-[80px]' : 'w-[240px]'} flex-col border-r border-slate-800 bg-[#0F172A] text-slate-300 shadow-xl transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand Header */}
        <div className={`flex h-16 items-center border-b border-slate-800 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'justify-start px-5 gap-3'}`}>
          {/* Logo Mark - Always visible */}
          <div className="shrink-0 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4L6 40H14L24 18L34 40H42L24 4Z" fill="url(#sidebarGrad1)" />
              <circle cx="17" cy="30" r="3" fill="#2563EB" />
              <circle cx="31" cy="30" r="3" fill="#1D4ED8" />
              <line x1="20" y1="30" x2="28" y2="30" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="sidebarGrad1" x1="6" y1="4" x2="42" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#60A5FA" />
                  <stop offset="1" stopColor="#1D4ED8" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Wordmark - only visible when expanded */}
          {!isCollapsed && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-[18px] font-extrabold tracking-tight whitespace-nowrap">
                <span className="text-white">Algo</span>
                <span className="text-blue-500">Connect</span>
              </span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">
                Sales Platform
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 px-3 py-6 overflow-y-auto custom-scrollbar">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                title={isCollapsed ? item.name : undefined}
                className={`group flex items-center ${isCollapsed ? 'justify-center mx-2' : 'gap-3.5 mx-3 px-4'} rounded-xl py-2.5 text-sm font-semibold transition-all duration-300 relative overflow-hidden ${isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
              >
                <div className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'} transition-colors shrink-0 z-10`}>
                  {item.icon}
                </div>
                {!isCollapsed && (
                  <span className="tracking-wide whitespace-nowrap z-10">{item.name}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Toggle Collapse Button (Desktop Only) */}
        <div className="hidden lg:flex border-t border-slate-800 p-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`flex w-full items-center ${isCollapsed ? 'justify-center' : 'justify-end'} text-slate-500 hover:text-slate-300 transition-colors`}
          >
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-2 hover:bg-slate-700 hover:border-slate-600 transition-all">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </div>
          </button>
        </div>
      </aside>
    </>
  );
};
