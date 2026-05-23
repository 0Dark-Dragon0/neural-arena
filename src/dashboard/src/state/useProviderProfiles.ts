/**
 * useProviderProfiles — Persistent provider profile management.
 * 
 * Stores provider configurations (without full API keys) in localStorage.
 * Enables quick-launch from saved profiles and profile switching.
 */
import { create } from 'zustand';

export interface ProviderProfile {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKeyHint: string;   // Last 4 chars only — never store full key
  createdAt: string;
  lastUsed: string;
}

interface ProviderProfilesState {
  profiles: ProviderProfile[];
  activeProfileId: string | null;

  loadProfiles: () => void;
  saveProfile: (profile: Omit<ProviderProfile, 'id' | 'createdAt' | 'lastUsed'>) => string;
  updateProfile: (id: string, updates: Partial<ProviderProfile>) => void;
  deleteProfile: (id: string) => void;
  setActive: (id: string) => void;
  getProfile: (id: string) => ProviderProfile | undefined;
  markUsed: (id: string) => void;
}

const STORAGE_KEY = 'na_provider_profiles';
const ACTIVE_KEY = 'na_active_profile';

function generateId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function persist(profiles: ProviderProfile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch { /* storage full — silently fail */ }
}

export const useProviderProfiles = create<ProviderProfilesState>((set, get) => ({
  profiles: [],
  activeProfileId: null,

  loadProfiles: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const profiles = raw ? JSON.parse(raw) as ProviderProfile[] : [];
      const activeProfileId = localStorage.getItem(ACTIVE_KEY) || null;
      set({ profiles, activeProfileId });
    } catch {
      set({ profiles: [], activeProfileId: null });
    }
  },

  saveProfile: (data) => {
    const id = generateId();
    const now = new Date().toISOString();
    const profile: ProviderProfile = { ...data, id, createdAt: now, lastUsed: now };
    const profiles = [...get().profiles, profile];
    persist(profiles);
    set({ profiles });
    return id;
  },

  updateProfile: (id, updates) => {
    const profiles = get().profiles.map(p => p.id === id ? { ...p, ...updates } : p);
    persist(profiles);
    set({ profiles });
  },

  deleteProfile: (id) => {
    const profiles = get().profiles.filter(p => p.id !== id);
    persist(profiles);
    const activeProfileId = get().activeProfileId === id ? null : get().activeProfileId;
    if (activeProfileId !== get().activeProfileId) localStorage.removeItem(ACTIVE_KEY);
    set({ profiles, activeProfileId });
  },

  setActive: (id) => {
    localStorage.setItem(ACTIVE_KEY, id);
    set({ activeProfileId: id });
  },

  getProfile: (id) => get().profiles.find(p => p.id === id),

  markUsed: (id) => {
    const profiles = get().profiles.map(p =>
      p.id === id ? { ...p, lastUsed: new Date().toISOString() } : p
    );
    persist(profiles);
    set({ profiles });
  },
}));
