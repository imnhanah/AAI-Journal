import React, { useSyncExternalStore } from 'react';
import { ThemeSelect } from './JournalControls';
import { LANGUAGES, getLanguage, setLanguage, subscribeLanguage, translate } from './localization';
import './localization.css';

export function useLanguage() {
  return [useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en'), setLanguage];
}
export default function LanguageSelector({ publicSite = false, value, onChange }) {
  const [language, changeLanguage] = useLanguage();
  const current = value ?? language;
  const change = next => (onChange || changeLanguage)(next);
  const options = LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.name}</option>);
  return publicSite ? <div className="pub-language"><ThemeSelect compact label={translate('Language')} value={current} onChange={event => change(event.target.value)}>{options}</ThemeSelect></div>
    : <ThemeSelect label={translate('Language')} value={current} onChange={event => change(event.target.value)}>{options}</ThemeSelect>;
}
