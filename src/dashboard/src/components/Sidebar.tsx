import React from 'react';
import { LayoutDashboard, Swords, Brain, Database, Activity, History, Settings } from 'lucide-react';
import { useDashboardStore } from '../state/useDashboardStore';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'arena', label: 'Arena', icon: Swords },
  { id: 'agents', label: 'Agents', icon: Brain },
  { id: 'memory', label: 'Memory', icon: Database },
  { id: 'telemetry', label: 'Telemetry', icon: Activity },
  { id: 'replay', label: 'Replay', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const activeTab = useDashboardStore((s) => s.activeTab);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);
  const [clickedItem, setClickedItem] = React.useState('dashboard');

  React.useEffect(() => {
    if (activeTab === 'dashboard') {
      if (clickedItem !== 'dashboard' && clickedItem !== 'arena' && clickedItem !== 'agents' && clickedItem !== 'memory') {
        setClickedItem('dashboard');
      }
    } else {
      setClickedItem(activeTab);
    }
  }, [activeTab]);

  return (
    <aside className="flex h-full w-[200px] shrink-0 flex-col border-r border-border/50 bg-card shadow-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-[56px] shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
          <span className="text-xs font-bold text-background tracking-tight">NA</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-foreground leading-tight">Neural Arena</span>
          <span className="text-2xs text-muted-foreground leading-tight">Simulation Engine</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = clickedItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setClickedItem(item.id);
                if (item.id === 'dashboard' || item.id === 'arena' || item.id === 'agents' || item.id === 'memory') {
                  setActiveTab('dashboard');
                } else if (item.id === 'telemetry') {
                  setActiveTab('telemetry');
                } else if (item.id === 'replay') {
                  setActiveTab('replay');
                } else if (item.id === 'settings') {
                  setActiveTab('settings');
                }
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-muted text-foreground shadow-inner-soft'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <span className="text-2xs font-semibold text-muted-foreground">NO</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-foreground truncate">Neural Operator</span>
            <span className="text-2xs text-muted-foreground">System Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
