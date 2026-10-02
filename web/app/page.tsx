'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, AlertTriangle, CheckCircle, Calendar, Sparkles,
  ArrowUpRight, ArrowDownLeft, Target, Receipt, Mic, Send, Info,
  Clock, RefreshCw, ShieldCheck, Coins, Award, Lightbulb,
  Zap, Bell, TrendingDown, ChevronRight, CircleDollarSign,
  Sun, Moon, Volume2,
} from 'lucide-react';
import { TabBar, TabType } from '../components/TabBar';
import { PersonaPicker, Language, Theme } from '../components/PersonaPicker';
import { EvidenceModal } from '../components/EvidenceModal';
import {
  DemoUser, Evidence, fetchDemoUsers, fetchPersonaBundle,
  fetchBenchmark, loginDemoUser, sendChatMessage,
} from '../lib/api';

// ── Complete Bilingual Translation Dictionary ──
const T = {
  bn: {
    loading: 'সাথী চালু হচ্ছে…',
    track: 'ট্র্যাক ০৩ — আর্থিক স্বাধীনতা ও গ্রাহক উদ্ভাবন',
    // Overview
    leftToSpend: 'নিরাপদে খরচ করতে পারবেন',
    ofBudget: 'আসন্ন বিলের তুলনায়',
    perDay: '/দিন',
    status_comfortable: '✅ স্বাচ্ছন্দ্যময়',
    status_cautious: '⚠️ সতর্ক থাকুন',
    status_tight: '🔴 টানাটানি',
    status_deficit: '🚨 ঘাটতির ঝুঁকি',
    deficitTitle: 'ঘাটতির সতর্কতা',
    deficitBody: 'আগামী ১৪ দিনে আবশ্যক বিল ও খরচের তুলনায় ওয়ালেটে পর্যাপ্ত টাকা নেই। অপ্রয়োজনীয় খরচ এখনই কমান।',
    actionsFound: 'টি পদক্ষেপ যা আপনার অর্থ বাঁচাতে পারে',
    walletBalance: 'ওয়ালেট ব্যালেন্স',
    cashInHand: 'হাতে নগদ',
    upcoming: 'আসন্ন বিল',
    buffer: 'জরুরি বাফার',
    cashInHandNote: 'সাথী ক্যাশ-আউটের ইতিহাস বিশ্লেষণ করে হাতে নগদের পরিমাণ বৈজ্ঞানিক মডেলে অনুমান করে।',
    monthlyIncome: 'মাসিক গড় আয়',
    monthlySpend: 'মাসিক গড় খরচ',
    bufferDays: 'জরুরি দিন',
    feeSavable: 'ফি সাশ্রয় সম্ভব',
    verifyData: 'যাচাই করুন',
    updatedOn: 'হালনাগাদ',
    proactiveTitle: 'সক্রিয় পরামর্শ (Always-on Advice)',
    recurringTitle: 'নিয়মিত আয় ও বিল',
    recurringAuto: 'স্বয়ংক্রিয়ভাবে শনাক্ত',
    monthly: 'মাসিক',
    weekly: 'সাপ্তাহিক',
    next: 'পরবর্তী',
    whereMoneyGoes: 'কোথায় যাচ্ছে টাকা?',
    recentTxns: 'সাম্প্রতিক লেনদেন',
    balanceAfter: 'ব্যালেন্স',
    // Forecast
    forecastTitle: 'নগদ প্রবাহের পূর্বাভাস (AI Forecast)',
    shortfallChance: 'টাকা কম পড়ার আশঙ্কা',
    riskHigh: '🚨 সাবধান! ঝুঁকি বেশি',
    riskMedium: '⚠️ কিছুটা সতর্ক থাকুন',
    riskLow: '✅ আপনি সুরক্ষিত আছেন',
    troughDate: 'সর্বনিম্ন ব্যালেন্সের সম্ভাব্য তারিখ',
    aiVsBasic: 'সাথী AI বনাম সাধারণ গড় হিসাব',
    aiMoreAccurate: 'বেশি নির্ভুল',
    aiExplain: 'বাস্তব প্রমাণ — সাথীর লাইটজিবিএম কোয়ান্টাইল মডেল সাধারণ গড়ের চেয়ে অনেক নিখুঁত:',
    bssLabel: 'ব্রায়ার স্কোর উন্নতি',
    bssDesc: 'সাধারণ গড়ের চেয়ে এগিয়ে',
    earlyWarn: '৭ দিন পূর্বে সতর্কতা',
    earlyWarnPerf: 'উচ্চ নির্ভুলতা',
    keyFactors: 'AI যে বিষয়গুলো বিবেচনা করে',
    dailyForecast: 'প্রতিদিনের ব্যালেন্সের প্রজেকশন',
    low: 'সতর্ক (P10)',
    likely: 'সম্ভাব্য (P50)',
    high: 'আশাবাদী (P90)',
    noForecast: 'পূর্বাভাস পাওয়া যায়নি।',
    coachTip: '💡 কোচের আর্থিক পরামর্শ',
    forecastTip: 'মাসের শেষ সপ্তাহের আর্থিক চাপ এড়াতে বড় খরচগুলো বেতন পাওয়ার পরপরই পরিশোধ করুন।',
    // Planner
    plannerTitle: 'সঞ্চয় ও সম্পদ পরিকল্পনা (Planner)',
    plannerSub: 'বাস্তবসম্মত লক্ষ্য ঠিক করুন এবং অগ্রগতি ট্র্যাক করুন',
    goalFor: 'কীসের জন্য সঞ্চয় করছেন?',
    emergency: '🆘 জরুরি তহবিল',
    education: '📚 শিক্ষা খরচ',
    family: '👨‍👩‍👧 পরিবারের সহায়তা',
    device: '📱 স্মার্ট ডিভাইস',
    howMuch: 'লক্ষ্যের পরিমাণ কত?',
    howLong: 'কত মাসের মধ্যে পৌঁছাতে চান?',
    months: 'মাস',
    plans: 'সাথীর বাস্তবসম্মত পরিকল্পনা',
    successChance: 'সফলতার সম্ভাবনা',
    perMonth: '/ মাস',
    duration: 'সময়কাল',
    tradeoff: 'বিবেচ্য বিষয়',
    choosePlan: 'এই পরিকল্পনা বেছে নিন',
    planSaved: '✅ পরিকল্পনা সংরক্ষিত! আপনার অ্যাকাউন্ট থেকে কোনো টাকা কাটা হয়নি।',
    savedPlans: 'আমার সংরক্ষিত পরিকল্পনা',
    target: 'লক্ষ্য',
    recommended: '⭐ সবচেয়ে বাস্তবসম্মত',
    feasibility: 'সাথী AI-এর মূল্যায়ন',
    noPlan: 'উপরে একটি লক্ষ্য নির্বাচন করুন।',
    // Cashout
    cashoutTitle: 'ক্যাশ-আউট ফি অডিট ও সাশ্রয়',
    cashoutSub: 'এজেন্টদের অপ্রয়োজনীয় ফি দেওয়া বন্ধ করুন',
    totalFees: 'প্রদত্ত মোট ক্যাশ-আউট ফি',
    couldSave: 'ডিজিটালে বাঁচানো যেত',
    cashouts: 'বার টাকা তুলেছেন',
    digitalOk: 'টি ডিজিটালে সম্ভব ছিল',
    annualSave: 'বার্ষিক সম্ভাব্য সাশ্রয়',
    annualNote: 'সরাসরি মার্চেন্ট কিউআর ও বিল পেমেন্ট ব্যবহার করলে',
    agents: 'নিয়মিত এজেন্ট পয়েন্ট',
    noPatterns: 'কোনো পুনরাবৃত্ত ক্যাশ-আউট প্যাটার্ন নেই।',
    digitalTip: '💡 ডিজিটাল সাশ্রয় টিপ',
    digitalTipBody: 'মুদি বাজার, ফার্মেসি, বিদ্যুৎ ও গ্যাস বিল সরাসরি মোবাইল ব্যাংকিং অ্যাপ থেকে পরিশোধ করুন। এতে কোনো ফি নেই।',
    // Chat
    chatWelcome: 'আস-সালামু আলাইকুম! আমি সাথী — আপনার AI আর্থিক বন্ধু।\n\nআমি আপনাকে সাহায্য করতে পারি:\n• নিরাপদে কত টাকা খরচ করতে পারবেন\n• আগামী ২১ দিনে টাকার সমস্যা হবে কিনা\n• ক্যাশ-আউট ফি কীভাবে বাঁচাবেন\n• আপনার সঞ্চয় লক্ষ্য অর্জন করার সহজ উপায়\n\nযেকোনো প্রশ্ন নিচে লিখুন বা বাটন চাপুন।',
    starters: ['এখন নিরাপদে কত খরচ করতে পারব?', 'সামনের সপ্তাহে কি কোনো টানাটানি আছে?', '১০ হাজার টাকা কীভাবে জমাব?', 'ক্যাশ-আউট ফি কমাব কীভাবে?'],
    placeholder: 'সাথীকে প্রশ্ন করুন…',
    listening: 'শুনছি, বলুন…',
    aiName: 'সাথী AI',
    verified: 'যাচাইকৃত হিসাব',
    thinking: 'হিসাব বিশ্লেষণ হচ্ছে…',
    guardrail: '🔒 সাথী কোনো অর্থ স্থানান্তর করে না — আপনার তথ্য সম্পূর্ণ সুরক্ষিত।',
  },
  en: {
    loading: 'Starting Sathi…',
    track: 'Track 03 — Financial Independence & Customer Innovation',
    leftToSpend: 'Left to spend safely',
    ofBudget: 'after upcoming bills',
    perDay: '/day',
    status_comfortable: '✅ Comfortable',
    status_cautious: '⚠️ Be Cautious',
    status_tight: '🔴 Tight Budget',
    status_deficit: '🚨 Deficit Risk',
    deficitTitle: 'Deficit Warning',
    deficitBody: 'Upcoming bills exceed your wallet funds for the next 14 days. Limit discretionary spending immediately.',
    actionsFound: 'actions found that can save you money',
    walletBalance: 'Wallet Balance',
    cashInHand: 'Cash in Hand',
    upcoming: 'Upcoming Bills',
    buffer: 'Safe Buffer',
    cashInHandNote: 'Sathi estimates cash-in-hand scientifically by modeling ATM/agent withdrawal rhythms over time.',
    monthlyIncome: 'Monthly Income',
    monthlySpend: 'Monthly Spend',
    bufferDays: 'Buffer Days',
    feeSavable: 'Fees Savable',
    verifyData: 'Verify Data',
    updatedOn: 'Updated',
    proactiveTitle: 'Proactive Advice (Always-on)',
    recurringTitle: 'Recurring Income & Bills',
    recurringAuto: 'Auto-detected',
    monthly: 'monthly',
    weekly: 'weekly',
    next: 'Next',
    whereMoneyGoes: 'Where is Money Going?',
    recentTxns: 'Recent Transactions',
    balanceAfter: 'Balance',
    // Forecast
    forecastTitle: 'Cash Flow Forecast (Quantile ML)',
    shortfallChance: 'Chance of Running Short',
    riskHigh: '🚨 Warning! High Risk',
    riskMedium: '⚠️ Stay Cautious',
    riskLow: '✅ Well Funded',
    troughDate: 'Expected Lowest Balance Date',
    aiVsBasic: 'Sathi AI vs Simple Rolling Average',
    aiMoreAccurate: 'more accurate',
    aiExplain: 'Empirical benchmark — Sathi’s LightGBM Quantile model significantly outperforms naive averages:',
    bssLabel: 'Brier Score Improvement',
    bssDesc: 'Ahead of rule baseline',
    earlyWarn: '7-Day Advance Notice',
    earlyWarnPerf: 'High Sensitivity',
    keyFactors: 'Key Factors AI Considers',
    dailyForecast: 'Daily Balance Projection',
    low: 'Cautious (P10)',
    likely: 'Likely (P50)',
    high: 'Optimistic (P90)',
    noForecast: 'Forecast not available.',
    coachTip: '💡 Coach Financial Tip',
    forecastTip: 'Pay major recurring bills right after salary arrival to avoid month-end cash squeezes.',
    // Planner
    plannerTitle: 'Savings & Wealth Planner',
    plannerSub: 'Set achievable targets and track feasibility dynamically',
    goalFor: 'What are you saving for?',
    emergency: '🆘 Emergency Fund',
    education: '📚 Education',
    family: '👨‍👩‍👧 Family Support',
    device: '📱 Tech Device',
    howMuch: 'Target Amount?',
    howLong: 'Target Timeline?',
    months: 'months',
    plans: 'Feasible Savings Plans',
    successChance: 'Chance of Success',
    perMonth: '/ mo',
    duration: 'Duration',
    tradeoff: 'Trade-off to Keep in Mind',
    choosePlan: 'Adopt This Plan',
    planSaved: '✅ Plan saved! No money was moved from your account.',
    savedPlans: 'My Active Plans',
    target: 'Target',
    recommended: '⭐ Recommended',
    feasibility: "Sathi's ML Assessment",
    noPlan: 'Select a goal category above to generate plans.',
    // Cashout
    cashoutTitle: 'Cash-Out Fee Audit & Optimizer',
    cashoutSub: 'Stop paying unnecessary agent withdrawal tariffs',
    totalFees: 'Total Cash-Out Fees Paid',
    couldSave: 'Could Have Saved Digitally',
    cashouts: 'withdrawals made',
    digitalOk: 'could have been digital QR',
    annualSave: 'Estimated Annual Savings',
    annualNote: 'By paying directly through merchant QR and in-app utility bills',
    agents: 'Top Repeat Agents',
    noPatterns: 'No repeated cash-out patterns found.',
    digitalTip: '💡 Digital Payment Tip',
    digitalTipBody: 'Groceries, medicines, and utility bills can be paid directly from your wallet with 0% withdrawal fees.',
    // Chat
    chatWelcome: "Hello! I'm Sathi — your AI financial companion.\n\nI can assist you with:\n• Calculating your exact safe-to-spend limit\n• Predicting cash crunches over the next 21 days\n• Optimizing and eliminating cash-out fees\n• Structuring practical savings goals\n\nAsk any question below or tap a quick chip.",
    starters: ['How much can I safely spend now?', 'Will I run short this week?', 'How do I save ৳10,000?', 'How do I reduce cash-out fees?'],
    placeholder: 'Ask Sathi anything…',
    listening: 'Listening… speak now',
    aiName: 'Sathi AI',
    verified: 'Verified Model',
    thinking: 'Analyzing data…',
    guardrail: '🔒 Sathi never moves money automatically. Your funds and privacy remain secure.',
  },
};

