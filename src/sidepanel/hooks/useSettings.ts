import { useState, useEffect, useCallback } from 'react';
import { Settings, DEFAULT_SETTINGS } from '../../types/settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.local.get('settings').then((result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
      }
      setLoading(false);
    });
  }, []);

  const saveSettings = useCallback(async (newSettings: Settings) => {
    await chrome.storage.local.set({ settings: newSettings });
    setSettings(newSettings);
  }, []);

  return { settings, saveSettings, loading };
}
