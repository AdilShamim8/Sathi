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
  Award,
  Lightbulb,
  CircleDollarSign,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { TabBar, TabType } from '../components/TabBar';
import { PersonaPicker, Language } from '../components/PersonaPicker';
import { EvidenceModal } from '../components/EvidenceModal';
import { DemoUser, Evidence, fetchDemoUsers, fetchPersonaBundle, fetchBenchmark } from '../lib/api';

// ─────────────────────────────────────────────
// Translation dictionary
// ─────────────────────────────────────────────
const T = {
  bn: {
    loading: 'সাথী চালু হচ্ছে…',
    track: 'ট্র্যাক ০৩ — আর্থিক স্বাধীনতা',
    // Overview
    safeSpend: 'এখন নিরাপদে খরচ করা যাবে',
    safeSpendSub: 'আগামী ১৪ দিনের সব প্রয়োজনীয় বিল মিটিয়ে বাকি টাকা',
    perDay: '/দিন',
    comfortable: '✅ স্বস্তিদায়ক',
    cautious: '⚠️ সতর্ক থাকুন',
    tight: '🔴 টানাটানি',
    deficit: '🚨 ঘাটতির ঝুঁকি',
    deficitWarning: 'আগামী ১৪ দিনে আবশ্যক বিল ও খরচের তুলনায় ওয়ালেটে পর্যাপ্ত টাকা নেই। এখনই অপ্রয়োজনীয় খরচ কমান।',
    walletBalance: 'ওয়ালেটে টাকা',
    cashInHand: 'হাতে নগদ',
    upcomingBills: 'আসন্ন বিল',
    safetyBuffer: 'জরুরি সঞ্চয়',
    verifyData: 'তথ্য যাচাই',
    updatedOn: 'পর্যন্ত হালনাগাদ',
    monthlyIncome: 'মাসিক আয়',
    monthlySpend: 'মাসিক খরচ',
    bufferDays: 'জরুরি দিন',
    feeSavable: 'ফি বাঁচানো সম্ভব',
    regularIncome: 'নিয়মিত আয়',
    dailyExpenses: 'দৈনন্দিন খরচ',
    emergencyDays: 'জরুরি প্রয়োজনে',
    digitalSavings: 'ডিজিটালে বাঁচবে',
    howSathiKnows: '💡 সাথী কীভাবে জানে?',
    howSathiKnowsDetail: 'সাথী আপনার ক্যাশ-আউটের ইতিহাস বিশ্লেষণ করে অনুমান করে আপনার হাতে এখন কত নগদ আছে। এটি সরাসরি পরিমাপ নয়, গাণিতিক অনুমান।',
    recurringTitle: 'নিয়মিত আয় ও বিল',
    recurringSubtitle: 'স্বয়ংক্রিয়ভাবে শনাক্তকৃত',
    monthlyLabel: 'মাসিক',
    weeklyLabel: 'সাপ্তাহিক',
    nextExpected: 'পরবর্তী',
    insightsTitle: 'সাথীর পরামর্শ',
    whereMoneyGoes: 'কোথায় কত টাকা যাচ্ছে?',
    recentTxns: 'সাম্প্রতিক লেনদেন',
    balanceAfter: 'পরে ব্যালেন্স',
    // Forecast
    forecastTitle: 'সামনের দিনের পূর্বাভাস',
    shortfallChance: 'টাকা কম পড়ার আশঙ্কা',
    riskHigh: '🚨 সাবধান! টাকা কম পড়তে পারে',
    riskMedium: '⚠️ কিছুটা সতর্ক থাকুন',
    riskLow: '✅ ভালো অবস্থায় আছেন',
    lowestBalDate: 'সবচেয়ে কম ব্যালেন্সের সম্ভাব্য তারিখ',
    aiVsBasic: 'সাথীর AI বনাম সাধারণ হিসাব',
    aiMoreAccurate: 'বেশি নির্ভুল',
    aiExplain: 'সাথীর AI সাধারণ গড় হিসাবের চেয়ে অনেক বেশি নির্ভুলভাবে আপনার ভবিষ্যৎ টাকার অবস্থা বলতে পারে। পরীক্ষিত প্রমাণ:',
    bssLabel: 'নির্ভুলতা উন্নতি',
    bssExplain: 'সাধারণ হিসাবের চেয়ে এগিয়ে',
    earlyWarning: '৭ দিন আগে সতর্কতা',
    earlyWarningExplain: 'AI অনেক বেশি কার্যকর',
    keyFactors: 'AI যে বিষয়গুলো দেখে সিদ্ধান্ত নেয়',
    dailyForecastTitle: 'প্রতিদিনের ব্যালেন্স পূর্বাভাস',
    conservative: 'সতর্ক',
    mostLikely: 'সম্ভাবনা',
    optimistic: 'আশাবাদী',
    coachAdvice: '💡 কোচের পরামর্শ',
    forecastAdvice: 'মাসের শেষ সপ্তাহের চাপ এড়াতে বড় পেমেন্ট বেতন পাওয়ার পরপরই করুন। অপ্রয়োজনীয় ক্যাশ-আউট বন্ধ রাখুন।',
    noForecast: 'পূর্বাভাসের তথ্য এই মুহূর্তে পাওয়া যায়নি।',
    // Planner
    plannerTitle: 'সঞ্চয় পরিকল্পনা',
    plannerSub: 'বাস্তবসম্মত লক্ষ্য ঠিক করুন',
    goalType: 'কী জন্য সঞ্চয় করবেন?',
    emergency: '🆘 জরুরি তহবিল',
    education: '📚 শিক্ষা / বই',
    family: '👨‍👩‍👧 পরিবার সহায়তা',
    device: '📱 নতুন ডিভাইস',
    targetAmount: 'কত টাকা জমাতে চান?',
    timeline: 'কত মাসে জমাবেন?',
    months: 'মাস',
    planOptions: 'বাস্তবসম্মত পরিকল্পনা',
    successChance: 'সফলতার সম্ভাবনা',
    perMonth: '/ মাস',
    duration: 'সময়কাল',
    tradeoff: 'মাথায় রাখুন',
    savePlan: 'এই পরিকল্পনা গ্রহণ করি',
    planSaved: '✅ পরিকল্পনা সংরক্ষিত হয়েছে। কোনো টাকা কাটা হয়নি।',
    savedPlans: 'আমার পরিকল্পনাসমূহ',
    target: 'লক্ষ্য',
    recommended: '⭐ প্রস্তাবিত',
    feasibilityNote: 'সাথীর মন্তব্য',
    noPlanYet: 'লক্ষ্য নির্বাচন করুন এবং উপরের বোতামে চাপ দিন।',
    // Cashout
    cashoutTitle: 'ক্যাশ-আউট ফি বিশ্লেষণ',
    cashoutSub: 'এজেন্ট থেকে টাকা তুলতে কত ফি দিচ্ছেন?',
    totalFees: 'মোট ফি দিয়েছেন',
    couldSave: 'ডিজিটালে বাঁচাতে পারতেন',
    cashoutCount: 'বার টাকা তুলেছেন',
    digitalEligible: 'ডিজিটালে করা সম্ভব ছিল',
    annualSavings: 'বার্ষিক সম্ভাব্য সাশ্রয়',
    annualSavingsNote: 'যদি এখন থেকে ডিজিটালে পেমেন্ট করেন',
    repeatAgents: 'যেসব এজেন্ট থেকে বারবার টাকা তুলেছেন',
    agentId: 'এজেন্ট',
    withdrawals: 'বার',
    totalFee: 'মোট ফি',
    saveable: 'বাঁচানো সম্ভব',
    noPatterns: 'কোনো পুনরাবৃত্ত প্যাটার্ন পাওয়া যায়নি।',
    digitalTip: '💡 ডিজিটাল পেমেন্ট টিপ',
    digitalTipDetail: 'বাজারে কেনাকাটা, বিদ্যুৎ বিল, মোবাইল রিচার্জ — এসব সরাসরি মোবাইল ব্যাংকিং থেকে করা যায়। ক্যাশ-আউট ফি বাঁচান।',
    // Chat
    chatWelcome: 'আস-সালামু আলাইকুম! আমি সাথী — আপনার আর্থিক সহায়ক। আমি আপনাকে সাহায্য করব:\n• কত টাকা নিরাপদে খরচ করা যাবে তা জানতে\n• সামনে টাকার সমস্যা হবে কিনা পূর্বাভাস দিতে\n• কম ফিতে ডিজিটালে পেমেন্ট করতে\n• সঞ্চয়ের পরিকল্পনা করতে\n\nনিচের প্রশ্নে ট্যাপ করুন বা নিজে লিখুন।',
    chatStarters: [
      'এখন কত টাকা নিরাপদে খরচ করা যাবে?',
      'সামনের সপ্তাহে কি টাকার সমস্যা হবে?',
      '১০ হাজার টাকা কীভাবে জমাব?',
      'ক্যাশ-আউট ফি কমানোর উপায় কী?',
    ],
    chatPlaceholder: 'লিখুন… যেমন: এখন কত টাকা খরচ করা যাবে?',
    listening: 'শুনছি… বলুন',
    aiLabel: 'সাথী',
    verified: 'যাচাইকৃত তথ্য',
    guardrail: '🔒 সাথী কখনো নিজে থেকে টাকা কাটে না বা ঋণ দেয় না।',
  },
  en: {
    loading: 'Loading Sathi…',
    track: 'Track 03 — Financial Independence',
    // Overview
    safeSpend: 'Safe to Spend Now',
    safeSpendSub: 'After all upcoming bills & must-pay expenses for 14 days',
    perDay: '/day',
    comfortable: '✅ Comfortable',
    cautious: '⚠️ Be Careful',
    tight: '🔴 Tight Budget',
    deficit: '🚨 Deficit Risk',
    deficitWarning: 'Upcoming bills exceed available funds in the next 14 days. Cut unnecessary spending now.',
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
    howSathiKnows: '💡 How does Sathi know?',
    howSathiKnowsDetail: 'Sathi estimates cash-in-hand by analysing your cash-out history using a mathematical decay model — not a direct measurement.',
    recurringTitle: 'Regular Income & Bills',
    recurringSubtitle: 'Auto-detected patterns',
    monthlyLabel: 'monthly',
    weeklyLabel: 'weekly',
    nextExpected: 'Next expected',
    insightsTitle: "Sathi's Insights",
    whereMoneyGoes: 'Where Is Your Money Going?',
    recentTxns: 'Recent Transactions',
    balanceAfter: 'Balance after',
    // Forecast
    forecastTitle: 'Future Money Forecast',
    shortfallChance: 'Chance of Running Short',
    riskHigh: '🚨 Warning! You may run short',
    riskMedium: '⚠️ Stay cautious this week',
    riskLow: '✅ You\'re in good shape',
    lowestBalDate: 'Expected lowest balance date',
    aiVsBasic: 'AI Forecast vs Basic Average',
    aiMoreAccurate: 'more accurate',
    aiExplain: "Sathi's AI is far more accurate than a basic rolling average at predicting your future cash flow. Here's the tested proof:",
    bssLabel: 'Accuracy improvement',
    bssExplain: 'Better than basic average',
    earlyWarning: '7-day early warning',
    earlyWarningExplain: 'AI performs much better',
    keyFactors: 'Key factors the AI considers',
    dailyForecastTitle: 'Daily Balance Forecast',
    conservative: 'Low',
    mostLikely: 'Likely',
    optimistic: 'High',
    coachAdvice: '💡 Coach Tip',
    forecastAdvice: 'To avoid end-of-month pressure, pay large bills right after your salary arrives. Avoid unnecessary cash-outs.',
    noForecast: 'Forecast data not available at this moment.',
    // Planner
    plannerTitle: 'Savings Planner',
    plannerSub: 'Set a realistic savings goal',
    goalType: 'What are you saving for?',
    emergency: '🆘 Emergency Fund',
    education: '📚 Education / Books',
    family: '👨‍👩‍👧 Family Support',
    device: '📱 New Device',
    targetAmount: 'How much do you want to save?',
    timeline: 'Over how many months?',
    months: 'months',
    planOptions: 'Realistic Plans',
    successChance: 'Chance of success',
    perMonth: '/ month',
    duration: 'Duration',
    tradeoff: 'Consider this',
    savePlan: 'Choose This Plan',
    planSaved: '✅ Plan saved! No money was moved.',
    savedPlans: 'My Plans',
    target: 'Target',
    recommended: '⭐ Recommended',
    feasibilityNote: "Sathi's Assessment",
    noPlanYet: 'Select a goal type and tap a plan below.',
    // Cashout
    cashoutTitle: 'Cash-Out Fee Analysis',
    cashoutSub: 'How much are you paying in fees to withdraw from agents?',
    totalFees: 'Total fees paid',
    couldSave: 'Could save by going digital',
    cashoutCount: 'withdrawals made',
    digitalEligible: 'could have been digital',
    annualSavings: 'Estimated annual savings',
    annualSavingsNote: 'If you switch to digital payments now',
    repeatAgents: 'Agents You Use Repeatedly',
    agentId: 'Agent',
    withdrawals: 'withdrawals',
    totalFee: 'Total fee',
    saveable: 'Saveable',
    noPatterns: 'No repeated patterns found.',
    digitalTip: '💡 Digital Payment Tip',
    digitalTipDetail: 'Market purchases, electricity bills, mobile recharge — all can be done via mobile banking. Stop paying cash-out fees.',
    // Chat
    chatWelcome: "Hello! I'm Sathi — your personal money companion. I can help you:\n• Know how much you can safely spend\n• Predict if you'll run short on cash\n• Reduce fees by going digital\n• Plan your savings goals\n\nTap a question below or type your own.",
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
    guardrail: '🔒 Sathi never moves money automatically or approves loans.',
  },
};

