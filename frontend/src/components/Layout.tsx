import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#F1F5F9] font-sans selection:bg-primary/20">
      <Sidebar />
      <div className="pl-[280px] flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 pt-16 relative">
          {/* Subtle background decoration */}
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#E2E8F0]/50 to-transparent -z-10"></div>
          
          <div className="p-8 max-w-[1600px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
