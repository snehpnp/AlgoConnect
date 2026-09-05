import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Bell,
  User as UserIcon,
  LogOut,
  Settings,
  Menu,
  Mail,
  UserPlus,
  RefreshCw,
  Info
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

interface HeaderProps {
  setIsSidebarOpen: (val: boolean) => void;
  isSidebarCollapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ setIsSidebarOpen, isSidebarCollapsed }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationOpen && notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
      if (dropdownOpen && userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationOpen, dropdownOpen]);

  if (!user) return null;

  return (
    <header className={`fixed top-0 right-0 left-0 ${isSidebarCollapsed ? 'lg:left-[80px]' : 'lg:left-[240px]'} z-30 flex h-14 sm:h-16 items-center justify-between border-b border-white/60 bg-white/70 backdrop-blur-xl px-3 sm:px-6 shadow-sm transition-all duration-300`}>
      <div className="flex items-center gap-2 sm:gap-6 flex-1 min-w-0">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="h-6 w-6" />
        </button>
        {/* Mobile Brand Logo */}
        <div className="flex lg:hidden items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 4L6 40H14L24 18L34 40H42L24 4Z" fill="url(#headerGrad1)" />
            <circle cx="17" cy="30" r="3" fill="#2563EB" />
            <circle cx="31" cy="30" r="3" fill="#1D4ED8" />
            <line x1="20" y1="30" x2="28" y2="30" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="headerGrad1" x1="6" y1="4" x2="42" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#60A5FA" />
                <stop offset="1" stopColor="#1D4ED8" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-[15px] font-extrabold tracking-tight">
            <span className="text-[#0F172A]">Algo</span>
            <span className="text-blue-600">Connect</span>
          </span>
        </div>
        {/* Dynamic Breadcrumb based on path */}
        <div className="hidden sm:flex items-center text-sm font-semibold capitalize text-[#0F172A]">
          <span className="text-[#64748B]">Home</span>
          <span className="mx-2 text-[#CBD5E1]">/</span>
          <span>{location.pathname === '/' ? 'Dashboard' : location.pathname.split('/')[1]}</span>
        </div>


      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 sm:gap-5 shrink-0">
        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => {
              setNotificationOpen(!notificationOpen);
              setDropdownOpen(false); // close user menu if open
            }}
            className={`relative rounded-xl p-2.5 transition-all duration-200 ${notificationOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
          >
            <Bell className={`h-5 w-5 ${notificationOpen ? 'fill-blue-100' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotificationOpen(false)} />
              <div 
                className="fixed right-3 top-[4rem] w-[calc(100vw-1.5rem)] max-w-[350px] sm:absolute sm:top-auto sm:w-[350px] sm:right-0 sm:-right-4 sm:mt-3 origin-top-right rounded-2xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-white/50 bg-slate-50/50 px-4 py-3">
                  <h3 className="font-bold text-slate-800">Notifications {unreadCount > 0 && `(${unreadCount})`}</h3>
                  <div className="flex gap-3">
                    <button onClick={() => markAllAsRead()} className="text-xs font-semibold text-primary hover:text-blue-700 transition-colors">
                      Mark all read
                    </button>
                    <button onClick={() => clearAll()} className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">No notifications yet.</div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id}
                        onClick={() => {
                          if (!notif.isRead) markAsRead(notif.id);
                          if (notif.relatedEntity === 'Lead' && notif.relatedEntityId) {
                            navigate(`/leads/${notif.relatedEntityId}`);
                            setNotificationOpen(false);
                          }
                        }}
                        className={`flex gap-3 border-b border-slate-100 p-4 hover:bg-slate-50 transition-colors cursor-pointer ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          notif.type.includes('EMAIL') ? 'bg-amber-100 text-amber-600' : 
                          notif.type.includes('LEAD_CREATED') ? 'bg-blue-100 text-blue-600' :
                          notif.type.includes('STATUS') ? 'bg-emerald-100 text-emerald-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {notif.type.includes('EMAIL') ? <Mail className="h-4 w-4" /> : 
                           notif.type.includes('LEAD_CREATED') ? <UserPlus className="h-4 w-4" /> :
                           notif.type.includes('STATUS') ? <RefreshCw className="h-4 w-4" /> :
                           <Info className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${!notif.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{notif.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-wide">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-white/50 p-2 bg-slate-50/50">
                  <button className="w-full rounded-xl py-2 text-center text-sm font-bold text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 transition-colors">
                    View all notifications
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Dropdown */}
        <div className="relative" id="user-menu" ref={userMenuRef}>
          <button
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setNotificationOpen(false); // close notifications if open
            }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none min-h-[44px] min-w-[44px] justify-center"
            aria-label="User menu"
          >
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-base font-bold overflow-hidden border-2 border-white shadow-md ring-1 ring-slate-200">
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name} className="h-full w-full object-cover" />
              ) : (
                user?.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
          </button>

          {dropdownOpen && (
            <>
              {/* Overlay for closing on outside click */}
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              {/* Dropdown panel */}
              <div className="fixed right-3 top-[4rem] w-[calc(100vw-1.5rem)] max-w-[240px] sm:absolute sm:top-auto sm:right-0 sm:w-56 sm:mt-2 origin-top-right rounded-2xl bg-white border border-slate-200 p-2 shadow-xl z-20">
                <div className="border-b border-slate-200/50 px-3.5 py-2.5">
                  <p className="text-xs text-slate-500">Signed in as</p>
                  <p className="truncate text-sm font-medium text-slate-800">{user.email}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/profile');
                    }}
                    className="flex w-full items-center gap-2.5 hover:bg-blue-50/50 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 hover:text-blue-700 min-h-[44px] transition-colors"
                  >
                    <UserIcon className="h-4 w-4 shrink-0" />
                    <span>My Profile</span>
                  </button>
                  {user.role === 'System Admin' && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate('/settings/integrations');
                      }}
                      className="flex w-full items-center gap-2.5 hover:bg-blue-50/50 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 hover:text-blue-700 min-h-[44px] transition-colors"
                    >
                      <Settings className="h-4 w-4 shrink-0" />
                      <span>Integrations</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-200/50 pt-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm text-red-600 hover:bg-red-50/80 transition-colors min-h-[44px]"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
