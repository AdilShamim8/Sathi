'use client';

import React from 'react';
import { User, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import { DemoUser } from '../lib/api';

interface PersonaPickerProps {
  users: DemoUser[];
  currentUser: DemoUser | null;
  onSelectUser: (user: DemoUser) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
}

export const PersonaPicker: React.FC<PersonaPickerProps> = ({
  users,
  currentUser,
  onSelectUser,
  isOffline,
  onToggleOffline,
}) => {
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
      {/* Top row: Brand & Offline switch */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #64D2FF 0%, #0077B6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
            }}
          >
            সা
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                সাথী (Sathi)
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 204, 0, 0.15)',
                  color: '#FFCC00',
                  fontWeight: 600,
                }}
              >
                upay
              </span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              আর্থিক স্বাধীনতা ও পরামর্শক
            </p>
          </div>
        </div>

        {/* Offline / Online toggle pill */}
        <button
          onClick={onToggleOffline}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isOffline ? 'rgba(255,159,10,0.18)' : 'rgba(48,209,88,0.18)',
            border: `1px solid ${isOffline ? 'rgba(255,159,10,0.4)' : 'rgba(48,209,88,0.4)'}`,
            color: isOffline ? 'var(--state-caution)' : 'var(--state-success)',
            fontSize: '0.72rem',
            fontWeight: 600,
          }}
          title={isOffline ? 'বর্তমানে অফলাইন ডেমো বান্ডল থেকে চলছে' : 'অনলাইন সার্ভারের সাথে সংযুক্ত'}
        >
          {isOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
          <span>{isOffline ? 'অফলাইন মোড' : 'অনলাইন মোড'}</span>
        </button>
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
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isSelected ? 'var(--accent-tint)' : 'var(--bg-surface-raised)',
                border: isSelected
                  ? '1px solid var(--accent-primary)'
                  : '1px solid var(--border-default)',
                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: '0.76rem',
                fontWeight: isSelected ? 600 : 400,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <User size={13} />
              <span>{u.persona_label_bn}</span>
            </button>
          );
        })}
      </div>

      {/* Demo data banner */}
      {isOffline && (
        <div
          style={{
            marginTop: '8px',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 159, 10, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '0.7rem',
            color: 'var(--state-caution)',
          }}
        >
          <span>⚠️ ডেমো ডেটা, লাইভ নয় (Airplane Mode / Offline Bundle Active)</span>
        </div>
      )}
    </div>
  );
};
