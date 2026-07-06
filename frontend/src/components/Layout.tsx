import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      <Sidebar />
      <div className="pl-[280px]">
        <Header />
        <main className="min-h-[calc(100vh-64px)] pt-16">
          <div className="p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
