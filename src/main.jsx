import React from "react";
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import ReactDOM from "react-dom/client";
import './themeTokens.css?theme-tokens=4';
import './typographyTokens.css';
import './analyticsLayout.css';
import TradingJournal from "./TradingJournal.jsx?header-controls=98";
import './shellAlignment.css';
import './financeRedesign.css';
import './backtestRedesign.css';
import './calendarDayPopup.css';
import './reviewLibraryRedesign.css';
import './mobileFrame.css';
import './mobileCalendar.css';
import './mobileReview.css';
import './mobileProfile.css';
import './mobileLogTrade.css';
import './mobileMarkups.css';
import './mobileDashboard.css';
import './mobileAnalytics.css';
import './mobileBacktest.css';
import './mobilePsychology.css';
import './mobileNews.css';
import './mobileChallenge.css';
import './mobileManagement.css';
import './mobileAccountSettings.css';
import './mobilePopups.css';
import './mobileRules.css';
import './unifiedCardSurfaces.css';
import './tradeLogThemeFix.css?review-controls=3';
import './selectedControlBorders.css?selected-controls=12';
import './borderlessInterface.css?borderless-interface=1';
import './writingFields.css?writing-fields=1';
import { useLanguage } from './LanguageSelector';
import { loadAccent } from './siteTheme';

function LocalizedApp() {
  const [language] = useLanguage();
  return <TradingJournal language={language}/>;
}

loadAccent();
// Keep a single React root when styles or translated copy reload in development.
const appRoot = import.meta.hot?.data.root || ReactDOM.createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = appRoot;
appRoot.render(
  <React.StrictMode>
    <React.Suspense fallback={<div role="status" style={{padding: '24px', color: 'var(--text)', background: 'var(--bg)'}}>Loading…</div>}>
      <LocalizedApp />
    </React.Suspense>
  </React.StrictMode>
);
