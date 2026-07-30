import { useState } from "react";
import { Outlet } from "react-router";
import { Header } from "@/app/components/Header";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { PWAInstall } from "@/app/components/PWAInstall";
import { useTheme } from "@/app/context/ThemeContext";

export function AdminLayout() {
  const { darkMode, toggleDarkMode } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const mainBg = darkMode ? "bg-[#09090B]" : "bg-slate-50";

  return (
    <div className={`min-h-screen flex flex-col ${mainBg} transition-colors duration-300`}>
      <Header darkMode={darkMode} toggleDarkMode={toggleDarkMode} onMenuToggle={() => setSidebarOpen((p) => !p)} />

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar darkMode={darkMode} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">
            <Outlet />
            <footer className={`text-center text-xs pb-4 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              © 2026 Creator Zone Admin. All Rights Reserved.
            </footer>
          </div>
        </main>
      </div>

      <PWAInstall darkMode={darkMode} />
    </div>
  );
}
