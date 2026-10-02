'use client';

import React from 'react';
import { X, ShieldCheck, Database, Cpu, Settings2, AlertCircle } from 'lucide-react';
import { Evidence } from '../lib/api';

interface EvidenceModalProps {
  evidence: Evidence | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ evidence, isOpen, onClose }) => {
  if (!isOpen || !evidence) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-scrim)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '0 0 calc(env(safe-area-inset-bottom, 16px) + 8px) 0',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-surface)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          border: '1px solid var(--border-default)',
          boxShadow: '0 -10px 40px rgba(15, 23, 42, 0.15)',
          overflowY: 'auto',
          padding: '24px',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} color="var(--accent-primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                তথ্যের উৎস ও নির্ভরযোগ্যতা (Evidence)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                প্রতিটি সংখ্যার বাস্তব হিসাব এবং দায়িত্বশীল এআই নিয়ন্ত্রণ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-surface-raised)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Section 1: Data Used */}
        <div style={{ marginBottom: '16px', padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Database size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>ব্যবহৃত লেনদেন তথ্য (Data Used)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <div>সময়সীমা: <strong style={{ color: 'var(--text-primary)' }}>{evidence.data_used.window}</strong></div>
            <div>হিসাবের তারিখ: <strong style={{ color: 'var(--text-primary)' }}>{evidence.data_used.as_of_date}</strong></div>
            <div>লেনদেন সংখ্যা: <strong style={{ color: 'var(--text-primary)' }}>{evidence.data_used.n_transactions} টি</strong></div>
            <div>উৎস: <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,159,10,0.15)', color: 'var(--state-caution)', fontWeight: 500 }}>{evidence.data_used.source}</span></div>
          </div>
        </div>

        {/* Section 2: Model & Categorizer */}
        <div style={{ marginBottom: '16px', padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Cpu size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>মডেল সংস্করণ (Models & Logic)</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>পূর্বাভাস মডেল: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{evidence.model_version.forecast} (LightGBM Quantile)</strong></div>
            <div>ক্যাটেগরি রুলস: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{evidence.model_version.categorizer}</strong></div>
            <div>কনফিগ হ্যাশ: <strong style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{evidence.config_hash}</strong></div>
          </div>
        </div>

        {/* Section 3: Assumptions Table */}
        <div style={{ marginBottom: '16px', padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Settings2 size={16} color="var(--state-caution)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>স্বীকৃত ধারণাসমূহ (Assumptions)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {evidence.assumptions.map((assump, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{assump.id}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{assump.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Validator Verification */}
        <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: evidence.validator.passed ? 'rgba(48, 209, 88, 0.12)' : 'rgba(255, 69, 58, 0.12)', border: `1px solid ${evidence.validator.passed ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255, 69, 58, 0.3)'}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} color={evidence.validator.passed ? 'var(--state-success)' : 'var(--state-error)'} />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
            <strong>সংখ্যা যাচাইকরণ (Numeric Validator):</strong>{' '}
            {evidence.validator.passed
              ? 'উত্তরের প্রতিটি সংখ্যা খাঁটি টুলের হিসাব থেকে পুরোপুরি যাচাইকৃত।'
              : 'অযাচাইকৃত সংখ্যা পাওয়া যাওয়ায় স্বয়ংক্রিয় নিরাপদ টেমপ্লেটে ফিরিয়ে আনা হয়েছে।'}
          </div>
        </div>
      </div>
    </div>
  );
};
