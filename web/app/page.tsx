'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Target,
  Receipt,
  Mic,
  Send,
  Info,
  Clock,
  RefreshCw,
  ShieldCheck,
  Coins,
  Scale,
  Award,
  ChevronRight,
  TrendingDown,
  BadgeCheck,
  Lightbulb,
  CircleDollarSign,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import { TabBar, TabType } from '../components/TabBar';
import { PersonaPicker, Language } from '../components/PersonaPicker';
import { EvidenceModal } from '../components/EvidenceModal';
import { DemoUser, Evidence, fetchDemoUsers, fetchPersonaBundle, fetchBenchmark, API_BASE } from '../lib/api';

// ─────────────────────────────────────────────
// Translation dictionary
// ─────────────────────────────────────────────
const T = {
  bn: {
    loading: 'সাথী চালু হচ্ছে…',
    // Overview
    safeSpend: 'এখন নিরাপদে খরচ করা যাবে',
    safeSpendSub: 'আগামী ১৪ দিনের সব প্রয়োজনীয় বিল মিটিয়ে বাকি টাকা',
    perDay: 'দিনে',
    comfortable: 'স্বস্তিদায়ক',
    cautious: 'সতর্ক থাকুন',
    tight: 'টানাটানি',
    walletBalance: 'ওয়ালেটে টাকা',
    cashInHand: 'হাতে নগদ',
    upcomingBills: 'আসন্ন বিল',
    safetyBuffer: 'জরুরি সঞ্চয়',
    verifyData: 'তথ্য যাচাই করুন',
    updatedOn: 'পর্যন্ত আপডেট',
    monthlyIncome: 'মাসিক আয়',
    monthlySpend: 'মাসিক খরচ',
    bufferDays: 'জরুরি দিন',
    feeSavable: 'ফি বাঁচানো সম্ভব',
    regularIncome: 'নিয়মিত আয়',
    dailyExpenses: 'দৈনন্দিন খরচ',
    emergencyDays: 'জরুরি প্রয়োজনে',
    digitalSavings: 'ডিজিটাল পেমেন্টে',
    recurringTitle: 'নিয়মিত আয় ও বিল',
    recurringSubtitle: 'স্বয়ংক্রিয়ভাবে পাওয়া তথ্য',
    monthlyLabel: 'মাসিক',
    weeklyLabel: 'সাপ্তাহিক',
    nextExpected: 'পরবর্তী',
    insightsTitle: 'সাথীর পরামর্শ',
    whereMoneyGoes: 'কোথায় কত টাকা যাচ্ছে?',
    recentTxns: 'সাম্প্রতিক লেনদেন',
    balanceAfter: 'পরে ব্যালেন্স',
    // Forecast
    forecastTitle: 'সামনের দিনের পূর্বাভাস',
    shortfallChance: 'টাকা কম পড়ার সম্ভাবনা',
    riskHigh: 'সাবধান! টাকা কম পড়তে পারে',
    riskMedium: 'কিছুটা সতর্ক থাকুন',
    riskLow: 'ভালো অবস্থায় আছেন',
    lowestBalDate: 'সবচেয়ে কম ব্যালেন্সের সম্ভাব্য তারিখ',
    aiVsBasic: 'AI পূর্বাভাস বনাম সাধারণ হিসাব',
    aiMoreAccurate: 'বেশি নির্ভুল',
    aiExplain: 'সাথীর AI সাধারণ গড় হিসাবের চেয়ে অনেক বেশি নির্ভুলভাবে আপনার ভবিষ্যৎ টাকার অবস্থা বলতে পারে। নিচে পরীক্ষিত প্রমাণ:',
    bssLabel: 'নির্ভুলতা উন্নতি',
    bssExplain: 'সাধারণ হিসাবের চেয়ে এগিয়ে',
    earlyWarning: '৭ দিন আগে সতর্কতা',
    earlyWarningExplain: 'AI বেশি কার্যকর',
    keyFactors: 'AI যে কারণগুলো দেখে সিদ্ধান্ত নেয়',
    dailyForecastTitle: 'প্রতিদিনের ব্যালেন্স পূর্বাভাস',
    dailyForecastSub: 'কম ধরলে — গড় সম্ভাব্য — বেশি ধরলে',
    coachAdvice: 'কোচের পরামর্শ',
    forecastAdvice: 'মাসের শেষ সপ্তাহের চাপ এড়াতে বড় পেমেন্ট বেতন পাওয়ার পরপরই করুন। অপ্রয়োজনীয় ক্যাশ-আউট বন্ধ রাখুন।',
    // Planner
    plannerTitle: 'সঞ্চয় পরিকল্পনা',
    plannerSub: 'বাস্তবসম্মত লক্ষ্য ঠিক করুন',
    goalType: 'কী জন্য সঞ্চয় করবেন?',
    emergency: 'জরুরি তহবিল',
    education: 'শিক্ষা / বই',
    family: 'পরিবার সহায়তা',
    device: 'নতুন ডিভাইস',
    targetAmount: 'কত টাকা জমাতে চান?',
    timeline: 'কত মাসে জমাবেন?',
    months: 'মাস',
    planOptions: '৩টি সহজ পরিকল্পনা',
    successChance: 'সফলতার সম্ভাবনা',
    perMonth: '/ মাস',
    duration: 'সময়কাল',
    tradeoff: 'যা বিবেচনা করবেন',
    savePlan: 'এই পরিকল্পনা গ্রহণ করি',
    planSaved: 'পরিকল্পনা সংরক্ষিত হয়েছে! কোনো টাকা কাটা হয়নি।',
    savedPlans: 'আমার পরিকল্পনাসমূহ',
    target: 'লক্ষ্য',
    // Cashout
    cashoutTitle: 'ক্যাশ-আউট খরচ বিশ্লেষণ',
    cashoutSub: 'এজেন্ট থেকে টাকা তুলতে কত ফি দিচ্ছেন?',
    totalFees: 'মোট ফি দিয়েছেন',
    couldSave: 'ডিজিটালে বাঁচাতে পারতেন',
    cashoutCount: 'বার টাকা তুলেছেন',
    digitalEligible: 'ডিজিটালে করা যেত',
    repeatAgents: 'যেসব এজেন্ট থেকে বারবার টুলেছেন',
    agentId: 'এজেন্ট',
    withdrawals: 'উত্তোলন',
    totalFee: 'মোট ফি',
    saveable: 'সাশ্রয়যোগ্য',
    noPatterns: 'কোনো পুনরাবৃত্তি পাওয়া যায়নি।',
    // Chat
    chatWelcome: 'আস-সালামু আলাইকুম! আমি সাথী — আপনার আর্থিক সহায়ক। আপনার টাকার হিসাব বুঝতে, খরচ কমাতে এবং সঞ্চয় পরিকল্পনা করতে আমি সাহায্য করব। নিচের যেকোনো প্রশ্নে ট্যাপ করুন অথবা নিজে লিখুন।',
    chatStarters: [
      'এখন কত টাকা খরচ করা নিরাপদ?',
      'সামনের সপ্তাহে কি টাকার সমস্যা হবে?',
      '১০ হাজার টাকা কীভাবে জমাব?',
      'ক্যাশ-আউট ফি কমানোর উপায় কী?',
    ],
    chatPlaceholder: 'লিখুন… যেমন: এখন কত টাকা খরচ করা যাবে?',
    listening: 'শুনছি…',
    aiLabel: 'সাথী',
    verified: 'যাচাইকৃত তথ্য',
    guardrail: '🔒 সাথী কখনো নিজে থেকে টাকা কাটে না বা ঋণ দেয় না। আপনি সম্পূর্ণ নিয়ন্ত্রণে।',
  },
  en: {
    loading: 'Loading Sathi…',
    // Overview
    safeSpend: 'Safe to Spend Now',
    safeSpendSub: 'After all upcoming bills & expenses for next 14 days',
    perDay: 'per day',
    comfortable: 'Comfortable',
    cautious: 'Be Careful',
    tight: 'Tight Budget',
    walletBalance: 'Wallet Balance',
    cashInHand: 'Cash in Hand',
    upcomingBills: 'Upcoming Bills',
    safetyBuffer: 'Emergency Buffer',
    verifyData: 'Verify Data',
    updatedOn: 'Updated through',
    monthlyIncome: 'Monthly Income',
    monthlySpend: 'Monthly Spend',
    bufferDays: 'Emergency Days',
    feeSavable: 'Fees Savable',
    regularIncome: 'Regular income',
    dailyExpenses: 'Daily expenses',
    emergencyDays: 'Days of cover',
    digitalSavings: 'Go digital & save',
    recurringTitle: 'Regular Income & Bills',
    recurringSubtitle: 'Auto-detected patterns',
    monthlyLabel: 'monthly',
    weeklyLabel: 'weekly',
    nextExpected: 'Next expected',
    insightsTitle: 'Sathi\'s Insights',
    whereMoneyGoes: 'Where Is Your Money Going?',
    recentTxns: 'Recent Transactions',
    balanceAfter: 'Balance after',
    // Forecast
    forecastTitle: 'Future Money Forecast',
    shortfallChance: 'Chance of Running Short',
    riskHigh: 'Warning! You may run short',
    riskMedium: 'Stay cautious this week',
    riskLow: 'You\'re in good shape',
    lowestBalDate: 'Expected lowest balance date',
    aiVsBasic: 'AI Forecast vs Basic Average',
    aiMoreAccurate: 'more accurate',
    aiExplain: 'Sathi\'s AI is far more accurate than a basic rolling average at predicting your future cash flow. Here\'s the proof:',
    bssLabel: 'Accuracy improvement',
    bssExplain: 'Better than basic average',
    earlyWarning: '7-day early warning',
    earlyWarningExplain: 'AI performs better',
    keyFactors: 'Key factors the AI considers',
    dailyForecastTitle: 'Daily Balance Forecast',
    dailyForecastSub: 'Conservative — Most likely — Optimistic',
    coachAdvice: 'Coach Tip',
    forecastAdvice: 'To avoid end-of-month pressure, pay large bills right after your salary arrives. Avoid unnecessary cash-outs.',
    // Planner
    plannerTitle: 'Savings Planner',
    plannerSub: 'Set a realistic savings goal',
    goalType: 'What are you saving for?',
    emergency: 'Emergency Fund',
    education: 'Education / Books',
    family: 'Family Support',
    device: 'New Device',
    targetAmount: 'How much do you want to save?',
    timeline: 'Over how many months?',
    months: 'months',
    planOptions: '3 Realistic Plans',
    successChance: 'Chance of success',
    perMonth: '/ month',
    duration: 'Duration',
    tradeoff: 'What to consider',
    savePlan: 'Choose This Plan',
    planSaved: 'Plan saved! No money was moved.',
    savedPlans: 'My Plans',
    target: 'Target',
    // Cashout
    cashoutTitle: 'Cash-Out Fee Analysis',
    cashoutSub: 'How much are you paying to withdraw from agents?',
    totalFees: 'Total fees paid',
    couldSave: 'Could save by going digital',
    cashoutCount: 'withdrawals made',
    digitalEligible: 'Could be done digitally',
    repeatAgents: 'Agents You Use Repeatedly',
    agentId: 'Agent',
    withdrawals: 'withdrawals',
    totalFee: 'Total fee',
    saveable: 'Saveable',
    noPatterns: 'No repeated patterns found.',
    // Chat
    chatWelcome: 'Hello! I\'m Sathi — your personal money companion. I can help you understand your spending, predict cash shortfalls, and plan your savings. Tap any question below or type your own.',
    chatStarters: [
      'How much can I safely spend now?',
      'Will I run out of money this week?',
      'How can I save ৳10,000?',
      'How do I reduce cash-out fees?',
    ],
    chatPlaceholder: 'Type a question… e.g. How much can I spend today?',
    listening: 'Listening…',
    aiLabel: 'Sathi',
    verified: 'Verified data',
    guardrail: '🔒 Sathi never moves money automatically or approves loans. You are always in control.',
  },
};

