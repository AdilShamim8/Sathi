/**
 * Sathi Typed API Client with seamless offline fallback support (architecture §5 / §11).
 * 
 * In offline mode or when backend is unreachable, automatically loads from
 * precomputed demo bundle (/demo/{persona}.json) without showing any blank screen.
 */

export interface DemoUser {
  user_id: string;
  persona: string;
  persona_label_bn: string;
  persona_label_en: string;
  age_band: string;
  region: string;
  income_band: string;
}

export interface Evidence {
  data_used: {
    window: string;
    as_of_date: string;
    n_transactions: number;
    source: string;
  };
  model_version: {
    forecast: string;
    categorizer: string;
  };
  config_hash: string;
  assumptions: Array<{ id: string; value: string; label: string }>;
  labels: Record<string, string>;
  generated_text?: boolean;
  prompt_version?: string | null;
  validator: {
    passed: boolean;
    fallback_used: boolean;
  };
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchDemoUsers(isOffline: boolean): Promise<DemoUser[]> {
  if (isOffline) {
    try {
      const res = await fetch('/demo/users.json');
      return await res.json();
    } catch {
      return getFallbackUsers();
    }
  }

  try {
    const res = await fetch(`${API_BASE}/v1/demo-users`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch {
    const res = await fetch('/demo/users.json');
    return await res.json();
  }
}

export async function fetchPersonaBundle(persona: string): Promise<any> {
  const res = await fetch(`/demo/${persona}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load demo bundle for ${persona}`);
  }
  return await res.json();
}

export async function fetchBenchmark(isOffline: boolean): Promise<any> {
  if (!isOffline) {
    try {
      const res = await fetch(`${API_BASE}/v1/me/benchmark`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }
  }
  try {
    const res = await fetch('/demo/benchmark.json');
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return null;
}

function getFallbackUsers(): DemoUser[] {
  return [
    {
      user_id: 'usr_000001',
      persona: 'garment_worker',
      persona_label_bn: 'রীনা (গার্মেন্টস কর্মী)',
      persona_label_en: 'Rina (Garment Worker)',
      age_band: '26-35',
      region: 'dhaka_urban',
      income_band: '15k-25k',
    },
    {
      user_id: 'usr_000002',
      persona: 'gig_driver',
      persona_label_bn: 'তারিক (গিগ ড্রাইভার)',
      persona_label_en: 'Tariq (Gig Driver)',
      age_band: '26-35',
      region: 'dhaka_urban',
      income_band: '25k-40k',
    },
    {
      user_id: 'usr_000003',
      persona: 'remittance_household',
      persona_label_bn: 'জামিলা (রেমিট্যান্স পরিবার)',
      persona_label_en: 'Jamila (Remittance Household)',
      age_band: '36-50',
      region: 'chittagong_semi_urban',
      income_band: '25k-40k',
    },
    {
      user_id: 'usr_000004',
      persona: 'shopkeeper',
      persona_label_bn: 'রফিক (মুদি দোকানি)',
      persona_label_en: 'Rafiq (Shopkeeper)',
      age_band: '36-50',
      region: 'rajshahi_rural',
      income_band: '25k-40k',
    },
    {
      user_id: 'usr_000005',
      persona: 'student',
      persona_label_bn: 'অনিক (শিক্ষার্থী)',
      persona_label_en: 'Anik (Student)',
      age_band: '18-25',
      region: 'dhaka_urban',
      income_band: 'under-15k',
    },
  ];
}
