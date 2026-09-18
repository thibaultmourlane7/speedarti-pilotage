import { initialState } from './data.js';

// PILOT-DEMO-002 — Cache local de reprise. Supabase est la source de vérité depuis V12.
const STORAGE_KEY = 'speedarti-pilotage-demo-v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...clone(initialState), ...JSON.parse(raw) } : clone(initialState);
  } catch {
    return clone(initialState);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return clone(initialState);
}
