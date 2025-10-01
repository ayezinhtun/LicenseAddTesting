import React, {useState} from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [sidebarHidden, setSidebarHidden] = useState(false);

  const mainMarginClass = sidebarHidden
    ? 'ml-0'
    : sidebarCollapsed
      ? 'ml-20'
      : 'ml-72';

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
      isCollapsed={sidebarCollapsed}
      onToggle={() => setSidebarCollapsed(v => !v)}
      // optional hide support
      isHidden={sidebarHidden}
      onHideToggle={() => setSidebarHidden(v => !v)}
      />
      <motion.main
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={`flex-1 ${mainMarginClass} overflow-auto transition-[margin] duration-300`}
      >
        <div className="p-8">
          {children}
        </div>
      </motion.main>
    </div>
  );
};