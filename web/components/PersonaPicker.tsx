'use client';

import React from 'react';
import { User, Wifi, WifiOff, Globe } from 'lucide-react';
import { DemoUser } from '../lib/api';

export type Language = 'bn' | 'en';

interface PersonaPickerProps {
  users: DemoUser[];
  currentUser: DemoUser | null;
  onSelectUser: (user: DemoUser) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  language: Language;
  onToggleLanguage: () => void;
}

export const PersonaPicker: React.FC<PersonaPickerProps> = ({
  users,
  currentUser,
  onSelectUser,
  isOffline,
  onToggleOffline,
  language,
  onToggleLanguage,
}) => {
  const isBn = language === 'bn';

  return (
    <div
      className="glass-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 800,
        width: '100%',
        maxWidth: '540px',
        margin: '0 auto',
        padding: '12px 16px 8px 16px',
      }}
    >
      {/* Top row: Brand, Language toggle & Offline switch */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '15px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
            }}
          >
            সা
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                সাথী
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(2, 132, 199, 0.1)',
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                }}
              >
                {isBn ? 'আর্থিক সহায়ক' : 'Finance AI'}
              </span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              {isBn ? 'আপনার আর্থিক বন্ধু' : 'Your Money Companion'}
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Language Toggle */}
          <button
            id="lang-toggle-btn"
            onClick={onToggleLanguage}
            title={isBn ? 'Switch to English' : 'বাংলায় দেখুন'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(2, 132, 199, 0.1)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              color: 'var(--accent-primary)',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Globe size={13} />
            <span>{isBn ? 'EN' : 'বাং'}</span>
          </button>

          {/* Offline / Online toggle pill */}
          <button
            id="offline-toggle-btn"
            onClick={onToggleOffline}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: isOffline ? 'rgba(217, 119, 6, 0.12)' : 'rgba(22, 163, 74, 0.12)',
              border: `1px solid ${isOffline ? 'rgba(217, 119, 6, 0.3)' : 'rgba(22, 163, 74, 0.3)'}`,
              color: isOffline ? 'var(--state-caution)' : 'var(--state-success)',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
            title={isOffline
              ? (isBn ? 'অফলাইন ডেমো মোড' : 'Offline demo mode')
              : (isBn ? 'অনলাইন সংযুক্ত' : 'Connected online')}
          >
            {isOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
            <span>{isOffline ? (isBn ? 'ডেমো' : 'Demo') : (isBn ? 'লাইভ' : 'Live')}</span>
          </button>
        </div>
      </div>

      {/* Horizontal persona chips */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
        }}
      >
        {users.map((u) => {
          const isSelected = currentUser?.persona === u.persona;
          return (
            <button
              key={u.user_id}
              onClick={() => onSelectUser(u)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isSelected ? 'var(--accent-tint)' : '#FFFFFF',
                border: isSelected
                  ? '1px solid var(--accent-primary)'
                  : '1px solid var(--border-default)',
                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: '0.76rem',
                fontWeight: isSelected ? 600 : 400,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: isSelected ? '0 1px 4px rgba(2, 132, 199, 0.12)' : 'var(--shadow-sm)',
              }}
            >
              <User size={12} />
              <span>{isBn ? u.persona_label_bn : u.persona_label_en}</span>
            </button>
          );
        })}
      </div>

      {/* Demo data banner */}
      {isOffline && (
        <div
          style={{
            marginTop: '8px',
            padding: '3px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(217, 119, 6, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '0.69rem',
            color: 'var(--state-caution)',
          }}
        >
          <span>
            {isBn
              ? '📱 ডেমো ডেটা দেখাচ্ছে — বাস্তব অ্যাকাউন্ট সংযুক্ত নয়'
              : '📱 Showing demo data — no real account connected'}
          </span>
        </div>
      )}
    </div>
  );
};