// Human-readable category name mapper
const CATEGORY_TITLES: Record<string, { bn: string; en: string }> = {
  salary:      { bn: 'মাসিক বেতন',                en: 'Monthly Salary' },
  cash_out:    { bn: 'নিয়মিত ক্যাশ-আউট',         en: 'Regular Cash Withdrawal' },
  rent:        { bn: 'বাড়ি ভাড়া',                en: 'House Rent' },
  food:        { bn: 'খাবার খরচ',                 en: 'Food & Groceries' },
  transport:   { bn: 'যাতায়াত',                  en: 'Transport' },
  bills:       { bn: 'ইউটিলিটি বিল',              en: 'Utility Bills' },
  mobile:      { bn: 'মোবাইল রিচার্জ',            en: 'Mobile & Internet' },
  remittance:  { bn: 'রেমিট্যান্স',               en: 'Remittance' },
  business:    { bn: 'ব্যবসায়িক খরচ',            en: 'Business Expense' },
  family:      { bn: 'পরিবারের খরচ',              en: 'Family Support' },
  other:       { bn: 'অন্যান্য',                   en: 'Other' },
  income:      { bn: 'নিয়মিত আয়',               en: 'Regular Income' },
};

function humanCategoryTitle(item: { [key: string]: any }, isBn: boolean): string {
  const cat = String(item.category || '');
  const mapping = CATEGORY_TITLES[cat] as { bn: string; en: string } | undefined;
  if (mapping) return isBn ? mapping.bn : mapping.en;
  const rawTitle: string = isBn ? String(item.title_bn || '') : String(item.title_en || item.title_bn || '');
  if (rawTitle && !rawTitle.includes('(') && !rawTitle.includes('Recurring Spend') && !rawTitle.includes('নিয়মিত ব্যয়')) return rawTitle;
  return isBn ? String(item.title_bn || cat) : String(item.title_en || item.title_bn || cat);
}

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
  const [showCashInHandInfo, setShowCashInHandInfo] = useState(false);

  // Planner
  const [goalType, setGoalType] = useState<string>('emergency_fund');
  const [targetPaisa, setTargetPaisa] = useState<number>(1000000);
  const [targetMonths, setTargetMonths] = useState<number>(6);
  const [savedGoals, setSavedGoals] = useState<any[]>([]);
  const [goalNotice, setGoalNotice] = useState<string | null>(null);

  const isBn = language === 'bn';
  const t = T[language];

  // Chat
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; evidence?: Evidence }>>([{ sender: 'assistant', text: t.chatWelcome }]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);

  useEffect(() => {
    setChatMessages([{ sender: 'assistant', text: t.chatWelcome }]);
  }, [language]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [demoUsers, benchData] = await Promise.all([fetchDemoUsers(isOffline), fetchBenchmark(isOffline)]);
      setUsers(demoUsers);
      setBenchmark(benchData);
      if (demoUsers.length > 0) {
        const u = demoUsers[0];
        setCurrentUser(u);
        setBundle(await fetchPersonaBundle(u.persona));
      }
      setLoading(false);
    }
    init();
  }, [isOffline]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleSelectUser = async (user: DemoUser) => {
    setCurrentUser(user);
    setLoading(true);
    try { setBundle(await fetchPersonaBundle(user.persona)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleOpenEvidence = (ev?: Evidence) => {
    setEvidenceModalData(ev || bundle?.summary?.evidence || null);
    setIsEvidenceOpen(true);
  };

  const handleSaveGoal = (option: any) => {
    setSavedGoals((prev) => [{
      id: Date.now(),
      title: isBn ? option.title_bn : (option.title_en || option.title_bn),
      target_display: bundle?.goal_plan?.data?.target_display || '৳১০,০০০',
      monthly_display: option.monthly_contribution_display,
      months: option.months,
    }, ...prev]);
    setGoalNotice(t.planSaved);
    setTimeout(() => setGoalNotice(null), 5000);
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;
    setChatMessages((prev) => [...prev, { sender: 'user', text }]);
    setChatInput('');

    setTimeout(() => {
      const summary = bundle?.summary?.data;
      const forecast = bundle?.forecast?.data;
      const cashout = bundle?.cashout?.data;
      const s2s = summary?.safe_to_spend;
      const lc = text.toLowerCase();

      let reply = '';
      const aboutSpend = text.includes('খরচ') || text.includes('নিরাপদ') || text.includes('কত টাকা') || lc.includes('spend') || lc.includes('safe') || lc.includes('balance') || lc.includes('much');
      const aboutShortfall = text.includes('টানাটানি') || text.includes('সমস্যা') || text.includes('শেষ') || lc.includes('short') || lc.includes('run out') || lc.includes('week') || lc.includes('forecast');
      const aboutFee = text.includes('ক্যাশ') || text.includes('ফি') || text.includes('এজেন্ট') || lc.includes('fee') || lc.includes('cash') || lc.includes('agent') || lc.includes('withdraw');
      const aboutSavings = text.includes('সঞ্চয়') || text.includes('জমানো') || text.includes('লক্ষ্য') || text.includes('হাজার') || lc.includes('save') || lc.includes('saving') || lc.includes('goal') || lc.includes('thousand');

      if (aboutSpend) {
        const isDeficit = s2s?.status === 'deficit';
        if (isBn) {
          reply = isDeficit
            ? `⚠️ আপনার ওয়ালেটে ${summary?.balance_display || '৳৫,১৩৫'} আছে কিন্তু আগামী ১৪ দিনে ${s2s?.upcoming_commitments_display || '৳১০,৫৪৭'} বিল আসছে। এই মুহূর্তে অপ্রয়োজনীয় খরচ একেবারে বন্ধ রাখুন। বেতন আসার পরে অবস্থা উন্নত হবে।`
            : `আপনার ওয়ালেটে এখন ${summary?.balance_display || '৳৫,১৩৫'} এবং হাতে নগদ আনুমানিক ${s2s?.estimated_cash_display || summary?.cash_on_hand?.estimated_cash_display || '৳১,২২৫'}। আগামী ১৪ দিনের বিল মিটিয়ে নিরাপদে ${s2s?.safe_to_spend_total_display || '৳০'} খরচ করা যাবে — অর্থাৎ প্রতিদিন ${s2s?.daily_safe_budget_display || '৳০'}।`;
        } else {
          reply = isDeficit
            ? `⚠️ Your wallet has ${summary?.balance_display || '৳5,135'} but bills of ${s2s?.upcoming_commitments_display || '৳10,547'} are coming in the next 14 days. Stop all unnecessary spending now. Things will improve after your salary arrives.`
            : `Your wallet has ${summary?.balance_display} and ~${s2s?.estimated_cash_display || summary?.cash_on_hand?.estimated_cash_display || '৳1,225'} in cash. After all upcoming bills, you can safely spend ${s2s?.safe_to_spend_total_display || '৳0'} — about ${s2s?.daily_safe_budget_display || '৳0'} per day.`;
        }
      } else if (aboutShortfall) {
        if (isBn) {
          reply = `আগামী ${forecast?.horizon_days || 21} দিনে টাকা কম পড়ার আশঙ্কা ${forecast?.shortfall_prob_display || '৭১%'}। ${forecast?.trough_date ? `${forecast.trough_date} নাগাদ` : 'আগামী সপ্তাহের মধ্যে'} সবচেয়ে কঠিন সময় আসতে পারে। এই সময়ে শুধু প্রয়োজনীয় খরচ করুন।`;
        } else {
          reply = `Over the next ${forecast?.horizon_days || 21} days, there's a ${forecast?.shortfall_prob_display || '71%'} chance of running short. ${forecast?.trough_date ? `Around ${forecast.trough_date}` : 'Within the next week'} could be the toughest period. Only spend on essentials.`;
        }
      } else if (aboutFee) {
        const annual = cashout?.replaceable_fee_saved_paisa ? Math.round(cashout.replaceable_fee_saved_paisa * 12 / 100) : 0;
        if (isBn) {
          reply = `আপনি এজেন্ট থেকে ${cashout?.total_cashouts || 70} বার ক্যাশ-আউট করে মোট ${cashout?.total_fees_display || '৳১,৩৩৪'} ফি দিয়েছেন। যদি সেসব পেমেন্ট সরাসরি মোবাইল ব্যাংকিং থেকে করতেন, ${cashout?.replaceable_fee_saved_display || '৳৩৯০'} বাঁচতো — বার্ষিক হিসাবে প্রায় ৳${annual.toLocaleString('bn')}।`;
        } else {
          reply = `You've made ${cashout?.total_cashouts || 70} cash-outs paying ${cashout?.total_fees_display || '৳1,334'} in total fees. If you'd used mobile banking instead, you could have saved ${cashout?.replaceable_fee_saved_display || '৳390'} — about ৳${annual.toLocaleString()} per year.`;
        }
      } else if (aboutSavings) {
        if (isBn) {
          reply = `সঞ্চয়ের সবচেয়ে কার্যকর উপায়: বেতন পাওয়ার সাথে সাথে একটি নির্দিষ্ট অংক সরিয়ে রাখুন। 'পরিকল্পনা' ট্যাবে গিয়ে লক্ষ্য ঠিক করুন — আমি বলব প্রতি মাসে কত জমালে কখন সেই লক্ষ্যে পৌঁছানো যাবে।`;
        } else {
          reply = `The most effective way to save: set aside a fixed amount the moment your salary arrives. Go to the 'Planner' tab to set your goal — I'll tell you exactly how much to save each month to reach it.`;
        }
      } else {
        if (isBn) {
          reply = `আমি নিরাপদ ব্যয়ের সীমা, টাকার পূর্বাভাস, ফি বিশ্লেষণ এবং সঞ্চয় পরিকল্পনায় সাহায্য করতে পারি। টাকা স্থানান্তর বা ঋণের ব্যাপারে কোনো সিদ্ধান্ত নিই না।`;
        } else {
          reply = `I can help with safe spending limits, cash flow forecasts, fee analysis, and savings plans. I never make decisions about money transfers or loans.`;
        }
      }

      setChatMessages((prev) => [...prev, { sender: 'assistant', text: reply, evidence: bundle?.summary?.evidence }]);
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

  const isDeficit = safeToSpend?.status === 'deficit';
  const statusLabel = safeToSpend?.status === 'comfortable' ? t.comfortable : safeToSpend?.status === 'cautious' ? t.cautious : safeToSpend?.status === 'deficit' ? t.deficit : t.tight;
  const statusColor = (safeToSpend?.status === 'comfortable') ? 'var(--state-success)' : (safeToSpend?.status === 'cautious') ? 'var(--state-caution)' : 'var(--state-error)';
  const statusBg = (safeToSpend?.status === 'comfortable') ? 'rgba(22,163,74,0.1)' : (safeToSpend?.status === 'cautious') ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)';

  const riskLabel = forecast?.risk_level === 'high' ? t.riskHigh : forecast?.risk_level === 'medium' ? t.riskMedium : t.riskLow;
  const riskColor = forecast?.risk_level === 'high' ? 'var(--state-error)' : forecast?.risk_level === 'medium' ? 'var(--state-caution)' : 'var(--state-success)';

  const goalTypes = [
    { id: 'emergency_fund', label: t.emergency },
    { id: 'education', label: t.education },
    { id: 'family_support', label: t.family },
    { id: 'device_purchase', label: t.device },
  ];

  // Annual savings estimate from cashout
  const annualFeeSavings = cashout?.replaceable_fee_saved_paisa
    ? `৳${Math.round(cashout.replaceable_fee_saved_paisa * 12 / 100).toLocaleString('bn')}`
    : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-grouped)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))' }}>
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

            {/* Track 03 badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.18)', width: 'fit-content', margin: '0 auto' }}>
              <Zap size={13} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.3px' }}>{t.track}</span>
            </div>

            {/* 1. DEFICIT WARNING BANNER (if applicable) */}
            {isDeficit && (
              <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertTriangle size={18} color="var(--state-error)" style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--state-error)', marginBottom: '2px' }}>{t.deficit}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.deficitWarning}</p>
                </div>
              </div>
            )}

            {/* 2. SAFE-TO-SPEND HERO CARD */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${isDeficit ? 'rgba(220,38,38,0.2)' : 'var(--border-default)'}`,
                padding: '22px 20px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: isDeficit ? 'linear-gradient(90deg, var(--state-error), #F87171)' : 'linear-gradient(90deg, var(--accent-primary), #38BDF8)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={18} color={isDeficit ? 'var(--state-error)' : 'var(--accent-primary)'} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.safeSpend}</span>
                </div>
                <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 'var(--radius-full)', backgroundColor: statusBg, color: statusColor, fontWeight: 700 }}>
                  {statusLabel}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 4px 0' }}>
                <h1 style={{ fontSize: '2.6rem', fontWeight: 800, color: isDeficit ? 'var(--state-error)' : 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>
                  {safeToSpend?.safe_to_spend_total_display || summary?.balance_display || '৳০'}
                </h1>
              </div>

              {!isDeficit && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {safeToSpend?.daily_safe_budget_display || '৳০'} {t.perDay}
                </p>
              )}

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
                {isDeficit ? (isBn ? safeToSpend?.advice_bn : safeToSpend?.advice_en) : t.safeSpendSub}
              </p>

              {/* Breakdown grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', fontSize: '0.78rem', marginBottom: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>{t.walletBalance}</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{summary?.balance_display || '৳০'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                    {t.cashInHand}
                    <button onClick={() => setShowCashInHandInfo(!showCashInHandInfo)} style={{ background: 'transparent', marginLeft: '4px', color: 'var(--text-muted)', verticalAlign: 'middle' }}>
                      <Info size={11} />
                    </button>
                  </span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{cashOnHand?.estimated_cash_display || safeToSpend?.estimated_cash_display || '৳০'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>{t.upcomingBills}</span>
                  <strong style={{ color: 'var(--state-caution)', fontSize: '0.95rem' }}>-{safeToSpend?.upcoming_commitments_display || '৳০'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>{t.safetyBuffer}</span>
                  <strong style={{ color: 'var(--state-success)', fontSize: '0.95rem' }}>{safeToSpend?.safety_buffer_display || '৳০'}</strong>
                </div>
              </div>

              {/* Cash-in-hand explainer */}
              {showCashInHandInfo && (
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(2,132,199,0.06)', border: '1px solid rgba(2,132,199,0.2)', marginBottom: '10px' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>{t.howSathiKnows}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.howSathiKnowsDetail}</p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {summary?.as_of_date ? `${t.updatedOn} ${summary.as_of_date}` : ''}
                </span>
                <button
                  id="verify-evidence-btn"
                  onClick={() => handleOpenEvidence(bundle?.summary?.evidence)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--accent-primary)', background: 'var(--accent-tint)', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(2,132,199,0.2)' }}
                >
                  <ShieldCheck size={12} />
                  <span>{t.verifyData}</span>
                </button>
              </div>
            </div>

            {/* 3. CORE METRICS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: t.monthlyIncome, sub: t.regularIncome, value: metrics?.monthly_income_display || '৳০', color: 'var(--state-success)', icon: <ArrowDownLeft size={15} />, bg: 'rgba(22,163,74,0.08)' },
                { label: t.monthlySpend, sub: t.dailyExpenses, value: metrics?.monthly_spend_display || '৳০', color: 'var(--text-primary)', icon: <ArrowUpRight size={15} />, bg: 'rgba(15,23,42,0.04)' },
                { label: t.bufferDays, sub: t.emergencyDays, value: `${metrics?.buffer_days_display || '০'} ${isBn ? 'দিন' : 'd'}`, color: 'var(--state-caution)', icon: <Calendar size={15} />, bg: 'rgba(217,119,6,0.08)' },
                { label: t.feeSavable, sub: t.digitalSavings, value: metrics?.fee_leakage_display || '৳০', color: 'var(--accent-primary)', icon: <Coins size={15} />, bg: 'rgba(2,132,199,0.08)' },
              ].map((m, i) => (
                <div key={i} style={{ backgroundColor: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>{m.icon}</div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700, color: m.color, marginBottom: '2px' }}>{m.value}</p>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.sub}</span>
                </div>
              ))}
            </div>

            {/* 4. RECURRING */}
            {recurring && (recurring.outflows?.length > 0 || recurring.inflows?.length > 0) && (
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.recurringTitle}</h3>
                  </div>
                  <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'var(--accent-tint)', color: 'var(--accent-primary)', fontWeight: 600 }}>{t.recurringSubtitle}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recurring.inflows?.map((inf: any) => (
                    <div key={inf.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.15)' }}>
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{humanCategoryTitle(inf, isBn)}</span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inf.periodicity === 'monthly' ? t.monthlyLabel : t.weeklyLabel} • {t.nextExpected}: {inf.next_expected_date}</p>
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--state-success)' }}>+{inf.amount_display}</span>
                    </div>
                  ))}
                  {recurring.outflows?.slice(0, 4).map((out: any) => (
                    <div key={out.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{humanCategoryTitle(out, isBn)}</span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{out.periodicity === 'monthly' ? t.monthlyLabel : t.weeklyLabel} • {t.nextExpected}: {out.next_expected_date}</p>
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--state-caution)' }}>-{out.amount_display}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. INSIGHTS */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Lightbulb size={18} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.insightsTitle}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {summary?.insights && summary.insights.length > 0 ? (
                  summary.insights.map((ins: any, idx: number) => (
                    <div key={idx} style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--accent-tint)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {ins.label === 'Data' ? (isBn ? '📊 তথ্য' : '📊 Data') : ins.label === 'Prediction' ? (isBn ? '🔮 পূর্বাভাস' : '🔮 Forecast') : (isBn ? '💡 পরামর্শ' : '💡 Tip')}
                        </span>
                        <button onClick={() => handleOpenEvidence(bundle?.summary?.evidence)} style={{ color: 'var(--text-muted)', background: 'transparent' }}><Info size={13} /></button>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                        {isBn ? ins.text_bn : (ins.text_en || ins.text_bn)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {isBn ? `বর্তমান ব্যালেন্স দিয়ে প্রায় ${metrics?.buffer_days_display || '০'} দিনের খরচ চলবে।` : `Current balance covers about ${metrics?.buffer_days_display || '0'} days of expenses.`}
                  </p>
                )}
              </div>
            </div>

            {/* 6. CATEGORY BREAKDOWN */}
            {categories.length > 0 && (
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>{t.whereMoneyGoes}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {categories.slice(0, 5).map((cat: any, idx: number) => {
                    const pct = Math.round(cat.share * 100);
                    const colors = ['var(--accent-primary)', 'var(--state-caution)', '#6366F1', 'var(--state-success)', '#EC4899'];
                    return (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '5px' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{isBn ? cat.label_bn : (cat.label_en || cat.label_bn)}</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{cat.total_display} ({cat.share_display || `${pct}%`})</span>
                        </div>
                        <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: colors[idx] || 'var(--accent-primary)', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 7. RECENT TRANSACTIONS */}
            {txns.length > 0 && (
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>{t.recentTxns}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {txns.slice(0, 7).map((txn: any) => {
                    const isInflow = txn.direction === 'in';
                    return (
                      <div key={txn.txn_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-default)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isInflow ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isInflow ? 'var(--state-success)' : 'var(--state-error)', flexShrink: 0 }}>
                            {isInflow ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                          </div>
                          <div>
                            <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {isBn ? (txn.category?.label_bn || txn.type) : (txn.category?.label_en || txn.category?.label_bn || txn.type)}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {isBn ? (txn.category?.reason_bn || txn.ts?.split('T')[0]) : (txn.category?.reason_en || txn.category?.reason_bn || txn.ts?.split('T')[0])}
                            </p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '0.88rem', fontWeight: 700, color: isInflow ? 'var(--state-success)' : 'var(--text-primary)' }}>{isInflow ? '+' : '-'}{txn.amount_display}</p>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.balanceAfter}: {txn.balance_after_display}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: FORECAST */}
        {/* ============================================================== */}
        {currentTab === 'forecast' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!forecast ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
                <TrendingUp size={32} style={{ marginBottom: '10px', opacity: 0.4 }} />
                <p>{t.noForecast}</p>
              </div>
            ) : (
              <>
                {/* Risk card */}
                <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', padding: '22px 20px', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: riskColor }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {t.forecastTitle} ({isBn ? `${forecast.horizon_days} দিন` : `${forecast.horizon_days} days`})
                    </span>
                    <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 'var(--radius-full)', backgroundColor: forecast?.risk_level === 'high' ? 'rgba(220,38,38,0.1)' : forecast?.risk_level === 'medium' ? 'rgba(217,119,6,0.1)' : 'rgba(22,163,74,0.1)', color: riskColor, fontWeight: 700 }}>
                      {riskLabel}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.shortfallChance}</span>
                  <h2 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1, marginBottom: '10px' }}>
                    {forecast.shortfall_prob_display}
                  </h2>
                  {forecast.trough_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(217,119,6,0.07)' }}>
                      <Calendar size={14} color="var(--state-caution)" />
                      <span style={{ fontSize: '0.8rem', color: 'var(--state-caution)', fontWeight: 500 }}>{t.lowestBalDate}: {forecast.trough_date}</span>
                    </div>
                  )}
                </div>

                {/* AI Benchmark */}
                {benchmark && (
                  <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Award size={18} color="var(--accent-primary)" />
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.aiVsBasic}</h3>
                      </div>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(22,163,74,0.12)', color: 'var(--state-success)', fontWeight: 700 }}>
                        {benchmark.brier_score?.brier_skill_percentage_display} {t.aiMoreAccurate}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.55 }}>{t.aiExplain}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.bssLabel}</span>
                        <strong style={{ fontSize: '1.2rem', color: 'var(--state-success)' }}>{benchmark.brier_score?.brier_skill_percentage_display}</strong>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>{t.bssExplain}</span>
                      </div>
                      <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(2,132,199,0.06)', border: '1px solid rgba(2,132,199,0.2)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.earlyWarning}</span>
                        <strong style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>0.92 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>vs 0.65</span></strong>
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

                {/* Daily Forecast with column headers */}
                {forecast.days && forecast.days.length > 0 && (
                  <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.dailyForecastTitle}</h3>
                    {/* Column headers */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px 8px 10px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-default)', marginBottom: '6px' }}>
                      <span style={{ width: '52px' }}>{isBn ? 'তারিখ' : 'Date'}</span>
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around' }}>
                        <span style={{ color: 'var(--text-muted)' }}>⬇ {t.conservative}</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>◎ {t.mostLikely}</span>
                        <span style={{ color: 'var(--text-muted)' }}>⬆ {t.optimistic}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {forecast.days.slice(0, 10).map((d: any, idx: number) => {
                        const dayName = d.date.split('-').slice(1).join('/');
                        const isNegative = d.p50_paisa < 0;
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: isNegative ? 'rgba(220,38,38,0.04)' : 'var(--bg-surface-raised)', border: `1px solid ${isNegative ? 'rgba(220,38,38,0.15)' : 'var(--border-default)'}`, fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-secondary)', width: '48px', fontWeight: 500 }}>{dayName}</span>
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around' }}>
                              <span style={{ color: d.p10_paisa < 0 ? 'var(--state-error)' : 'var(--text-muted)', fontSize: '0.75rem' }}>{d.p10_display}</span>
                              <span style={{ fontWeight: 700, color: isNegative ? 'var(--state-error)' : 'var(--accent-primary)' }}>{d.p50_display}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{d.p90_display}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coach advice */}
                <div style={{ backgroundColor: 'rgba(2,132,199,0.05)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2,132,199,0.2)' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{t.coachAdvice}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t.forecastAdvice}</p>
                </div>
              </>
            )}
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

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>{t.goalType}</p>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
                {goalTypes.map((gt) => (
                  <button key={gt.id} onClick={() => setGoalType(gt.id)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-full)', backgroundColor: goalType === gt.id ? 'var(--accent-primary)' : 'var(--bg-surface-raised)', border: goalType === gt.id ? 'none' : '1px solid var(--border-default)', color: goalType === gt.id ? '#FFF' : 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: goalType === gt.id ? 700 : 400, flexShrink: 0 }}>
                    {gt.label}
                  </button>
                ))}
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>{t.targetAmount}</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {[{ label: '৳৫,০০০', paisa: 500000 }, { label: '৳১০,০০০', paisa: 1000000 }, { label: '৳২০,০০০', paisa: 2000000 }, { label: '৳৫০,০০০', paisa: 5000000 }].map((chip) => (
                  <button key={chip.paisa} onClick={() => setTargetPaisa(chip.paisa)} style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', backgroundColor: targetPaisa === chip.paisa ? 'var(--accent-primary)' : 'var(--bg-surface-raised)', color: targetPaisa === chip.paisa ? '#FFF' : 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600, border: targetPaisa === chip.paisa ? 'none' : '1px solid var(--border-default)' }}>
                    {chip.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t.timeline}</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{targetMonths} {t.months}</span>
              </div>
              <input type="range" min="3" max="24" value={targetMonths} onChange={(e) => setTargetMonths(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
            </div>

            {goalNotice && (
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', color: 'var(--state-success)', fontSize: '0.85rem' }}>
                {goalNotice}
              </div>
            )}

            {/* Feasibility note */}
            {goalPlan?.feasibility_note_bn && (
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--state-caution)', marginBottom: '2px' }}>{t.feasibilityNote}</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {isBn ? goalPlan.feasibility_note_bn : (goalPlan.feasibility_note_en || goalPlan.feasibility_note_bn)}
                </p>
              </div>
            )}

            {/* Plan options */}
            {goalPlan?.options && goalPlan.options.length > 0 ? (
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.planOptions}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {goalPlan.options.map((opt: any, idx: number) => (
                    <div key={idx} style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: idx === 0 ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)', padding: '16px', boxShadow: idx === 0 ? '0 4px 12px rgba(2,132,199,0.1)' : 'var(--shadow-sm)' }}>
                      {idx === 0 && <span style={{ fontSize: '0.68rem', color: 'var(--accent-primary)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>{t.recommended}</span>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{isBn ? opt.title_bn : (opt.title_en || opt.title_bn)}</span>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(22,163,74,0.12)', color: 'var(--state-success)', fontWeight: 600 }}>
                          {t.successChance}: {opt.p_goal_met_display}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                          {opt.monthly_contribution_display}<span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 400 }}> {t.perMonth}</span>
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.duration}: {opt.months} {t.months}</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
                        {t.tradeoff}: {isBn ? opt.tradeoff_bn : (opt.tradeoff_en || opt.tradeoff_bn)}
                      </p>
                      <button onClick={() => handleSaveGoal(opt)} style={{ width: '100%', padding: '9px 0', borderRadius: 'var(--radius-sm)', backgroundColor: idx === 0 ? 'var(--accent-primary)' : 'var(--bg-surface-raised)', border: idx === 0 ? 'none' : '1px solid var(--border-default)', color: idx === 0 ? '#FFF' : 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700 }}>
                        {t.savePlan}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '30px 20px', textAlign: 'center', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                <Target size={28} style={{ marginBottom: '8px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.85rem' }}>{t.noPlanYet}</p>
              </div>
            )}

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
            <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', padding: '20px', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Receipt size={20} color="var(--state-caution)" />
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.cashoutTitle}</h2>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>{t.cashoutSub}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.totalFees}</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--state-caution)' }}>{cashout?.total_fees_display || '৳০'}</p>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{cashout?.total_cashouts || 0} {t.cashoutCount}</span>
                </div>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t.couldSave}</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--state-success)' }}>{cashout?.replaceable_fee_saved_display || '৳০'}</p>
                  <span style={{ fontSize: '0.68rem', color: 'var(--state-success)' }}>{cashout?.replaceable_count || 0} {t.digitalEligible}</span>
                </div>
              </div>
              {/* Annual savings highlight */}
              {annualFeeSavings && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366F1' }}>{t.annualSavings}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.annualSavingsNote}</p>
                  </div>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#6366F1' }}>{annualFeeSavings}</span>
                </div>
              )}
            </div>

            {/* Digital payment tip */}
            <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(2,132,199,0.05)', border: '1px solid rgba(2,132,199,0.2)' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{t.digitalTip}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t.digitalTipDetail}</p>
            </div>

            {/* Repeat agents */}
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>{t.repeatAgents}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cashout?.patterns && cashout.patterns.length > 0 ? (
                  cashout.patterns.map((p: any, idx: number) => (
                    <div key={idx} style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{t.agentId}: {p.counterparty_id}</strong>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.count} {t.withdrawals} ({p.total_amount_display})</p>
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
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {t.chatStarters.map((starter: string, idx: number) => (
                <button key={idx} onClick={() => handleSendMessage(starter)} style={{ padding: '7px 13px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '0.76rem', flexShrink: 0, boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap' }}>
                  {starter}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0', minHeight: '300px' }}>
              {chatMessages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={idx} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: isUser ? 'var(--accent-primary)' : 'var(--bg-surface)', border: isUser ? 'none' : '1px solid var(--border-default)', borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '12px 14px', boxShadow: 'var(--shadow-sm)' }}>
                    {!isUser && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'linear-gradient(135deg, #0284C7, #0369A1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#FFF', fontWeight: 800 }}>সা</div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{t.aiLabel}</span>
                      </div>
                    )}
                    <p style={{ fontSize: '0.88rem', color: isUser ? '#FFFFFF' : 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {msg.text}
                    </p>
                    {msg.evidence && !isUser && (
                      <div style={{ marginTop: '6px' }}>
                        <button onClick={() => handleOpenEvidence(msg.evidence)} style={{ fontSize: '0.68rem', color: 'var(--accent-primary)', background: 'var(--accent-tint)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(2,132,199,0.2)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <ShieldCheck size={11} /> {t.verified}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-md)' }}>
              <button id="voice-btn" onClick={() => { setIsVoiceActive(!isVoiceActive); if (!isVoiceActive) { setTimeout(() => { setIsVoiceActive(false); handleSendMessage(isBn ? 'সামনের সপ্তাহে টাকার সমস্যা হবে?' : 'Will I run short of money this week?'); }, 2000); } }} style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: isVoiceActive ? 'var(--state-error)' : 'var(--bg-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isVoiceActive ? '#FFF' : 'var(--text-secondary)', border: '1px solid var(--border-default)', flexShrink: 0 }}>
                <Mic size={17} />
              </button>
              <input id="chat-input" type="text" placeholder={isVoiceActive ? t.listening : t.chatPlaceholder} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.88rem', minWidth: 0 }} />
              <button id="chat-send-btn" onClick={() => handleSendMessage()} style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', boxShadow: '0 2px 6px rgba(2,132,199,0.35)', flexShrink: 0 }}>
                <Send size={16} />
              </button>
            </div>

            <div style={{ textAlign: 'center', paddingBottom: '4px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.guardrail}</span>
            </div>
          </div>
        )}
      </main>

      <TabBar currentTab={currentTab} onTabChange={setCurrentTab} language={language} />
      <EvidenceModal evidence={evidenceModalData} isOpen={isEvidenceOpen} onClose={() => setIsEvidenceOpen(false)} />
    </div>
  );
}
