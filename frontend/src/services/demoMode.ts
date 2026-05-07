const DEMO_MODE_STORAGE_KEY = 'satyam.demo.mode';

export const isDemoModeEnabled = () => {
  const envValue = process.env.REACT_APP_DEMO_MODE;
  if (envValue === 'false') return false;
  if (envValue === 'true') return true;

  const stored = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
  if (stored === 'false') return false;
  return true;
};

export const setDemoModeEnabled = (enabled: boolean) => {
  localStorage.setItem(DEMO_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
};

export const getDemoModeLabel = () => (isDemoModeEnabled() ? 'Demo mode' : 'Live mode');