const CATEGORY_TITLES: Record<string, { bn: string; en: string }> = {
  salary:      { bn: 'মাসিক বেতন',         en: 'Monthly Salary' },
  cash_out:    { bn: 'নিয়মিত ক্যাশ-আউট',  en: 'Cash Withdrawal' },
  rent:        { bn: 'বাড়ি ভাড়া',          en: 'House Rent' },
  food:        { bn: 'খাবার ও বাজার',       en: 'Food & Groceries' },
  transport:   { bn: 'যাতায়াত',            en: 'Transport' },
  bills:       { bn: 'ইউটিলিটি বিল',        en: 'Utility Bills' },
  mobile:      { bn: 'মোবাইল রিচার্জ',      en: 'Mobile & Internet' },
  remittance:  { bn: 'রেমিট্যান্স',         en: 'Remittance' },
  business:    { bn: 'ব্যবসায়িক খরচ',      en: 'Business' },
  family:      { bn: 'পরিবারের খরচ',        en: 'Family Support' },
  other:       { bn: 'অন্যান্য',             en: 'Other' },
};

function humanTitle(item: { [k: string]: any }, isBn: boolean): string {
  const cat = String(item.category || '');
  const m = CATEGORY_TITLES[cat] as { bn: string; en: string } | undefined;
  if (m) return isBn ? m.bn : m.en;
  const raw = String(isBn ? (item.title_bn || '') : (item.title_en || item.title_bn || ''));
  if (raw && !raw.includes('(') && !raw.includes('Recurring Spend') && !raw.includes('নিয়মিত ব্যয়')) return raw;
  return isBn ? String(item.title_bn || cat) : String(item.title_en || item.title_bn || cat);
}

