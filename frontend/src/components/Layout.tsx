import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatBot } from './ChatBot';

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen w-full font-sans selection:bg-blue-500/20 overflow-x-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
      />
      {/* On mobile: no left padding (sidebar is drawer). On lg+: sidebar width offset */}
      <div className={`${isSidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[240px]'} flex flex-col min-h-screen transition-all duration-300 overflow-x-hidden`}>
        <Header setIsSidebarOpen={setIsSidebarOpen} isSidebarCollapsed={isSidebarCollapsed} />
        <main className="flex-1 pt-16 relative w-full overflow-x-hidden">
          {/* Subtle background decoration */}
          {/* Removed subtle background decoration as body has global gradient */}
          
          <div className="p-3 sm:p-5 md:p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatBot />
    </div>
  );
};
