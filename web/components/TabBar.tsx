'use client';

import React from 'react';
import { Home, TrendingUp, Target, Receipt, Sparkles } from 'lucide-react';
import type { Language } from './PersonaPicker';

export type TabType = 'overview' | 'forecast' | 'planner' | 'cashout' | 'chat';

interface TabBarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  language?: Language;
}

export const TabBar: React.FC<TabBarProps> = ({ currentTab, onTabChange, language = 'bn' }) => {
  const isBn = language === 'bn';

  const tabs = [
    { id: 'overview' as TabType, labelBn: 'সারসংক্ষেপ', labelEn: 'Overview', icon: Home },
    { id: 'forecast' as TabType, labelBn: 'পূর্বাভাস', labelEn: 'Forecast', icon: TrendingUp },
    { id: 'planner' as TabType, labelBn: 'পরিকল্পনা', labelEn: 'Planner', icon: Target },
    { id: 'cashout' as TabType, labelBn: 'ক্যাশ ফি', labelEn: 'Fees', icon: Receipt },
    { id: 'chat' as TabType, labelBn: 'সাথী AI', labelEn: 'AI Chat', icon: Sparkles },
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
            id={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              flex: 1,
              height: '100%',
              background: 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
              position: 'relative',
              transition: 'color 0.2s',
            }}
          >
            {/* Active indicator dot */}
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
            )}
            <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '-0.1px',
              }}
            >
              {isBn ? tab.labelBn : tab.labelEn}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