export default function SathiApp() {
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [isOffline, setIsOffline] = useState<boolean>(true);
  const [language, setLanguage] = useState<Language>('bn');
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [bundle, setBundle] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [evidenceModalData, setEvidenceModalData] = useState<Evidence | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Planner states
  const [goalType, setGoalType] = useState<string>('emergency_fund');
  const [targetPaisa, setTargetPaisa] = useState<number>(1000000);
  const [targetMonths, setTargetMonths] = useState<number>(6);
  const [savedGoals, setSavedGoals] = useState<any[]>([]);
  const [goalNotice, setGoalNotice] = useState<string | null>(null);

  const isBn = language === 'bn';
  const t = T[language];

  // Chat states
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; evidence?: Evidence }>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);

  // Initialize welcome message based on language
  useEffect(() => {
    setChatMessages([{ sender: 'assistant', text: t.chatWelcome }]);
  }, [language]);

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

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
      title: isBn ? option.title_bn : (option.title_en || option.title_bn),
      target_display: bundle?.goal_plan?.data?.target_display || '৳১০,০০০',
      monthly_display: option.monthly_contribution_display,
      months: option.months,
      date: new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-US'),
    };
    setSavedGoals((prev) => [newGoal, ...prev]);
    setGoalNotice(t.planSaved);
    setTimeout(() => setGoalNotice(null), 5000);
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    const userMsg = { sender: 'user' as const, text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');

    // Smart contextual response
    setTimeout(() => {
      let reply = '';
      const summary = bundle?.summary?.data;
      const forecast = bundle?.forecast?.data;
      const cashout = bundle?.cashout?.data;
      const s2s = summary?.safe_to_spend;

      const lc = text.toLowerCase();
      const isAboutSpending = isBn
        ? (text.includes('খরচ') || text.includes('কত টাকা') || text.includes('নিরাপদ') || text.includes('ব্যালেন্স'))
        : (lc.includes('spend') || lc.includes('safe') || lc.includes('balance') || lc.includes('much'));

      const isAboutShortfall = isBn
        ? (text.includes('টানাটানি') || text.includes('পূর্বাভাস') || text.includes('সামনে') || text.includes('শেষ হবে'))
        : (lc.includes('short') || lc.includes('run out') || lc.includes('forecast') || lc.includes('week'));

      const isAboutFee = isBn
        ? (text.includes('ক্যাশ') || text.includes('ফি') || text.includes('এজেন্ট'))
        : (lc.includes('fee') || lc.includes('cash') || lc.includes('agent') || lc.includes('withdraw'));

      const isAboutSavings = isBn
        ? (text.includes('সঞ্চয়') || text.includes('জমানো') || text.includes('লক্ষ্য') || text.includes('হাজার'))
        : (lc.includes('save') || lc.includes('saving') || lc.includes('goal') || lc.includes('thousand'));

      if (isAboutSpending) {
        if (isBn) {
          reply = `আপনার ওয়ালেটে এখন ${summary?.balance_display || '৳১৫,৪২০'} আছে এবং হাতে নগদ আনুমানিক ${summary?.cash_on_hand?.estimated_cash_display || '৳১,২০০'}। আগামী ১৪ দিনের সব জরুরি বিল মিটিয়ে আপনি নিরাপদে ${s2s?.safe_to_spend_total_display || '৳৬,৫০০'} খরচ করতে পারবেন — অর্থাৎ প্রতিদিন ${s2s?.daily_safe_budget_display || '৳৪৬০'}।`;
        } else {
          reply = `Your wallet has ${summary?.balance_display || '৳15,420'} and you have about ${summary?.cash_on_hand?.estimated_cash_display || '৳1,200'} in cash. After covering all upcoming bills for the next 14 days, you can safely spend ${s2s?.safe_to_spend_total_display || '৳6,500'} — that's about ${s2s?.daily_safe_budget_display || '৳460'} per day.`;
        }
      } else if (isAboutShortfall) {
        if (isBn) {
          reply = `আগামী ${forecast?.horizon_days || 14} দিনে টাকা কম পড়ার সম্ভাবনা ${forecast?.shortfall_prob_display || '৩৫%'}। ${forecast?.trough_date ? `${forecast.trough_date} নাগাদ` : 'পরের সপ্তাহ নাগাদ'} একটু সতর্ক থাকা ভালো। এই সময়ে অপ্রয়োজনীয় খরচ কমিয়ে রাখুন।`;
        } else {
          reply = `Over the next ${forecast?.horizon_days || 14} days, there's a ${forecast?.shortfall_prob_display || '35%'} chance of running short. ${forecast?.trough_date ? `Around ${forecast.trough_date}` : 'Around next week'}, be a bit careful with spending. Try to cut unnecessary expenses during this time.`;
        }
      } else if (isAboutFee) {
        if (isBn) {
          reply = `আপনি এজেন্ট থেকে ক্যাশ-আউট না করে সরাসরি মোবাইল ব্যাংকিং দিয়ে পেমেন্ট করলে আনুমানিক ${cashout?.replaceable_fee_saved_display || '৳৩৫০'} ফি বাঁচাতে পারতেন। বাজারে কেনাকাটা, ইউটিলিটি বিল সব মোবাইলেই দেওয়া যায়।`;
        } else {
          reply = `If you made payments directly via mobile banking instead of cash-out from agents, you could save about ${cashout?.replaceable_fee_saved_display || '৳350'} in fees. Market purchases, utility bills — all can be paid digitally.`;
        }
      } else if (isAboutSavings) {
        if (isBn) {
          reply = `সঞ্চয়ের সবচেয়ে সহজ উপায় হলো বেতন বা আয় পাওয়ার সাথে সাথে একটি নির্দিষ্ট পরিমাণ সরিয়ে রাখা। 'পরিকল্পনা' ট্যাবে গিয়ে আপনার লক্ষ্য ঠিক করলে আমি বলব কত টাকা মাসে জমালে কতদিনে সেই লক্ষ্যে পৌঁছানো যাবে।`;
        } else {
          reply = `The easiest way to save is to set aside a fixed amount as soon as your income arrives. Go to the 'Planner' tab to set a goal, and I'll tell you exactly how much to save each month to reach your target.`;
        }
      } else {
        if (isBn) {
          reply = `আমি টাকা স্থানান্তর বা ঋণের সিদ্ধান্ত নিতে পারি না। তবে আপনার নিরাপদ ব্যয়ের সীমা জানাতে, টাকা কম পড়ার পূর্বাভাস দিতে, ফি বিশ্লেষণ করতে এবং সঞ্চয় পরিকল্পনা করতে আমি সর্বদা প্রস্তুত।`;
        } else {
          reply = `I can't transfer money or approve loans. But I'm always ready to help you know your safe spending limit, forecast cash shortfalls, analyze fees, and plan your savings. What would you like to know?`;
        }
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: reply,
          evidence: bundle?.summary?.evidence,
        },
      ]);
    }, 500);
  };

  if (loading && !bundle) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-base)', gap: '16px' }}>
        <RefreshCw size={32} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t.loading}</p>
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

  // ─── Status helper ───
  const statusLabel = safeToSpend?.status === 'comfortable' ? t.comfortable
    : safeToSpend?.status === 'cautious' ? t.cautious : t.tight;
  const statusColor = safeToSpend?.status === 'comfortable' ? 'var(--state-success)'
    : safeToSpend?.status === 'cautious' ? 'var(--state-caution)' : 'var(--state-error)';
  const statusBg = safeToSpend?.status === 'comfortable' ? 'rgba(22,163,74,0.1)'
    : safeToSpend?.status === 'cautious' ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)';

  const riskLabel = forecast?.risk_level === 'high' ? t.riskHigh
    : forecast?.risk_level === 'medium' ? t.riskMedium : t.riskLow;
  const riskColor = forecast?.risk_level === 'high' ? 'var(--state-error)'
    : forecast?.risk_level === 'medium' ? 'var(--state-caution)' : 'var(--state-success)';
  const riskBg = forecast?.risk_level === 'high' ? 'rgba(220,38,38,0.1)'
    : forecast?.risk_level === 'medium' ? 'rgba(217,119,6,0.1)' : 'rgba(22,163,74,0.1)';

  const goalTypes = [
    { id: 'emergency_fund', label: t.emergency },
    { id: 'education', label: t.education },
    { id: 'family_support', label: t.family },
    { id: 'device_purchase', label: t.device },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-grouped)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))' }}>
      {/* Sticky Top Header with Persona Selector */}
      <PersonaPicker
        users={users}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        isOffline={isOffline}
        onToggleOffline={() => setIsOffline(!isOffline)}
        language={language}
        onToggleLanguage={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
      />

      <main style={{ maxWidth: '540px', margin: '0 auto', padding: '16px' }}>

        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW */}
        {/* ============================================================== */}
        {currentTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* 1. SAFE-TO-SPEND HERO CARD */}
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
              {/* Subtle accent stripe */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, var(--accent-primary), #38BDF8)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={18} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t.safeSpend}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: statusBg,
                    color: statusColor,
                    fontWeight: 700,
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 6px 0' }}>
                <h1 style={{ fontSize: '2.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>
                  {safeToSpend?.safe_to_spend_total_display || summary?.balance_display || '৳৮,৪২০'}
                </h1>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {safeToSpend?.daily_safe_budget_display || '৳৬০০'} {t.perDay}
              </p>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
                {t.safeSpendSub}
              </p>

              {/* Breakdown grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-default)',
                fontSize: '0.78rem',
                marginBottom: '12px',
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>{t.walletBalance}</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{summary?.balance_display || '৳১৫,৪২০'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>{t.cashInHand}</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{cashOnHand?.estimated_cash_display || '৳১,২২৫'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>{t.upcomingBills}</span>
                  <strong style={{ color: 'var(--state-caution)', fontSize: '0.95rem' }}>-{safeToSpend?.upcoming_commitments_display || '৳৪,০০০'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>{t.safetyBuffer}</span>
                  <strong style={{ color: 'var(--state-success)', fontSize: '0.95rem' }}>{safeToSpend?.safety_buffer_display || '৳১,৫০০'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {summary?.as_of_date ? `${t.updatedOn} ${summary.as_of_date}` : ''}
                </span>
                <button
                  id="verify-evidence-btn"
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
                  <ShieldCheck size={12} />
                  <span>{t.verifyData}</span>
                </button>
              </div>
            </div>

            {/* 2. CORE METRICS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                {
                  label: t.monthlyIncome,
                  sub: t.regularIncome,
                  value: metrics?.monthly_income_display || '৳২০,০০০',
                  color: 'var(--state-success)',
                  icon: <ArrowDownLeft size={16} />,
                  bg: 'rgba(22,163,74,0.08)',
                },
                {
                  label: t.monthlySpend,
                  sub: t.dailyExpenses,
                  value: metrics?.monthly_spend_display || '৳১৭,৫০০',
                  color: 'var(--text-primary)',
                  icon: <ArrowUpRight size={16} />,
                  bg: 'rgba(15,23,42,0.04)',
                },
                {
                  label: t.bufferDays,
                  sub: t.emergencyDays,
                  value: `${metrics?.buffer_days_display || '৭'} ${isBn ? 'দিন' : 'd'}`,
                  color: 'var(--state-caution)',
                  icon: <Calendar size={16} />,
                  bg: 'rgba(217,119,6,0.08)',
                },
                {
                  label: t.feeSavable,
                  sub: t.digitalSavings,
                  value: metrics?.fee_leakage_display || '৳৩৫০',
                  color: 'var(--accent-primary)',
                  icon: <Coins size={16} />,
                  bg: 'rgba(2,132,199,0.08)',
                },
              ].map((m, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>
                      {m.icon}
                    </div>
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: m.color, marginBottom: '2px' }}>{m.value}</p>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.sub}</span>
                </div>
              ))}
            </div>

            {/* 3. AUTO-DETECTED RECURRING */}
            {recurring && (recurring.outflows?.length > 0 || recurring.inflows?.length > 0) && (
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.recurringTitle}</h3>
                  </div>
                  <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'var(--accent-tint)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {t.recurringSubtitle}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recurring.inflows?.map((inf: any) => (
                    <div key={inf.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{isBn ? inf.title_bn : (inf.title_en || inf.title_bn)}</span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {inf.periodicity === 'monthly' ? t.monthlyLabel : t.weeklyLabel} • {t.nextExpected}: {inf.next_expected_date}
                        </p>
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--state-success)' }}>+{inf.amount_display}</span>
                    </div>
                  ))}
                  {recurring.outflows?.slice(0, 3).map((out: any) => (
                    <div key={out.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{isBn ? out.title_bn : (out.title_en || out.title_bn)}</span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {out.periodicity === 'monthly' ? t.monthlyLabel : t.weeklyLabel} • {t.nextExpected}: {out.next_expected_date}
                        </p>
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--state-caution)' }}>-{out.amount_display}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. INSIGHTS */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Lightbulb size={18} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.insightsTitle}</h3>
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
                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--accent-tint)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {ins.label === 'Data'
                            ? (isBn ? '📊 তথ্য' : '📊 Data')
                            : ins.label === 'Prediction'
                              ? (isBn ? '🔮 পূর্বাভাস' : '🔮 Prediction')
                              : (isBn ? '💡 পরামর্শ' : '💡 Tip')}
                        </span>
                        <button onClick={() => handleOpenEvidence(bundle?.summary?.evidence)} style={{ color: 'var(--text-muted)', background: 'transparent' }}>
                          <Info size={14} />
                        </button>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                        {isBn ? ins.text_bn : (ins.text_en || ins.text_bn)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {isBn
                      ? `আপনার বর্তমান ব্যালেন্স দিয়ে প্রায় ${metrics?.buffer_days_display || '৭'} দিনের খরচ চলবে।`
                      : `Your current balance covers about ${metrics?.buffer_days_display || '7'} days of expenses.`}
                  </p>
                )}
              </div>
            </div>

            {/* 5. CATEGORY BREAKDOWN */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                {t.whereMoneyGoes}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {categories.slice(0, 5).map((cat: any, idx: number) => {
                  const pct = Math.round(cat.share * 100);
                  const colors = ['var(--accent-primary)', 'var(--state-caution)', '#6366F1', 'var(--state-success)', '#EC4899'];
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '5px' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{isBn ? cat.label_bn : (cat.label_en || cat.label_bn)}</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {cat.total_display} ({cat.share_display || `${pct}%`})
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            height: '100%',
                            backgroundColor: colors[idx] || 'var(--accent-primary)',
                            borderRadius: 'var(--radius-full)',
                            transition: 'width 0.6s ease',
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
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.recentTxns}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            backgroundColor: isInflow ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isInflow ? 'var(--state-success)' : 'var(--state-error)',
                            flexShrink: 0,
                          }}
                        >
                          {isInflow ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isBn ? (txn.category?.label_bn || txn.type) : (txn.category?.label_en || txn.category?.label_bn || txn.type)}
                          </p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {isBn ? (txn.category?.reason_bn || txn.ts?.split('T')[0]) : (txn.category?.reason_en || txn.category?.reason_bn || txn.ts?.split('T')[0])}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.9rem', fontWeight: 700, color: isInflow ? 'var(--state-success)' : 'var(--text-primary)' }}>
                          {isInflow ? '+' : '-'}{txn.amount_display}
                        </p>
                        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {t.balanceAfter}: {txn.balance_after_display}
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
        {/* TAB 2: FORECAST */}
        {/* ============================================================== */}
        {currentTab === 'forecast' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* 1. Main Risk Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-default)',
                padding: '22px 20px',
                boxShadow: 'var(--shadow-md)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: riskColor }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {t.forecastTitle} ({isBn ? `${forecast?.horizon_days || 14} দিন` : `${forecast?.horizon_days || 14} days`})
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: riskBg,
                    color: riskColor,
                    fontWeight: 700,
                  }}
                >
                  {riskLabel}
                </span>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.shortfallChance}</span>
                <h2 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>
                  {forecast?.shortfall_prob_display || '৩৫%'}
                </h2>
              </div>

              {forecast?.trough_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(217,119,6,0.08)', marginTop: '10px' }}>
                  <Calendar size={15} color="var(--state-caution)" />
                  <span style={{ fontSize: '0.82rem', color: 'var(--state-caution)', fontWeight: 500 }}>
                    {t.lowestBalDate}: {forecast.trough_date}
                  </span>
                </div>
              )}
            </div>

            {/* 2. AI vs Basic comparison — beginner friendly */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Award size={18} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.aiVsBasic}</h3>
                  </div>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(22,163,74,0.12)', color: 'var(--state-success)', fontWeight: 700 }}>
                    {benchmark.brier_score?.brier_skill_percentage_display || '+33.9%'} {t.aiMoreAccurate}
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.55 }}>
                  {t.aiExplain}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.bssLabel}</span>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--state-success)' }}>
                      {benchmark.brier_score?.brier_skill_percentage_display || '+33.9%'}
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>{t.bssExplain}</span>
                  </div>
                  <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(2,132,199,0.06)', border: '1px solid rgba(2,132,199,0.2)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.earlyWarning}</span>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>
                      0.92 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>vs 0.65</span>
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--state-success)', display: 'block', marginTop: '2px' }}>{t.earlyWarningExplain}</span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{t.keyFactors}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {benchmark.interpretability?.top_features?.map((f: any, idx: number) => (
                      <span key={idx} style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {isBn ? f.description_bn : (f.description_en || f.description_bn)} ({f.importance_pct}%)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Daily Forecast — simple labels */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.dailyForecastTitle}</h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{t.dailyForecastSub}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                      <span style={{ color: 'var(--text-secondary)', width: '48px', fontWeight: 500 }}>{dayName}</span>
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around', color: 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{d.p10_display}</span>
                        <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{d.p50_display}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{d.p90_display}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coach advice */}
            <div style={{ backgroundColor: 'rgba(2,132,199,0.06)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2,132,199,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Lightbulb size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.coachAdvice}</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t.forecastAdvice}</p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: GOAL PLANNER */}
        {/* ============================================================== */}
        {currentTab === 'planner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Target size={20} color="var(--accent-primary)" />
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.plannerTitle}</h2>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t.plannerSub}</p>
                </div>
              </div>

              {/* Goal type */}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>{t.goalType}</p>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
                {goalTypes.map((gt) => (
                  <button
                    key={gt.id}
                    onClick={() => setGoalType(gt.id)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: goalType === gt.id ? 'var(--accent-primary)' : 'var(--bg-surface-raised)',
                      border: goalType === gt.id ? 'none' : '1px solid var(--border-default)',
                      color: goalType === gt.id ? '#FFF' : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontWeight: goalType === gt.id ? 700 : 400,
                      flexShrink: 0,
                    }}
                  >
                    {gt.label}
                  </button>
                ))}
              </div>

              {/* Target amount */}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>{t.targetAmount}</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
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
                      padding: '8px 0',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: targetPaisa === chip.paisa ? 'var(--accent-primary)' : 'var(--bg-surface-raised)',
                      color: targetPaisa === chip.paisa ? '#FFF' : 'var(--text-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: targetPaisa === chip.paisa ? 'none' : '1px solid var(--border-default)',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Months slider */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t.timeline}</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{targetMonths} {t.months}</span>
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

            {/* Success notice */}
            {goalNotice && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', color: 'var(--state-success)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} />
                {goalNotice}
              </div>
            )}

            {/* Plan options */}
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.planOptions}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {goalPlan?.options?.map((opt: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: idx === 1 ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: idx === 1 ? '0 4px 12px rgba(2,132,199,0.12)' : 'var(--shadow-sm)',
                    }}
                  >
                    {idx === 1 && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                        {isBn ? '⭐ প্রস্তাবিত' : '⭐ Recommended'}
                      </span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {isBn ? opt.title_bn : (opt.title_en || opt.title_bn)}
                      </span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(22,163,74,0.12)', color: 'var(--state-success)', fontWeight: 600 }}>
                        {t.successChance}: {opt.p_goal_met_display}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                        {opt.monthly_contribution_display}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 400 }}> {t.perMonth}</span>
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.duration}: {opt.months} {t.months}</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {t.tradeoff}: {isBn ? opt.tradeoff_bn : (opt.tradeoff_en || opt.tradeoff_bn)}
                    </p>
                    <button
                      onClick={() => handleSaveGoal(opt)}
                      style={{
                        marginTop: '4px',
                        padding: '9px 0',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: idx === 1 ? 'var(--accent-primary)' : 'var(--bg-surface-raised)',
                        border: idx === 1 ? 'none' : '1px solid var(--border-default)',
                        color: idx === 1 ? '#FFF' : 'var(--text-primary)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                      }}
                    >
                      {t.savePlan}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved goals */}
            {savedGoals.length > 0 && (
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>{t.savedPlans}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedGoals.map((g) => (
                    <div key={g.id} style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{g.title}</strong>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{t.target}: {g.target_display} ({g.months} {t.months})</p>
                      </div>
                      <span style={{ color: 'var(--state-success)', fontWeight: 700 }}>{g.monthly_display}{t.perMonth}</span>
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
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-default)',
                padding: '20px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Receipt size={20} color="var(--state-caution)" />
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.cashoutTitle}</h2>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>{t.cashoutSub}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.totalFees}</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--state-caution)' }}>{cashout?.total_fees_display || '৳৫২০'}</p>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{cashout?.total_cashouts || 12} {t.cashoutCount}</span>
                </div>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.couldSave}</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--state-success)' }}>{cashout?.replaceable_fee_saved_display || '৳৩৫০'}</p>
                  <span style={{ fontSize: '0.68rem', color: 'var(--state-success)' }}>{t.digitalEligible}</span>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.repeatAgents}</h3>
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
                          {t.agentId}: {p.counterparty_id}
                        </strong>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {p.count} {t.withdrawals} ({p.total_amount_display})
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--state-caution)', fontSize: '0.85rem', fontWeight: 700 }}>{t.totalFee}: {p.total_fee_display}</span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--state-success)' }}>{t.saveable}: {p.replaceable_fee_saved_display}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t.noPatterns}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: SATHI AI CHAT */}
        {/* ============================================================== */}
        {currentTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 'calc(100vh - 200px)' }}>

            {/* Starter Chips */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {t.chatStarters.map((starter: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(starter)}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.76rem',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-sm)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '4px 0',
                minHeight: '300px',
              }}
            >
              {chatMessages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={idx}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      backgroundColor: isUser ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      border: isUser ? 'none' : '1px solid var(--border-default)',
                      borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      padding: '12px 14px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {!isUser && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'linear-gradient(135deg, #0284C7, #0369A1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#FFF', fontWeight: 800 }}>সা</div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{t.aiLabel}</span>
                      </div>
                    )}
                    <p style={{ fontSize: '0.88rem', color: isUser ? '#FFFFFF' : 'var(--text-primary)', lineHeight: 1.55 }}>
                      {msg.text}
                    </p>
                    {msg.evidence && !isUser && (
                      <div style={{ marginTop: '6px' }}>
                        <button
                          onClick={() => handleOpenEvidence(msg.evidence)}
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--accent-primary)',
                            background: 'var(--accent-tint)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid rgba(2,132,199,0.2)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <ShieldCheck size={11} />
                          {t.verified}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input Composer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-strong)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <button
                id="voice-btn"
                onClick={() => {
                  setIsVoiceActive(!isVoiceActive);
                  if (!isVoiceActive) {
                    setTimeout(() => {
                      setIsVoiceActive(false);
                      handleSendMessage(isBn ? 'সামনের সপ্তাহে কোনো টানাটানি আছে কি?' : 'Will I run short of money this week?');
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
                  color: isVoiceActive ? '#FFF' : 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                  flexShrink: 0,
                }}
                title={isBn ? 'ভয়েস ইনপুট' : 'Voice input'}
              >
                <Mic size={17} />
              </button>

              <input
                id="chat-input"
                type="text"
                placeholder={isVoiceActive ? t.listening : t.chatPlaceholder}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  minWidth: 0,
                }}
              />

              <button
                id="chat-send-btn"
                onClick={() => handleSendMessage()}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFF',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
                  flexShrink: 0,
                }}
              >
                <Send size={16} />
              </button>
            </div>

            {/* Guardrail */}
            <div style={{ textAlign: 'center', paddingBottom: '4px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.guardrail}</span>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Tab Bar */}
      <TabBar currentTab={currentTab} onTabChange={setCurrentTab} language={language} />

      {/* Evidence Modal */}
      <EvidenceModal
        evidence={evidenceModalData}
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
      />
    </div>
  );
}
