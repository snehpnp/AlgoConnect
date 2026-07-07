import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, 
  Search, 
  ChevronDown, 
  User as UserIcon, 
  LogOut,
  Settings
} from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!user) return null;

  return (
    <header className="fixed top-0 right-0 left-[280px] z-10 flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white px-8">
      {/* Search Input */}
      <div className="relative w-80">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4.5 w-4.5 text-[#64748B]" />
        </span>
        <input
          type="text"
          placeholder="Search leads, campaigns, settings..."
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-4 pl-10 text-sm outline-none transition-all duration-200 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>

        {/* User Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3.5 rounded-lg p-1.5 text-left hover:bg-[#F8FAFC] transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2E8F0] text-[#0F172A] font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold leading-none text-[#0F172A]">{user.name}</p>
              <p className="mt-1 text-xs text-[#64748B] capitalize">{user.role} Account</p>
            </div>
            <ChevronDown className="h-4 w-4 text-[#64748B]" />
          </button>

          {dropdownOpen && (
            <>
              {/* Overlay to close on click outside */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setDropdownOpen(false)}
              ></div>
              
              <div className="absolute right-0 mt-2.5 w-56 origin-top-right rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-lg ring-1 ring-black/5 z-20">
                <div className="border-b border-[#E2E8F0] px-3.5 py-2.5">
                  <p className="text-xs text-[#64748B]">Signed in as</p>
                  <p className="truncate text-sm font-medium text-[#0F172A]">{user.email}</p>
                </div>
                
                <div className="py-1">
                  <button 
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/profile');
                    }}
                    className="flex w-full items-center gap-2.5 hover:bg-[#F8FAFC] rounded-lg px-3.5 py-2 text-sm text-[#0F172A]"
                  >
                    <UserIcon className="h-4.5 w-4.5" />
                    <span>My Profile</span>
                  </button>
                  {user.role === 'System Admin' && (
                    <button 
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate('/settings/integrations');
                      }}
                      className="flex w-full items-center gap-2.5 hover:bg-[#F8FAFC] rounded-lg px-3.5 py-2 text-sm text-[#0F172A]"
                    >
                      <Settings className="h-4.5 w-4.5" />
                      <span>Integrations</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-sm text-[#0F172A] cursor-not-allowed opacity-60">
                    <Settings className="h-4.5 w-4.5" />
                    <span>Account Settings</span>
                  </div>
                </div>
                
                <div className="border-t border-[#E2E8F0] pt-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4.5 w-4.5" />
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