// ── Circular Budget Gauge (Origin Signature) ──
function BudgetGauge({ spent, total, label, sub }: { spent: number; total: number; label: string; sub: string }) {
  const pct = total > 0 ? Math.min(spent / total, 1) : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct > 0.85 ? 'var(--accent-red)' : pct > 0.65 ? 'var(--accent-amber)' : 'var(--accent-primary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <svg width="136" height="136" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--gauge-track)" strokeWidth="10" />
        <circle
          cx="68" cy="68" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', width: '100px' }}>
        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.2 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

export default function SathiApp() {
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [isOffline, setIsOffline] = useState(true);
  const [language, setLanguage] = useState<Language>('bn');
  const [theme, setTheme] = useState<Theme>('dark');
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [bundle, setBundle] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const [evidenceData, setEvidenceData] = useState<Evidence | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [showCashInfo, setShowCashInfo] = useState(false);

  // Planner states
  const [goalType, setGoalType] = useState('emergency_fund');
  const [targetPaisa, setTargetPaisa] = useState(1000000);
  const [targetMonths, setTargetMonths] = useState(6);
  const [savedGoals, setSavedGoals] = useState<any[]>([]);
  const [goalNotice, setGoalNotice] = useState<string | null>(null);

  // Chat states
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isBn = language === 'bn';
  const t = T[language];

  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; ev?: Evidence }>>([
    { sender: 'assistant', text: t.chatWelcome },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isVoice, setIsVoice] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // Theme synchronization on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('sathi-theme') as Theme | null;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('sathi-theme', nextTheme);
    } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Re-initialize welcome message on language change
  useEffect(() => {
    setChatMessages([{ sender: 'assistant', text: t.chatWelcome }]);
  }, [language]);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      const [demoUsers, bench] = await Promise.all([fetchDemoUsers(isOffline), fetchBenchmark(isOffline)]);
      setUsers(demoUsers);
      setBenchmark(bench);
      if (demoUsers.length > 0) {
        const u = demoUsers[0];
        setCurrentUser(u);
        const [pBundle, token] = await Promise.all([
          fetchPersonaBundle(u.persona),
          isOffline ? null : loginDemoUser(u.user_id),
        ]);
        setBundle(pBundle);
        setAuthToken(token);
      }
      setLoading(false);
    }
    init();
  }, [isOffline]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isThinking]);

  const handleSelectUser = async (user: DemoUser) => {
    setCurrentUser(user);
    setLoading(true);
    try {
      const [pBundle, token] = await Promise.all([
        fetchPersonaBundle(user.persona),
        isOffline ? null : loginDemoUser(user.user_id),
      ]);
      setBundle(pBundle);
      setAuthToken(token);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const openEvidence = (ev?: Evidence) => {
    setEvidenceData(ev || bundle?.summary?.evidence || null);
    setIsEvidenceOpen(true);
  };

  const handleSavePlan = (opt: any) => {
    setSavedGoals((p) => [
      {
        id: Date.now(),
        title: isBn ? opt.title_bn : (opt.title_en || opt.title_bn),
        target: bundle?.goal_plan?.data?.target_display || '৳১০,০০০',
        monthly: opt.monthly_contribution_display,
        months: opt.months,
      },
      ...p,
    ]);
    setGoalNotice(t.planSaved);
    setTimeout(() => setGoalNotice(null), 4000);
  };

  const sendMessage = async (txt?: string) => {
    const text = txt || chatInput;
    if (!text.trim()) return;
    setChatMessages((p) => [...p, { sender: 'user', text }]);
    setChatInput('');
    setIsThinking(true);

    // 1. If online and token is available, attempt live backend /v1/chat API
    if (!isOffline && authToken) {
      try {
        const apiRes = await sendChatMessage(authToken, text, language);
        if (apiRes && apiRes.reply) {
          setIsThinking(false);
          setChatMessages((p) => [
            ...p,
            { sender: 'assistant', text: apiRes.reply, ev: apiRes.evidence || bundle?.summary?.evidence },
          ]);
          return;
        }
      } catch {
        // fall through to client-side responder
      }
    }

    // 2. Client-side Grounded Copilot (handles offline mode or backend offline fallback)
    setTimeout(() => {
      setIsThinking(false);
      const s = bundle?.summary?.data;
      const f = bundle?.forecast?.data;
      const c = bundle?.cashout?.data;
      const s2s = s?.safe_to_spend;
      const lc = text.toLowerCase();

      const onGreeting = text.includes('সালাম') || text.includes('হ্যালো') || text.includes('কেমন') || lc.includes('hello') || lc.includes('hi') || lc.includes('hey') || lc.includes('salam');
      const onSpend = text.includes('খরচ') || text.includes('নিরাপদ') || text.includes('কত') || text.includes('ব্যালেন্স') || lc.includes('spend') || lc.includes('safe') || lc.includes('much') || lc.includes('balance') || lc.includes('budget');
      const onShort = text.includes('সমস্যা') || text.includes('টানাটানি') || text.includes('ঘাটতি') || text.includes('আগামী') || lc.includes('short') || lc.includes('run out') || lc.includes('risk') || lc.includes('forecast');
      const onFee = text.includes('ফি') || text.includes('ক্যাশ') || text.includes('এজেন্ট') || lc.includes('fee') || lc.includes('cash') || lc.includes('withdraw') || lc.includes('tariff');
      const onSave = text.includes('সঞ্চয়') || text.includes('জমা') || text.includes('লক্ষ্য') || text.includes('হাজার') || lc.includes('save') || lc.includes('saving') || lc.includes('goal') || lc.includes('plan');

      let reply = '';
      const deficit = s2s?.status === 'deficit';

      if (onGreeting) {
        reply = isBn
          ? `আস-সালামু আলাইকুম! আমি সাথী — আপনার AI আর্থিক বন্ধু। আপনার বর্তমান ওয়ালেট ব্যালেন্স ${s?.balance_display || '৳৫,১৩৫'}। নিরাপদে কত খরচ করা যাবে বা সঞ্চয়ের পরিকল্পনা জানতে আমাকে জিজ্ঞেস করতে পারেন।`
          : `Hello! I'm Sathi — your AI financial companion. Your current wallet balance is ${s?.balance_display || '৳5,135'}. Ask me about safe spending limits, cashflow forecast, or saving plans!`;
      } else if (onSpend) {
        reply = isBn
          ? (deficit
              ? `⚠️ আপনার ওয়ালেটে ${s?.balance_display || '৳৫,১৩৫'} আছে কিন্তু আগামী ১৪ দিনে ${s2s?.upcoming_commitments_display || '৳১০,৫৪৭'} বিল পরিশোধ করতে হবে। এই মুহূর্তে সব অপ্রয়োজনীয় খরচ সীমিত রাখুন।`
              : `আপনার ওয়ালেটে ${s?.balance_display || '৳৫,১৩৫'} এবং হাতে নগদ প্রায় ${s2s?.estimated_cash_display || '৳১,২২৫'}। সব আসন্ন বিল মিটিয়ে আপনি নিরাপদে মোট ${s2s?.safe_to_spend_total_display || '৳০'} খরচ করতে পারবেন — অর্থাৎ প্রতিদিন প্রায় ${s2s?.daily_safe_budget_display || '৳০'}।`)
          : (deficit
              ? `⚠️ Your wallet has ${s?.balance_display} but ${s2s?.upcoming_commitments_display} in bills is coming in the next 14 days. Limit discretionary spending right now.`
              : `Wallet: ${s?.balance_display}. Cash in hand: ~${s2s?.estimated_cash_display}. After factoring in upcoming bills, you can safely spend ${s2s?.safe_to_spend_total_display} — about ${s2s?.daily_safe_budget_display} per day.`);
      } else if (onShort) {
        reply = isBn
          ? `আগামী ${f?.horizon_days || 21} দিনে টাকা কম পড়ার আশঙ্কা ${f?.shortfall_prob_display || '৭১%'}। ${f?.trough_date ? `${f.trough_date} নাগাদ` : 'আগামী সপ্তাহে'} ব্যালেন্স সর্বনিম্ন অবস্থায় নামতে পারে। বড় পেমেন্টগুলো বেতন পাওয়ার পরই করুন।`
          : `Over the next ${f?.horizon_days || 21} days, there is a ${f?.shortfall_prob_display || '71%'} probability of running short. Your lowest balance is projected around ${f?.trough_date || 'next week'}.`;
      } else if (onFee) {
        const annual = c?.replaceable_fee_saved_paisa ? Math.round((c.replaceable_fee_saved_paisa * 12) / 100) : 1400;
        reply = isBn
          ? `আপনি ${c?.total_cashouts || 70} বার ক্যাশ-আউট করে মোট ${c?.total_fees_display || '৳১,৩৩৪'} ফি পরিশোধ করেছেন। এজেন্ট থেকে টাকা না তুলে সরাসরি কিউআর ও বিল পেমেন্ট করলে বছরে প্রায় ৳${annual.toLocaleString('bn')} সাশ্রয় করতে পারতেন।`
          : `You made ${c?.total_cashouts || 70} cash-outs paying ${c?.total_fees_display || '৳1,334'} in agent fees. Switching to direct digital QR payments could save you ~৳${annual.toLocaleString()} annually.`;
      } else if (onSave) {
        reply = isBn
          ? `সবচেয়ে কার্যকর সঞ্চয় পদ্ধতি হলো বেতন পাওয়ার সাথে সাথে নির্দিষ্ট পরিমাণ আলাদা করে ফেলা। 'পরিকল্পনা' ট্যাবে গিয়ে আপনার লক্ষ্য সেট করুন — আমি বলে দেব কত মাসে সহজে লক্ষ্যে পৌঁছানো সম্ভব।`
          : `The most effective habit is automated savings right after receiving income. Tap the 'Planner' tab to set your goal — I will compute a realistic timeline for you.`;
      } else {
        reply = isBn
          ? `আমি আপনাকে ৪টি ক্ষেত্রে তথ্য ও পরামর্শ দিতে পারি: ১. নিরাপদ খরচের সীমা (Safe to Spend), ২. আগামী ২১ দিনের আর্থিক পূর্বাভাস, ৩. ক্যাশ-আউট ফি সাশ্রয়, এবং ৪. সঞ্চয় লক্ষ্য পরিকল্পনা।`
          : `I can assist you across 4 core areas: 1. Safe-to-spend limit, 2. 21-day cashflow forecast, 3. Cash-out fee optimization, and 4. Savings planning.`;
      }

      setChatMessages((p) => [...p, { sender: 'assistant', text: reply, ev: bundle?.summary?.evidence }]);
    }, 450);
  };

  if (loading && !bundle) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', gap: '16px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '16px',
          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', fontWeight: 800, color: '#FFF',
          boxShadow: '0 0 24px rgba(59,130,246,0.5)',
        }}>
          সা
        </div>
        <RefreshCw size={22} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 500 }}>{t.loading}</p>
      </div>
    );
  }

  const sum = bundle?.summary?.data;
  const metrics = sum?.metrics;
  const cats = sum?.categories || [];
  const fc = bundle?.forecast?.data;
  const co = bundle?.cashout?.data;
  const gp = bundle?.goal_plan?.data;
  const txns = bundle?.transactions?.data?.items || [];
  const s2s = sum?.safe_to_spend;
  const coh = sum?.cash_on_hand;
  const rec = sum?.recurring;
  const isDeficit = s2s?.status === 'deficit';
  const statusLabel = isDeficit
    ? t.status_deficit
    : s2s?.status === 'comfortable'
    ? t.status_comfortable
    : s2s?.status === 'cautious'
    ? t.status_cautious
    : t.status_tight;
  const statusColor = isDeficit ? 'var(--accent-red)' : s2s?.status === 'comfortable' ? 'var(--accent-green)' : 'var(--state-caution)';

  // Circular gauge calculations
  const spentPaisa = s2s?.upcoming_commitments_paisa || 0;
  const totalPaisa = (sum?.balance_paisa || 0) + (s2s?.estimated_cash_paisa || 0);

  const annualFeeSave = co?.replaceable_fee_saved_paisa
    ? `৳${Math.round((co.replaceable_fee_saved_paisa * 12) / 100).toLocaleString(isBn ? 'bn' : 'en')}`
    : null;

  const goalTypes = [
    { id: 'emergency_fund', label: t.emergency },
    { id: 'education', label: t.education },
    { id: 'family_support', label: t.family },
    { id: 'device_purchase', label: t.device },
  ];

  // Proactive insights list
  const proactiveInsights: Array<{ icon: React.ReactNode; text: string; time: string; color: string }> = [];
  if (co?.replaceable_fee_saved_paisa > 0) {
    proactiveInsights.push({
      icon: <Coins size={16} color="var(--accent-green)" />,
      text: isBn
        ? `আমরা ${co.replaceable_count || 0}টি ক্যাশ-আউট লেনদেন পেয়েছি যা মার্চেন্ট কিউআরে করলে ${co.replaceable_fee_saved_display} ফি বাঁচত।`
        : `Identified ${co.replaceable_count || 0} cash-outs that could save ${co.replaceable_fee_saved_display} if paid via direct QR.`,
      time: isBn ? 'এইমাত্র' : 'Just now',
      color: 'var(--accent-green)',
    });
  }
  if (isDeficit) {
    proactiveInsights.push({
      icon: <AlertTriangle size={16} color="var(--accent-red)" />,
      text: t.deficitBody,
      time: isBn ? 'জরুরি' : 'Urgent',
      color: 'var(--accent-red)',
    });
  }
  if (fc?.shortfall_prob > 0.4) {
    proactiveInsights.push({
      icon: <TrendingDown size={16} color="var(--accent-amber)" />,
      text: isBn
        ? `আগামী ${fc.horizon_days} দিনে ${fc.shortfall_prob_display} সম্ভাবনায় ঘাটতির চাপ আসতে পারে।`
        : `${fc.shortfall_prob_display} chance of shortfall within ${fc.horizon_days} days. Keep non-essential spending low.`,
      time: fc.trough_date?.split(' ')[0] || (isBn ? 'সতর্কতা' : 'Alert'),
      color: 'var(--accent-amber)',
    });
  }
  if (sum?.metrics?.savings_rate < 0.08 && sum?.metrics?.savings_rate >= 0) {
    proactiveInsights.push({
      icon: <Target size={16} color="var(--accent-purple)" />,
      text: isBn
        ? `আপনার সঞ্চয়ের হার মাত্র ${sum.metrics.savings_rate_display}। আয়ের ১০% আলাদা করার অভ্যাস গড়ুন।`
        : `Your savings rate is currently ${sum.metrics.savings_rate_display}. Strive for at least 10% monthly savings.`,
      time: isBn ? 'পরামর্শ' : 'Tip',
      color: 'var(--accent-purple)',
    });
  }
  if (proactiveInsights.length === 0) {
    proactiveInsights.push({
      icon: <CheckCircle size={16} color="var(--accent-green)" />,
      text: isBn ? 'আপনার আর্থিক অবস্থা স্থিতিশীল ও সুরক্ষিত আছে।' : 'Your cash flow trajectory is stable and well funded.',
      time: isBn ? 'এখন' : 'Now',
      color: 'var(--accent-green)',
    });
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--bg-base)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))' }}>
      {/* Origin-style Header with Persona, Language & Theme Toggles */}
      <PersonaPicker
        users={users}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        isOffline={isOffline}
        onToggleOffline={() => setIsOffline(!isOffline)}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'bn' ? 'en' : 'bn'))}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main style={{ maxWidth: '540px', margin: '0 auto', padding: '16px' }}>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 1 — OVERVIEW */}
        {/* ═══════════════════════════════════════════════════════ */}
        {currentTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Track 03 Pill */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: 'var(--radius-full)',
              background: 'var(--accent-tint)', border: '1px solid var(--border-accent)',
              width: 'fit-content', margin: '0 auto',
            }}>
              <Zap size={13} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                {t.track}
              </span>
            </div>

            {/* ── HERO CARD: Budget Gauge + Safe to Spend ── */}
            <div className="origin-card" style={{ padding: '22px 20px', position: 'relative', overflow: 'hidden' }}>
              {/* Subtle radial glow */}
              <div style={{
                position: 'absolute', top: '-50px', left: '50%', transform: 'translateX(-50%)',
                width: '240px', height: '240px',
                background: `radial-gradient(circle, ${isDeficit ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)'} 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />

              {/* Persona label & Status pill */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {currentUser ? (isBn ? currentUser.persona_label_bn : currentUser.persona_label_en) : ''}
                  </span>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {sum?.as_of_date ? `${t.updatedOn}: ${sum.as_of_date}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '0.72rem', padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    background: `${statusColor}18`, border: `1px solid ${statusColor}35`,
                    color: statusColor, fontWeight: 700,
                  }}>
                    {statusLabel}
                  </span>
                  <button
                    id="verify-data-btn"
                    onClick={() => openEvidence(bundle?.summary?.evidence)}
                    title={t.verifyData}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <ShieldCheck size={15} />
                  </button>
                </div>
              </div>

              {/* Circular Gauge */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
                <BudgetGauge
                  spent={spentPaisa}
                  total={totalPaisa || 1}
                  label={s2s?.safe_to_spend_total_display || '৳০'}
                  sub={t.leftToSpend}
                />
              </div>

              {/* Safe Daily Budget Note */}
              {!isDeficit && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                    {s2s?.daily_safe_budget_display || '৳০'}{t.perDay}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: '6px' }}>{t.ofBudget}</span>
                </div>
              )}

              {/* Deficit warning block */}
              {isDeficit && (
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: '16px' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: '3px' }}>{t.deficitTitle}</p>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.deficitBody}</p>
                </div>
              )}

              {/* 4-Stat Metric Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: t.walletBalance, value: sum?.balance_display || '৳০', color: 'var(--text-primary)' },
                  {
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {t.cashInHand}
                        <button onClick={() => setShowCashInfo(!showCashInfo)} style={{ color: 'var(--text-muted)' }}>
                          <Info size={11} />
                        </button>
                      </span>
                    ),
                    value: `~${s2s?.estimated_cash_display || '৳০'}`,
                    color: 'var(--accent-green)',
                  },
                  { label: t.upcoming, value: s2s?.upcoming_commitments_display || '৳০', color: 'var(--state-caution)' },
                  { label: t.buffer, value: s2s?.buffer_display || '৳০', color: 'var(--text-secondary)' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: item.color, letterSpacing: '-0.3px' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {showCashInfo && (
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {t.cashInHandNote}
                </div>
              )}
            </div>

            {/* ── 4 Feature Stat Cards ── */}
            <div className="bento-grid">
              <div className="origin-card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                    <ArrowDownLeft size={15} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.monthlyIncome}</span>
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.4px' }}>
                  {metrics?.monthly_income_display || '৳০'}
                </p>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {metrics?.inflows_30d_display ? `${metrics.inflows_30d_display} (30d)` : ''}
                </span>
              </div>

              <div className="origin-card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-red)' }}>
                    <ArrowUpRight size={15} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.monthlySpend}</span>
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-red)', marginBottom: '2px', letterSpacing: '-0.4px' }}>
                  {metrics?.monthly_spend_display || '৳০'}
                </p>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {metrics?.outflows_30d_display ? `${metrics.outflows_30d_display} (30d)` : ''}
                </span>
              </div>

              <div className="origin-card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-green)' }}>
                    <Calendar size={15} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.bufferDays}</span>
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-green)', marginBottom: '2px', letterSpacing: '-0.4px' }}>
                  {metrics?.buffer_days_display || '০ দিন'}
                </p>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.buffer}</span>
              </div>

              <div className="origin-card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                    <Coins size={15} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.feeSavable}</span>
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F59E0B', marginBottom: '2px', letterSpacing: '-0.4px' }}>
                  {co?.replaceable_fee_saved_display || '৳০'}
                </p>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.couldSave}</span>
              </div>
            </div>

            {/* ── Proactive Advice Notification Stream ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '2px' }}>
                <Sparkles size={15} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.proactiveTitle}</span>
              </div>
              {proactiveInsights.map((ins, i) => (
                <div key={i} className="msg-appear" style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `3px solid ${ins.color}`,
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: `${ins.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {ins.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>{ins.text}</p>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }}>{ins.time}</span>
                </div>
              ))}
            </div>

            {/* ── Auto-detected Recurring Commitments ── */}
            {rec?.items?.length > 0 && (
              <div className="origin-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Clock size={16} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.recurringTitle}</h3>
                  </div>
                  <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{t.recurringAuto}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rec.items.map((item: any, i: number) => {
                    const isIncome = item.type === 'income' || item.amount_paisa > 0;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' }}>
                        <div>
                          <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{humanTitle(item, isBn)}</strong>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {item.cadence === 'monthly' ? t.monthly : t.weekly}
                            {item.next_expected_date ? ` · ${t.next}: ${item.next_expected_date}` : ''}
                          </p>
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isIncome ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                          {isIncome ? '+' : '-'}{item.expected_amount_display}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Expense Breakdown by Category ── */}
            {cats.length > 0 && (
              <div className="origin-card" style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.whereMoneyGoes}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cats.map((cat: any, i: number) => {
                    const pct = Math.round((cat.total_paisa / (metrics?.monthly_spend_paisa || 1)) * 100);
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{isBn ? cat.label_bn : cat.label_en}</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{cat.total_display}</span>
                        </div>
                        <div style={{ height: '5px', borderRadius: '3px', background: 'var(--bg-surface-3)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: 'var(--accent-primary)', borderRadius: '3px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Recent Transactions ── */}
            {txns.length > 0 && (
              <div className="origin-card" style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.recentTxns}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {txns.slice(0, 5).map((tx: any) => {
                    const isCredit = tx.direction === 'inflow';
                    return (
                      <div key={tx.transaction_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' }}>
                        <div>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{tx.counterparty || (isCredit ? 'Cash In' : 'Payment')}</strong>
                          <p style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{tx.timestamp?.slice(0, 10)} · {tx.category?.category || 'general'}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: isCredit ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                            {isCredit ? '+' : '-'}{tx.amount_display}
                          </span>
                          <p style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{t.balanceAfter}: {tx.balance_after_display}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 2 — FORECAST */}
        {/* ═══════════════════════════════════════════════════════ */}
        {currentTab === 'forecast' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {!fc ? (
              <div className="origin-card" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <TrendingUp size={28} style={{ marginBottom: '10px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.86rem' }}>{t.noForecast}</p>
              </div>
            ) : (
              <>
                {/* Forecast Hero */}
                <div className="origin-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.forecastTitle}</h2>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fc.horizon_days} {isBn ? 'দিনের কোয়ান্টাইল প্রজেকশন' : 'day Quantile projection'}</p>
                    </div>
                    <span style={{
                      fontSize: '0.72rem', padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      background: fc.shortfall_prob > 0.5 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                      border: `1px solid ${fc.shortfall_prob > 0.5 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                      color: fc.shortfall_prob > 0.5 ? 'var(--accent-red)' : 'var(--accent-green)',
                      fontWeight: 700,
                    }}>
                      {fc.shortfall_prob > 0.5 ? t.riskHigh : fc.shortfall_prob > 0.2 ? t.riskMedium : t.riskLow}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '2.4rem', fontWeight: 900, color: fc.shortfall_prob > 0.5 ? 'var(--accent-red)' : 'var(--text-primary)', letterSpacing: '-1px' }}>
                      {fc.shortfall_prob_display}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.shortfallChance}</span>
                  </div>

                  {fc.trough_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Calendar size={13} color="var(--accent-primary)" />
                      <span>{t.troughDate}: <strong style={{ color: 'var(--text-primary)' }}>{fc.trough_date}</strong></span>
                    </div>
                  )}
                </div>

                {/* Empirical Benchmark Comparison */}
                {benchmark && (
                  <div className="origin-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                      <Award size={16} color="var(--accent-primary)" />
                      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.aiVsBasic}</h3>
                    </div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>{t.aiExplain}</p>
                    <div className="bento-grid" style={{ marginBottom: '14px' }}>
                      <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' }}>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginBottom: '3px' }}>{t.bssLabel}</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--accent-green)', letterSpacing: '-0.3px' }}>
                          +{Math.round((benchmark.brier_score?.skill_score || 0.28) * 100)}%
                        </div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '2px' }}>{t.bssDesc}</div>
                      </div>
                      <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' }}>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginBottom: '3px' }}>{t.earlyWarn}</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '-0.3px' }}>
                          {Math.round((benchmark.early_warning_7d?.f1 || 0.72) * 100)}% F1
                        </div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '2px' }}>{t.earlyWarnPerf}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>{t.keyFactors}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {benchmark.interpretability?.top_features?.map((f: any, i: number) => (
                        <span key={i} style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {isBn ? f.description_bn : (f.description_en || f.description_bn)} ({f.importance_pct}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily Forecast Table */}
                {fc.days?.length > 0 && (
                  <div className="origin-card" style={{ padding: '16px' }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.dailyForecast}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0 8px 8px', borderBottom: '1px solid var(--border-default)', marginBottom: '6px', fontWeight: 600 }}>
                      <span>{isBn ? 'তারিখ' : 'Date'}</span>
                      <span style={{ textAlign: 'center' }}>⬇ {t.low}</span>
                      <span style={{ textAlign: 'center', color: 'var(--accent-primary)' }}>◎ {t.likely}</span>
                      <span style={{ textAlign: 'center' }}>⬆ {t.high}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {fc.days.slice(0, 10).map((d: any, i: number) => {
                        const isNeg = d.p50_paisa < 0;
                        return (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', alignItems: 'center', padding: '8px', borderRadius: 'var(--radius-xs)', background: isNeg ? 'rgba(239,68,68,0.06)' : 'var(--bg-surface-2)', border: isNeg ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent', fontSize: '0.78rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{d.date.slice(5)}</span>
                            <span style={{ textAlign: 'center', color: d.p10_paisa < 0 ? 'var(--accent-red)' : 'var(--text-muted)', fontSize: '0.74rem' }}>{d.p10_display}</span>
                            <span style={{ textAlign: 'center', fontWeight: 700, color: isNeg ? 'var(--accent-red)' : 'var(--accent-primary)' }}>{d.p50_display}</span>
                            <span style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem' }}>{d.p90_display}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coach Tip */}
                <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent-tint)', border: '1px solid var(--border-accent)' }}>
                  <p style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{t.coachTip}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t.forecastTip}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 3 — PLANNER */}
        {/* ═══════════════════════════════════════════════════════ */}
        {currentTab === 'planner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="origin-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={19} color="var(--accent-primary)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.plannerTitle}</h2>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.plannerSub}</p>
                </div>
              </div>

              {/* Goal Category Chips */}
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>{t.goalFor}</p>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '18px', paddingBottom: '2px' }}>
                {goalTypes.map((gt) => (
                  <button
                    key={gt.id}
                    onClick={() => setGoalType(gt.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 'var(--radius-full)',
                      background: goalType === gt.id ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
                      border: goalType === gt.id ? 'none' : '1px solid var(--border-default)',
                      color: goalType === gt.id ? '#FFF' : 'var(--text-secondary)',
                      fontSize: '0.77rem', fontWeight: goalType === gt.id ? 700 : 400,
                      flexShrink: 0,
                    }}
                  >
                    {gt.label}
                  </button>
                ))}
              </div>

              {/* Target Amount Buttons */}
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>{t.howMuch}</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                {[
                  { l: '৳৫,০০০', p: 500000 },
                  { l: '৳১০,০০০', p: 1000000 },
                  { l: '৳২০,০০০', p: 2000000 },
                  { l: '৳৫০,০০০', p: 5000000 },
                ].map((c) => (
                  <button
                    key={c.p}
                    onClick={() => setTargetPaisa(c.p)}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 'var(--radius-sm)',
                      background: targetPaisa === c.p ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
                      border: targetPaisa === c.p ? 'none' : '1px solid var(--border-default)',
                      color: targetPaisa === c.p ? '#FFF' : 'var(--text-secondary)',
                      fontSize: '0.77rem', fontWeight: targetPaisa === c.p ? 700 : 500,
                    }}
                  >
                    {c.l}
                  </button>
                ))}
              </div>

              {/* Month Slider */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t.howLong}</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{targetMonths} {t.months}</span>
              </div>
              <input type="range" min="3" max="24" value={targetMonths} onChange={(e) => setTargetMonths(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Saved Notification */}
            {goalNotice && (
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--accent-green)', fontSize: '0.85rem' }}>
                {goalNotice}
              </div>
            )}

            {/* Feasibility Note */}
            {gp?.feasibility_note_bn && (
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--state-caution)', marginBottom: '3px' }}>{t.feasibility}</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {isBn ? gp.feasibility_note_bn : (gp.feasibility_note_en || gp.feasibility_note_bn)}
                </p>
              </div>
            )}

            {/* Plan Options */}
            {gp?.options?.length > 0 ? (
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.plans}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {gp.options.map((opt: any, idx: number) => (
                    <div
                      key={idx}
                      className="origin-card"
                      style={{
                        padding: '16px',
                        border: idx === 0 ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                        boxShadow: idx === 0 ? '0 0 16px rgba(59,130,246,0.15)' : 'none',
                      }}
                    >
                      {idx === 0 && <span style={{ fontSize: '0.67rem', color: 'var(--accent-primary)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>{t.recommended}</span>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{isBn ? opt.title_bn : (opt.title_en || opt.title_bn)}</span>
                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(34,197,94,0.12)', color: 'var(--accent-green)', fontWeight: 600 }}>
                          {t.successChance}: {opt.p_goal_met_display}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '-0.5px' }}>
                          {opt.monthly_contribution_display}<span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t.perMonth}</span>
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.duration}: {opt.months} {t.months}</span>
                      </div>
                      <p style={{ fontSize: '0.77rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                        {t.tradeoff}: {isBn ? opt.tradeoff_bn : (opt.tradeoff_en || opt.tradeoff_bn)}
                      </p>
                      <button
                        onClick={() => handleSavePlan(opt)}
                        style={{
                          width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)',
                          background: idx === 0 ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
                          border: idx === 0 ? 'none' : '1px solid var(--border-default)',
                          color: idx === 0 ? '#FFF' : 'var(--text-primary)',
                          fontSize: '0.82rem', fontWeight: 700,
                        }}
                      >
                        {t.choosePlan}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="origin-card" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Target size={26} style={{ marginBottom: '10px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.84rem' }}>{t.noPlan}</p>
              </div>
            )}

            {/* Saved Plans */}
            {savedGoals.length > 0 && (
              <div className="origin-card" style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>{t.savedPlans}</h3>
                {savedGoals.map((g) => (
                  <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-default)', fontSize: '0.82rem' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>{g.title}</strong>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{t.target}: {g.target} ({g.months} {t.months})</p>
                    </div>
                    <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{g.monthly}{t.perMonth}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 4 — CASHOUT */}
        {/* ═══════════════════════════════════════════════════════ */}
        {currentTab === 'cashout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="origin-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={19} color="#F59E0B" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.cashoutTitle}</h2>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.cashoutSub}</p>
                </div>
              </div>

              <div className="bento-grid" style={{ marginTop: '16px', marginBottom: '12px' }}>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '5px' }}>{t.totalFees}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#F59E0B', letterSpacing: '-0.5px' }}>{co?.total_fees_display || '৳০'}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>{co?.total_cashouts || 0} {t.cashouts}</div>
                </div>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '5px' }}>{t.couldSave}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-green)', letterSpacing: '-0.5px' }}>{co?.replaceable_fee_saved_display || '৳০'}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--accent-green)', marginTop: '3px' }}>{co?.replaceable_count || 0} {t.digitalOk}</div>
                </div>
              </div>

              {annualFeeSave && (
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-purple)' }}>{t.annualSave}</p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.annualNote}</p>
                  </div>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-purple)' }}>{annualFeeSave}</span>
                </div>
              )}
            </div>

            {/* Digital Tip Card */}
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent-tint)', border: '1px solid var(--border-accent)' }}>
              <p style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{t.digitalTip}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t.digitalTipBody}</p>
            </div>

            {/* Repeat Agents */}
            <div className="origin-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.agents}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {co?.patterns?.length > 0 ? (
                  co.patterns.map((p: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-default)' }}>
                      <div>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{p.counterparty_id}</strong>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.count} {isBn ? 'বার' : 'withdrawals'} · {p.total_amount_display}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F59E0B' }}>{p.total_fee_display}</span>
                        <p style={{ fontSize: '0.68rem', color: 'var(--accent-green)' }}>↓ {p.replaceable_fee_saved_display}</p>
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

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 5 — ALWAYS-ON AI COPILOT CHAT */}
        {/* ═══════════════════════════════════════════════════════ */}
        {currentTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 'calc(100dvh - 200px)' }}>
            {/* Starter Suggestion Pills (Origin style) */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
              {t.starters.map((s: string, i: number) => (
                <button key={i} onClick={() => sendMessage(s)} className="insight-pill">
                  {s}
                </button>
              ))}
            </div>

            {/* Conversation Flow */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '6px 0', minHeight: '320px' }}>
              {chatMessages.map((msg, i) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={i} className="msg-appear" style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                    {!isUser && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '7px',
                          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', color: '#FFF', fontWeight: 800,
                        }}>
                          সা
                        </div>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{t.aiName}</span>
                      </div>
                    )}
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isUser ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      border: isUser ? 'none' : '1px solid var(--border-default)',
                      boxShadow: 'var(--shadow-sm)',
                    }}>
                      <p style={{
                        fontSize: '0.88rem',
                        color: isUser ? '#FFFFFF' : 'var(--text-primary)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-line',
                      }}>
                        {msg.text}
                      </p>
                      {msg.ev && !isUser && (
                        <button
                          onClick={() => openEvidence(msg.ev)}
                          style={{
                            marginTop: '8px', fontSize: '0.67rem',
                            color: 'var(--accent-primary)',
                            background: 'rgba(59,130,246,0.1)',
                            border: '1px solid rgba(59,130,246,0.25)',
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          <ShieldCheck size={11} /> {t.verified}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {isThinking && (
                <div className="msg-appear" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: '18px 18px 18px 4px',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                    display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem',
                  }}>
                    <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>{t.thinking}</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 12px', borderRadius: 'var(--radius-full)',
              background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
              boxShadow: 'var(--shadow-md)',
            }}>
              <button
                id="voice-btn"
                onClick={() => {
                  setIsVoice(!isVoice);
                  if (!isVoice) {
                    setTimeout(() => {
                      setIsVoice(false);
                      sendMessage(isBn ? 'আমি কি আজ ৫০০ টাকা খরচ করতে পারব?' : 'Can I spend ৳500 today?');
                    }, 1800);
                  }
                }}
                title={isVoice ? 'Listening...' : 'Voice Input'}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: isVoice ? 'var(--accent-red)' : 'var(--bg-surface-2)',
                  border: '1px solid var(--border-default)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isVoice ? '#FFF' : 'var(--text-muted)',
                  animation: isVoice ? 'pulseGlow 1s infinite' : 'none',
                  flexShrink: 0,
                }}
              >
                <Mic size={16} />
              </button>
              <input
                id="chat-input"
                type="text"
                placeholder={isVoice ? t.listening : t.placeholder}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                style={{ flex: 1, minWidth: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}
              />
              <button
                id="chat-send-btn"
                onClick={() => sendMessage()}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FFF',
                  boxShadow: '0 0 10px rgba(59,130,246,0.4)',
                  flexShrink: 0,
                }}
              >
                <Send size={15} />
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.67rem', color: 'var(--text-muted)', paddingBottom: '4px' }}>
              {t.guardrail}
            </p>
          </div>
        )}
      </main>

      <TabBar currentTab={currentTab} onTabChange={setCurrentTab} language={language} />
      <EvidenceModal evidence={evidenceData} isOpen={isEvidenceOpen} onClose={() => setIsEvidenceOpen(false)} />
    </div>
  );
}
