/**
 * useTelemetryConsent — Privacy-first telemetry consent management.
 * 
 * Users explicitly choose what telemetry categories to share.
 * Default: local-only. All consent is revocable and inspectable.
 */
import { create } from 'zustand';

export interface TelemetryConsentCategories {
  cognitionTiming: boolean;
  orchestrationBehavior: boolean;
  modelPerformance: boolean;
  providerReliability: boolean;
  errorPatterns: boolean;
}

export interface TelemetryConsent {
  mode: 'local-only' | 'anonymous-sharing';
  consentedAt: string | null;
  consentVersion: number;
  categories: TelemetryConsentCategories;
}

interface TelemetryConsentState extends TelemetryConsent {
  loadConsent: () => void;
  setMode: (mode: TelemetryConsent['mode']) => void;
  setCategory: (key: keyof TelemetryConsentCategories, value: boolean) => void;
  grantConsent: () => void;
  revokeConsent: () => void;
  deleteAllData: () => void;
}

const STORAGE_KEY = 'na_telemetry_consent';
const CURRENT_VERSION = 1;

const DEFAULT_CONSENT: TelemetryConsent = {
  mode: 'local-only',
  consentedAt: null,
  consentVersion: CURRENT_VERSION,
  categories: {
    cognitionTiming: false,
    orchestrationBehavior: false,
    modelPerformance: false,
    providerReliability: false,
    errorPatterns: false,
  },
};

function persist(consent: TelemetryConsent) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch {}
}

export const useTelemetryConsent = create<TelemetryConsentState>((set, get) => ({
  ...DEFAULT_CONSENT,

  loadConsent: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TelemetryConsent;
        set({ ...parsed });
      }
    } catch { /* use defaults */ }
  },

  setMode: (mode) => {
    const consent = { ...get(), mode };
    if (mode === 'local-only') {
      // Disable all categories when switching to local-only
      consent.categories = { ...DEFAULT_CONSENT.categories };
    }
    persist(consent);
    set(consent);
  },

  setCategory: (key, value) => {
    const categories = { ...get().categories, [key]: value };
    const consent = { ...get(), categories };
    persist(consent);
    set({ categories });
  },

  grantConsent: () => {
    const consent = { ...get(), consentedAt: new Date().toISOString(), consentVersion: CURRENT_VERSION };
    persist(consent);
    set(consent);
  },

  revokeConsent: () => {
    const consent = { ...DEFAULT_CONSENT };
    persist(consent);
    set(consent);
  },

  deleteAllData: () => {
    // Clear telemetry queue and local data
    localStorage.removeItem('na_telemetry_queue');
    localStorage.removeItem('na_telemetry_local');
    const consent = { ...DEFAULT_CONSENT };
    persist(consent);
    set(consent);
  },
}));
