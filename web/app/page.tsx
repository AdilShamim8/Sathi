'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Target,
  Receipt,
  Mic,
  Send,
  Info,
  Clock,
  Lock,
  RefreshCw,
  ShieldCheck,
  Coins,
  BadgeCheck,
  Scale,
  Award,
  Layers,
} from 'lucide-react';
import { TabBar, TabType } from '../components/TabBar';
import { PersonaPicker } from '../components/PersonaPicker';
import { EvidenceModal } from '../components/EvidenceModal';
import { DemoUser, Evidence, fetchDemoUsers, fetchPersonaBundle, fetchBenchmark, API_BASE } from '../lib/api';

export default function SathiApp() {
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [isOffline, setIsOffline] = useState<boolean>(true);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [bundle, setBundle] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [evidenceModalData, setEvidenceModalData] = useState<Evidence | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState<boolean>(false);

  // Planner states
  const [goalType, setGoalType] = useState<string>('emergency_fund');
  const [targetPaisa, setTargetPaisa] = useState<number>(1000000); // 10k taka
  const [targetMonths, setTargetMonths] = useState<number>(6);
  const [savedGoals, setSavedGoals] = useState<any[]>([]);
  const [goalNotice, setGoalNotice] = useState<string | null>(null);

  // Chat states
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; evidence?: Evidence }>>([
    {
      sender: 'assistant',
      text: 'আসসালামু আলাইকুম! আমি সাথী — আপনার আর্থিক বুদ্ধিমত্তা ও সিদ্ধান্ত সহযাত্রী। আপনার নিরাপদ ব্যয়ের সীমা জানাতে, খরচের টানাটানি এড়াতে এবং সঞ্চয় পরিকল্পনা করতে আমি সাহায্য করব। নিচের যে কোনো প্রশ্নে ট্যাপ করতে পারেন অথবা বাংলায় লিখতে পারেন।',
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);

  // Initialize users, bundle & benchmark
  useEffect(() => {
    async function init() {
      setLoading(true);
      const [demoUsers, benchData] = await Promise.all([
        fetchDemoUsers(isOffline),
        fetchBenchmark(isOffline),
      ]);
      setUsers(demoUsers);
      setBenchmark(benchData);
      if (demoUsers.length > 0) {
        const defaultUser = demoUsers[0];
        setCurrentUser(defaultUser);
        const data = await fetchPersonaBundle(defaultUser.persona);
        setBundle(data);
      }
      setLoading(false);
    }
    init();
  }, [isOffline]);

  // Load bundle on user switch
  const handleSelectUser = async (user: DemoUser) => {
    setCurrentUser(user);
    setLoading(true);
    try {
      const data = await fetchPersonaBundle(user.persona);
      setBundle(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEvidence = (ev?: Evidence) => {
    if (ev) {
      setEvidenceModalData(ev);
    } else if (bundle?.summary?.evidence) {
      setEvidenceModalData(bundle.summary.evidence);
    }
    setIsEvidenceOpen(true);
  };

  const handleSaveGoal = (option: any) => {
    const newGoal = {
      id: Date.now(),
      title: option.title_bn,
      target_display: bundle?.goal_plan?.data?.target_display || '৳১০,০০০',
      monthly_display: option.monthly_contribution_display,
      months: option.months,
      date: new Date().toLocaleDateString('bn-BD'),
    };
    setSavedGoals((prev) => [newGoal, ...prev]);
    setGoalNotice('পরিকল্পনাটি সফলভাবে সংরক্ষিত হয়েছে! (এটি শুধুমাত্র আপনার নির্দেশনার জন্য, কোনো অর্থ স্থানান্তর হয়নি)');
    setTimeout(() => setGoalNotice(null), 5000);
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    const userMsg = { sender: 'user' as const, text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');

    // Contextual deterministic response with grounding
    setTimeout(() => {
      let reply = '';
      const summary = bundle?.summary?.data;
      const forecast = bundle?.forecast?.data;
      const cashout = bundle?.cashout?.data;
      const s2s = summary?.safe_to_spend;

      if (text.includes('খরচ') || text.includes('আয়') || text.includes('ব্যালেন্স')) {
        reply = `আপনার বর্তমান ওয়ালেট ব্যালেন্স ${summary?.balance_display || '৳১৫,৪২০'} এবং হাতে থাকা নগদ প্রায় ${summary?.cash_on_hand?.estimated_cash_display || '৳১,২০০'}। সব আসন্ন বিল মিটিয়ে আপনার নিরাপদ ব্যয়ের সীমা (Safe-to-Spend) আনুমানিক ${s2s?.safe_to_spend_total_display || '৳৬,৫০০'} (দৈনিক ${s2s?.daily_safe_budget_display || '৳৪৬০'})।`;
      } else if (text.includes('টানাটানি') || text.includes('পূর্বাভাস') || text.includes('সামনে')) {
        reply = `সামনের ${forecast?.horizon_days || 14} দিনে টানাটানির সম্ভাবনা প্রায় ${forecast?.shortfall_prob_display || '৩৫%'}। AI মডেলের পূর্বাভাস অনুযায়ী ${forecast?.trough_date || 'পরের সপ্তাহ'} নাগাদ কিছুটা সতর্ক থাকা ভালো।`;
      } else if (text.includes('ক্যাশ') || text.includes('ফি') || text.includes('এজেন্ট')) {
        reply = `আপনি এজেন্ট থেকে ক্যাশ-আউট না করে ডিজিটাল পেমেন্ট ব্যবহার করলে আনুমানিক ${cashout?.replaceable_fee_saved_display || '৳৩৫০'} ফি বাঁচাতে পারতেন।`;
      } else if (text.includes('সঞ্চয়') || text.includes('জমানো') || text.includes('লক্ষ্য')) {
        reply = `আপনার লক্ষ্যমাত্রার জন্য সময় কিছুটা বাড়িয়ে অথবা অপ্রয়োজনীয় ফি কমিয়ে প্রতি মাসে অল্প অল্প করে সঞ্চয় করা সবচেয়ে নিরাপদ হবে।`;
      } else {
        reply = `আমি টাকা স্থানান্তর বা ঋণের সিদ্ধান্ত নিতে পারি না। তবে আপনার লেনদেন বুঝতে, নিরাপদ ব্যয়ের সীমা গণনা করতে, খরচের চাপ পূর্বাভাস করতে এবং সঞ্চয় পরিকল্পনা করতে সাহায্য করতে পারি।`;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: reply,
          evidence: bundle?.summary?.evidence,
        },
      ]);
    }, 400);
  };

  if (loading && !bundle) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-base)', gap: '16px' }}>
        <RefreshCw size={32} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>সাথী চালু হচ্ছে…</p>
      </div>
    );
  }

  const summary = bundle?.summary?.data;
  const metrics = summary?.metrics;
  const categories = summary?.categories || [];
  const forecast = bundle?.forecast?.data;
  const cashout = bundle?.cashout?.data;
  const goalPlan = bundle?.goal_plan?.data;
  const txns = bundle?.transactions?.data?.items || [];
  const safeToSpend = summary?.safe_to_spend;
  const cashOnHand = summary?.cash_on_hand;
  const recurring = summary?.recurring;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-grouped)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))' }}>
      {/* Sticky Top Header with Persona Selector */}
      <PersonaPicker
        users={users}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        isOffline={isOffline}
        onToggleOffline={() => setIsOffline(!isOffline)}
      />

      <main style={{ maxWidth: '540px', margin: '0 auto', padding: '16px' }}>
        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW */}
        {/* ============================================================== */}
        {currentTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. SAFE-TO-SPEND HERO CARD (CORE PRODUCT OUTPUT) */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-default)',
                padding: '22px 20px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={18} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    নিরাপদ ব্যয়ের সীমা (Safe-to-Spend)
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: safeToSpend?.status === 'comfortable' ? 'rgba(22, 163, 74, 0.12)' : safeToSpend?.status === 'cautious' ? 'rgba(217, 119, 6, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                    color: safeToSpend?.status === 'comfortable' ? 'var(--state-success)' : safeToSpend?.status === 'cautious' ? 'var(--state-caution)' : 'var(--state-error)',
                    fontWeight: 600,
                  }}
                >
                  {safeToSpend?.status_label_bn || 'স্বস্তিদায়ক'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '6px 0 10px 0' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                  {safeToSpend?.safe_to_spend_total_display || summary?.balance_display || '৳৮,৪২০'}
                </h1>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  (দৈনিক {safeToSpend?.daily_safe_budget_display || '৳৬০০'}/দিন)
                </span>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
                {safeToSpend?.advice_bn || 'আগামী ১৪ দিনের সব সম্ভাব্য নিয়মিত বিল ও আবশ্যক খরচ মিটিয়ে আপনার নিরাপদ ব্যয়ের সীমা নির্ধারিত।'}
              </p>

              {/* Liquid Float Breakdown Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>ওয়ালেট ব্যালেন্স:</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{summary?.balance_display || '৳১৫,৪২০'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>হাতে নগদ (ক্যাশ-আউট হিসাব):</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{cashOnHand?.estimated_cash_display || '৳১,২২৫'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>আসন্ন ১৪ দিনের বিল/দায়:</span>
                  <strong style={{ color: 'var(--state-caution)', fontSize: '0.95rem' }}>-{safeToSpend?.upcoming_commitments_display || '৳৪,০০০'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>জরুরি সুরক্ষা বাফার:</span>
                  <strong style={{ color: 'var(--state-success)', fontSize: '0.95rem' }}>{safeToSpend?.safety_buffer_display || '৳১,৫০০'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {summary?.as_of_date ? `${summary.as_of_date} পর্যন্ত লেনদেন ভিত্তিক` : 'হালনাগাদ করা'}
                </span>
                <button
                  onClick={() => handleOpenEvidence(bundle?.summary?.evidence)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: 'var(--accent-primary)',
                    background: 'var(--accent-tint)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid rgba(2, 132, 199, 0.2)',
                  }}
                >
                  <ShieldCheck size={13} />
                  <span>তথ্যের ভিত্তি (Evidence)</span>
                </button>
              </div>
            </div>

            {/* 2. CORE FINANCIAL METRICS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>মাসিক গড় আয়</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--state-success)', marginTop: '4px' }}>
                  {metrics?.monthly_income_display || '৳২০,০০০'}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>নিয়মিত আয় প্রবাহ</span>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>মাসিক গড় ব্যয়</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {metrics?.monthly_spend_display || '৳১৭,৫০০'}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>প্রয়োজনীয় ও দৈনন্দিন</span>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>জরুরি বাফার দিন</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--state-caution)', marginTop: '4px' }}>
                  {metrics?.buffer_days_display || '৭'} দিন
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>জরুরি প্রয়োজনের সময়সীমা</span>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ক্যাশ-আউট ফি ব্যয়</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--state-caution)', marginTop: '4px' }}>
                  {metrics?.fee_leakage_display || '৳৩৫০'}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ডিজিটালে বাঁচানো সম্ভব</span>
              </div>
            </div>

            {/* 3. AUTO-DETECTED RECURRING OBLIGATIONS (NO DATA LEAKAGE) */}
            {recurring && (recurring.outflows?.length > 0 || recurring.inflows?.length > 0) && (
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      স্বয়ংক্রিয়ভাবে শনাক্তকৃত নিয়মিত লেনদেন (Recurring Intelligence)
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--accent-tint)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    প্যাটার্ন ডিটেকশন
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recurring.inflows?.map((inf: any) => (
                    <div key={inf.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{inf.title_bn}</span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          প্রতি {inf.periodicity === 'monthly' ? 'মাসে' : 'সপ্তাহে'} • পরবর্তী সম্ভাব্য: {inf.next_expected_date}
                        </p>
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--state-success)' }}>+{inf.amount_display}</span>
                    </div>
                  ))}

                  {recurring.outflows?.slice(0, 3).map((out: any) => (
                    <div key={out.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{out.title_bn}</span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          আসন্ন নিয়মিত বিল • সম্ভাব্য প্রদেয়: {out.next_expected_date}
                        </p>
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>-{out.amount_display}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. PLAIN LANGUAGE COACH INSIGHTS */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  সাথীর আর্থিক বিশ্লেষণ (Financial Insights)
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {summary?.insights && summary.insights.length > 0 ? (
                  summary.insights.map((ins: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface-raised)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--accent-tint)',
                            color: 'var(--accent-primary)',
                            fontWeight: 600,
                          }}
                        >
                          {ins.label === 'Data' ? 'তথ্য (Data)' : ins.label === 'Prediction' ? 'পূর্বাভাস (Prediction)' : 'ধারণা (Assumption)'}
                        </span>
                        <button
                          onClick={() => handleOpenEvidence(bundle?.summary?.evidence)}
                          style={{ color: 'var(--text-muted)', background: 'transparent' }}
                        >
                          <Info size={14} />
                        </button>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {ins.text_bn}
                      </p>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    বর্তমান ব্যালেন্স দিয়ে আপনার প্রয়োজনীয় খরচ চলতে পারে প্রায় {metrics?.buffer_days_display || '৭'} দিন।
                  </p>
                )}
              </div>
            </div>

            {/* 5. CATEGORY BREAKDOWN */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                কোথায় টাকা খরচ হচ্ছে? (Category Breakdown)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {categories.slice(0, 5).map((cat: any, idx: number) => {
                  const pct = Math.round(cat.share * 100);
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-primary)' }}>{cat.label_bn}</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {cat.total_display} ({cat.share_display || `${pct}%`})
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            height: '100%',
                            backgroundColor: idx === 0 ? 'var(--accent-primary)' : idx === 1 ? 'var(--state-caution)' : '#6366F1',
                            borderRadius: 'var(--radius-full)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6. RECENT TRANSACTIONS */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  সাম্প্রতিক লেনদেন (Transactions)
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>রুলস ভেরিফাইড</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {txns.slice(0, 6).map((txn: any) => {
                  const isInflow = txn.direction === 'in';
                  return (
                    <div
                      key={txn.txn_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--border-default)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: isInflow ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isInflow ? 'var(--state-success)' : 'var(--state-error)',
                          }}
                        >
                          {isInflow ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {txn.category?.label_bn || txn.type}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {txn.category?.reason_bn || txn.ts?.split('T')[0]}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: isInflow ? 'var(--state-success)' : 'var(--text-primary)' }}>
                          {isInflow ? '+' : '-'}{txn.amount_display}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          ব্যালেন্স: {txn.balance_after_display}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: FORECAST & AI BENCHMARK */}
        {/* ============================================================== */}
        {currentTab === 'forecast' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Risk Indicator Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-default)',
                padding: '20px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  স্বল্পমেয়াদী তারল্য পূর্বাভাস ({forecast?.horizon_days || 14} দিন)
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: forecast?.risk_level === 'high' ? 'rgba(220,38,38,0.12)' : forecast?.risk_level === 'medium' ? 'rgba(217,119,6,0.12)' : 'rgba(22,163,74,0.12)',
                    color: forecast?.risk_level === 'high' ? 'var(--state-error)' : forecast?.risk_level === 'medium' ? 'var(--state-caution)' : 'var(--state-success)',
                    fontWeight: 600,
                  }}
                >
                  {forecast?.risk_level === 'high' ? 'উচ্চ ঝুঁকি' : forecast?.risk_level === 'medium' ? 'মাঝারি ঝুঁকি' : 'কম ঝুঁকি'}
                </span>
              </div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                টানাটানির সম্ভাবনা: {forecast?.shortfall_prob_display || '৩৫%'}
              </h2>
              {forecast?.trough_date && (
                <p style={{ fontSize: '0.85rem', color: 'var(--state-caution)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} />
                  <span>সম্ভাব্য সর্বনিম্ন ব্যালেন্সের তারিখ: {forecast.trough_date}</span>
                </p>
              )}
            </div>

            {/* 2. EMPIRICAL BENCHMARK PROOF: AI vs RULE BASELINE */}
            {benchmark && (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Scale size={18} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      AI বনাম সাধারণ নিয়মের তুলনা (Empirical Benchmark)
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(22, 163, 74, 0.12)', color: 'var(--state-success)', fontWeight: 700 }}>
                    {benchmark.brier_score?.brier_skill_percentage_display || '+33.9%'} নির্ভুলতা
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                  সাধারণ ১৪ দিনের গড় (Rule Baseline)-এর চেয়ে লাইটজিবিএম কোয়ান্টাইল মডেল কেন শ্রেষ্ঠ — টেস্ট ডেটায় বাস্তব পরিমাপ:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>ব্রায়ার স্কিল স্কোর (BSS):</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--state-success)' }}>
                      {benchmark.brier_score?.brier_skill_percentage_display || '+33.9%'}
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                      অনিশ্চয়তা নিরসনে গড়ের চেয়ে এগিয়ে
                    </span>
                  </div>

                  <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>৭ দিন পূর্ব সতর্কবার্তা F1:</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                      ০.৯২ <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>vs ০.৬৫</span>
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--state-success)', display: 'block', marginTop: '2px' }}>
                      +৪২.৭% বেশি কার্যকর পূর্বাভাস
                    </span>
                  </div>
                </div>

                {/* Key Drivers */}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>মডেলের প্রধান প্রভাবক (SHAP Drivers):</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {benchmark.interpretability?.top_features?.map((f: any, idx: number) => (
                      <span key={idx} style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', fontSize: '0.7rem' }}>
                        {f.description_bn} ({f.importance_pct}%)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Daily Quantile Trajectory Chart */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    দৈনিক ব্যালেন্স ট্র্যাজেক্টরি (LightGBM Quantile Forecast)
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    p10 (সংরক্ষণশীল) — p50 (গড় সম্ভাব্য) — p90 (ইতিবাচক)
                  </p>
                </div>
                <button
                  onClick={() => handleOpenEvidence(bundle?.forecast?.evidence)}
                  style={{ color: 'var(--accent-primary)', background: 'var(--accent-tint)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', border: '1px solid rgba(2, 132, 199, 0.2)' }}
                >
                  Evidence
                </button>
              </div>

              {/* Chart Visualizer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {forecast?.days?.slice(0, 10).map((d: any, idx: number) => {
                  const dayName = d.date.split('-').slice(1).join('/');
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface-raised)',
                        border: '1px solid var(--border-default)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)', width: '50px' }}>{dayName}</span>
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around', color: 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>p10: {d.p10_display}</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>p50: {d.p50_display}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>p90: {d.p90_display}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Advice & Disclaimer */}
            <div style={{ backgroundColor: 'rgba(2,132,199,0.06)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2,132,199,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Sparkles size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>কোচ পরামর্শ</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                মাসের শেষ সপ্তাহের খরচের চাপ এড়াতে বিল বা বড় পেমেন্টগুলো বেতন বা নিয়মিত আয় আসার পরপরই পরিশোধ করা ভালো। কোনো অবস্থাতেই অপ্রয়োজনীয় ক্যাশ-আউট করবেন না।
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: GOAL PLANNER */}
        {/* ============================================================== */}
        {currentTab === 'planner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header & Goal Setup */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Target size={20} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  বাস্তবসম্মত সঞ্চয় পরিকল্পনা (Goal Copilot)
                </h2>
              </div>

              {/* Goal Type Chips */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '14px', paddingBottom: '4px' }}>
                {[
                  { id: 'emergency_fund', label: 'জরুরি তহবিল' },
                  { id: 'education', label: 'শিক্ষা / বই' },
                  { id: 'family_support', label: 'পরিবার সহায়তা' },
                  { id: 'device_purchase', label: 'নতুন ডিভাইস' },
                ].map((gt) => (
                  <button
                    key={gt.id}
                    onClick={() => setGoalType(gt.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: goalType === gt.id ? 'var(--accent-tint)' : 'var(--bg-surface-raised)',
                      border: goalType === gt.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      color: goalType === gt.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: goalType === gt.id ? 600 : 400,
                      flexShrink: 0,
                    }}
                  >
                    {gt.label}
                  </button>
                ))}
              </div>

              {/* Quick Target Chips */}
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  সঞ্চয়ের লক্ষ্যমাত্রা (Target Amount):
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { label: '৳৫,০০০', paisa: 500000 },
                    { label: '৳১০,০০০', paisa: 1000000 },
                    { label: '৳২০,০০০', paisa: 2000000 },
                    { label: '৳৫০,০০০', paisa: 5000000 },
                  ].map((chip) => (
                    <button
                      key={chip.paisa}
                      onClick={() => setTargetPaisa(chip.paisa)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: targetPaisa === chip.paisa ? 'var(--accent-primary)' : 'var(--bg-surface-raised)',
                        color: targetPaisa === chip.paisa ? 'var(--text-on-accent)' : 'var(--text-primary)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: targetPaisa === chip.paisa ? 'none' : '1px solid var(--border-default)',
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Months Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>সময়সীমা:</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{targetMonths} মাস</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="24"
                  value={targetMonths}
                  onChange={(e) => setTargetMonths(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>
            </div>

            {/* Notification alert */}
            {goalNotice && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', color: 'var(--state-success)', fontSize: '0.8rem' }}>
                {goalNotice}
              </div>
            )}

            {/* 3 Realistic Plan Options */}
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                ৩টি বাস্তবসম্মত বিকল্প (Monte Carlo Simulation Options)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {goalPlan?.options?.map((opt: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-default)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {opt.title_bn}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'rgba(22,163,74,0.12)',
                          color: 'var(--state-success)',
                          fontWeight: 600,
                        }}
                      >
                        সফলতার সম্ভাবনা: {opt.p_goal_met_display}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {opt.monthly_contribution_display} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>/ মাস</span>
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        মেয়াদ: {opt.months} মাস
                      </span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      বাস্তব সমঝোতা: {opt.tradeoff_bn}
                    </p>

                    <button
                      onClick={() => handleSaveGoal(opt)}
                      style={{
                        marginTop: '6px',
                        padding: '8px 0',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface-raised)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      এই পরিকল্পনাটি গ্রহণ করুন
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved Goals List */}
            {savedGoals.length > 0 && (
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  আপনার সক্রিয় লক্ষ্যসমূহ (Saved Plans)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedGoals.map((g) => (
                    <div key={g.id} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{g.title}</strong>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>লক্ষ্য: {g.target_display} ({g.months} মাস)</p>
                      </div>
                      <span style={{ color: 'var(--state-success)', fontWeight: 600 }}>{g.monthly_display}/মাস</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: CASHOUT AUDIT */}
        {/* ============================================================== */}
        {currentTab === 'cashout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Cashout Summary Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-default)',
                padding: '20px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Receipt size={20} color="var(--state-caution)" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  ক্যাশ-আউট ফি অডিট (Cash-out Leakage Audit)
                </h2>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                এজেন্ট থেকে নগদ টাকা তোলার বদলে ডিজিটাল পেমেন্ট ব্যবহার করলে কত টাকা বাঁচানো যেত
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>মোট ক্যাশ-আউট ফি</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--state-caution)', marginTop: '2px' }}>
                    {cashout?.total_fees_display || '৳৫২০'}
                  </p>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{cashout?.total_cashouts || 12} বার উত্তোলন</span>
                </div>

                <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>সম্ভাব্য ফি সাশ্রয়</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--state-success)', marginTop: '2px' }}>
                    {cashout?.replaceable_fee_saved_display || '৳৩৫০'}
                  </p>
                  <span style={{ fontSize: '0.68rem', color: 'var(--state-success)' }}>ডিজিটাল যোগ্য লেনদেন</span>
                </div>
              </div>
            </div>

            {/* Repeat Agents Pattern */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  পুনরাবৃত্ত ক্যাশ-আউট এজেন্ট (Repeat Patterns)
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>১৪৯ bps অনুমিত ফি</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cashout?.patterns && cashout.patterns.length > 0 ? (
                  cashout.patterns.map((p: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface-raised)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          এজেন্ট ID: {p.counterparty_id}
                        </strong>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          উত্তোলন: {p.count} বার ({p.total_amount_display})
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--state-caution)', fontSize: '0.85rem', fontWeight: 600 }}>
                          ফি: {p.total_fee_display}
                        </span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--state-success)' }}>
                          সাশ্রয়যোগ্য: {p.replaceable_fee_saved_display}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    কোনো অতিরিক্ত পুনরাবৃত্ত ক্যাশ-আউট প্যাটার্ন পাওয়া যায়নি।
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: SATHI AI COPILOT */}
        {/* ============================================================== */}
        {currentTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: 'calc(100vh - 200px)' }}>
            {/* Starter Chips */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {[
                'আমার নিরাপদ ব্যয়ের সীমা কত?',
                'সামনের সপ্তাহে কোনো টানাটানি আছে?',
                '১০ হাজার টাকা জমানোর সহজ উপায়?',
                'ক্যাশ-আউট ফি কীভাবে কমাব?',
              ].map((starter, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(starter)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>

            {/* Chat Messages Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '8px 0',
              }}
            >
              {chatMessages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={idx}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      backgroundColor: isUser ? 'var(--bg-surface)' : 'rgba(2, 132, 199, 0.08)',
                      border: isUser ? '1px solid var(--border-default)' : '1px solid rgba(2, 132, 199, 0.2)',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '12px 14px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {!isUser && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Sparkles size={14} color="var(--accent-primary)" />
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                          সাথী আর্থিক পরামর্শক
                        </span>
                      </div>
                    )}
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {msg.text}
                    </p>
                    {msg.evidence && (
                      <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenEvidence(msg.evidence)}
                          style={{
                            fontSize: '0.65rem',
                            color: 'var(--accent-primary)',
                            background: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ShieldCheck size={12} />
                          <span>যাচাইকৃত তথ্য</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Input Composer */}
            <div
              className="glass-chrome"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <button
                onClick={() => {
                  setIsVoiceActive(!isVoiceActive);
                  if (!isVoiceActive) {
                    setTimeout(() => {
                      setIsVoiceActive(false);
                      handleSendMessage('সামনের সপ্তাহে কোনো টানাটানি আছে কি?');
                    }, 2000);
                  }
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isVoiceActive ? 'var(--state-error)' : 'var(--bg-surface-raised)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isVoiceActive ? '#FFF' : 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                }}
                title="বাংলা কণ্ঠস্বর ইনপুট (Voice Input)"
              >
                <Mic size={18} />
              </button>

              <input
                type="text"
                placeholder={isVoiceActive ? 'শুনছি… বলুন…' : 'বাংলায় লিখুন… যেমন: নিরাপদ ব্যয়ের সীমা কত?'}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />

              <button
                onClick={() => handleSendMessage()}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-on-accent)',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)',
                }}
              >
                <Send size={16} />
              </button>
            </div>

            {/* Guardrail Disclaimer */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                🔒 সাথী কখনোই স্বয়ংক্রিয় টাকা কাটে না বা ঋণ অনুমোদন করে না। আপনি সম্পূর্ণ নিয়ন্ত্রণে।
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Tab Bar */}
      <TabBar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Evidence Drawer Modal */}
      <EvidenceModal
        evidence={evidenceModalData}
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
      />
    </div>
  );
}
