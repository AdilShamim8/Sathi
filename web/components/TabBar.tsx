'use client';

import React from 'react';
import { Home, TrendingUp, Target, Receipt, Sparkles } from 'lucide-react';

export type TabType = 'overview' | 'forecast' | 'planner' | 'cashout' | 'chat';

interface TabBarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'overview' as TabType, label: 'ওভারভিউ', icon: Home },
    { id: 'forecast' as TabType, label: 'পূর্বাভাস', icon: TrendingUp },
    { id: 'planner' as TabType, label: 'পরিকল্পনা', icon: Target },
    { id: 'cashout' as TabType, label: 'ক্যাশ-আউট', icon: Receipt },
    { id: 'chat' as TabType, label: 'সাথী এআই', icon: Sparkles },
  ];

  return (
    <nav
      className="glass-chrome"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(62px + env(safe-area-inset-bottom, 12px))',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 900,
        maxWidth: '540px',
        margin: '0 auto',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              flex: 1,
              height: '100%',
              background: 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
              position: 'relative',
            }}
          >
            <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '-0.2px',
              }}
            >
              {tab.label}
            </span>
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
