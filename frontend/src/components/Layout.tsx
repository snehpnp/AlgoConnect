import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#F1F5F9] font-sans selection:bg-primary/20">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="lg:pl-[280px] flex flex-col min-h-screen transition-all duration-300">
        <Header setIsSidebarOpen={setIsSidebarOpen} />
        <main className="flex-1 pt-16 relative w-full overflow-x-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#E2E8F0]/50 to-transparent -z-10"></div>
          
          <div className="p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
