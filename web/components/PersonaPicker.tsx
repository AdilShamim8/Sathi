'use client';

import React from 'react';
import { User, Wifi, WifiOff, Globe, Sun, Moon } from 'lucide-react';
import { DemoUser } from '../lib/api';

export type Language = 'bn' | 'en';
export type Theme = 'dark' | 'light';

interface PersonaPickerProps {
  users: DemoUser[];
  currentUser: DemoUser | null;
  onSelectUser: (user: DemoUser) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  language: Language;
  onToggleLanguage: () => void;
  theme?: Theme;
  onToggleTheme?: () => void;
}

export const PersonaPicker: React.FC<PersonaPickerProps> = ({
  users,
  currentUser,
  onSelectUser,
  isOffline,
  onToggleOffline,
  language,
  onToggleLanguage,
  theme = 'dark',
  onToggleTheme,
}) => {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  return (
    <header
      className="glass-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 800,
        width: '100%',
        maxWidth: '540px',
        margin: '0 auto',
        padding: '12px 16px 10px 16px',
      }}
    >
      {/* Top row: Brand + controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>

        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px', height: '38px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', fontWeight: 800, fontSize: '15px',
            boxShadow: '0 0 16px rgba(59,130,246,0.45)',
            flexShrink: 0,
          }}>
            সা
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{
                fontSize: '1.1rem', fontWeight: 800,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '-0.3px',
              }}>
                সাথী
              </span>
              <span style={{
                fontSize: '0.62rem', padding: '2px 7px',
                borderRadius: '6px',
                background: 'rgba(59,130,246,0.14)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: 'var(--accent-primary)',
                fontWeight: 700, letterSpacing: '0.4px',
              }}>
                AI
              </span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              {isBn ? 'আপনার বিশ্বস্ত আর্থিক সাথী' : 'Your Trusted Financial Companion'}
            </p>
          </div>
        </div>

        {/* Right controls: Theme + Lang + Demo/Live */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Theme Toggle */}
          {onToggleTheme && (
            <button
              id="theme-toggle-btn"
              onClick={onToggleTheme}
              title={isDark ? (isBn ? 'লাইট মোড চালু করুন' : 'Switch to Light Mode') : (isBn ? 'ডার্ক মোড চালু করুন' : 'Switch to Dark Mode')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              {isDark ? <Sun size={15} color="#F59E0B" /> : <Moon size={15} color="#3B82F6" />}
            </button>
          )}

          {/* Language Toggle */}
          <button
            id="lang-toggle-btn"
            onClick={onToggleLanguage}
            title={isBn ? 'Switch to English' : 'বাংলায় দেখুন'}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 11px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.25)',
              color: 'var(--accent-primary)',
              fontSize: '0.72rem', fontWeight: 700,
            }}
          >
            <Globe size={13} />
            <span>{isBn ? 'EN' : 'বাং'}</span>
          </button>

          {/* Live / Demo Mode Toggle */}
          <button
            id="offline-toggle-btn"
            onClick={onToggleOffline}
            title={isOffline ? (isBn ? 'লাইভ এপিআই-এ যান' : 'Switch to Live API') : (isBn ? 'ডেমো মোডে যান' : 'Switch to Demo Mode')}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 11px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: isOffline ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${isOffline ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}`,
              color: isOffline ? 'var(--state-caution)' : 'var(--state-success)',
              fontSize: '0.72rem', fontWeight: 600,
            }}
          >
            {isOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
            <span>{isOffline ? (isBn ? 'ডেমো' : 'Demo') : (isBn ? 'লাইভ' : 'Live')}</span>
          </button>
        </div>
      </div>

      {/* Persona chips - horizontal scroll */}
      <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
        {users.map((u) => {
          const isSelected = currentUser?.persona === u.persona;
          return (
            <button
              key={u.user_id}
              onClick={() => onSelectUser(u)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isSelected ? 'rgba(59,130,246,0.15)' : 'var(--bg-surface)',
                border: isSelected ? '1px solid rgba(59,130,246,0.5)' : '1px solid var(--border-default)',
                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: isSelected ? 700 : 400,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: isSelected ? '0 0 10px rgba(59,130,246,0.2)' : 'none',
              }}
            >
              <User size={11} />
              <span>{isBn ? u.persona_label_bn : u.persona_label_en}</span>
            </button>
          );
        })}
      </div>

      {/* Demo banner */}
      {isOffline && (
        <div style={{
          marginTop: '8px',
          padding: '4px 10px',
          borderRadius: '6px',
          backgroundColor: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          fontSize: '0.68rem', color: 'var(--state-caution)',
        }}>
          <span>
            {isBn
              ? '📱 ডেমো মোড সক্রিয় — যাচাইকৃত সিন্থেটিক ডেটা ও লাইটজিবিএম কোয়ান্টাইল মডেল'
              : '📱 Demo Mode Active — Verified synthetic data & LightGBM Quantile model'}
          </span>
        </div>
      )}
    </header>
  );
};
