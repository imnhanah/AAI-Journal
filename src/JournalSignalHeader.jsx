import React from 'react';
import { journalSignal } from './journalSignals';
import { TRADING_QUOTES } from './loginQuote';
let lastQuoteIndex = -1;

function nextQuoteIndex() {
  if (TRADING_QUOTES.length < 2) return 0;
  let remembered = lastQuoteIndex;
  try {
    const saved = Number(window.sessionStorage.getItem('aaicorefx:last-trading-quote'));
    if (Number.isInteger(saved) && saved >= 0 && saved < TRADING_QUOTES.length) remembered = saved;
  } catch {}
  let index = Math.floor(Math.random() * TRADING_QUOTES.length);
  if (index === remembered) index = (index + 1 + Math.floor(Math.random() * (TRADING_QUOTES.length - 1))) % TRADING_QUOTES.length;
  lastQuoteIndex = index;
  try { window.sessionStorage.setItem('aaicorefx:last-trading-quote', String(index)); } catch {}
  return index;
}

export function TradingQuote({ quote }) {
  return <aside className="tj-dashboard-quote" aria-label="Trading quote"><div><strong>Trading Quote</strong><blockquote>“{quote}”</blockquote></div></aside>;
}

export default function JournalSignalHeader({loginQuote, ...data}) {
  const names = {tradelog:'Trade Log',reviews:'Review',markups:'Markups',dashboard:'Dashboard',calendar:'Calendar',challenge:'Challenge',backtest:'Backtest',analytics:'Analytics',finance:'Finance',psychology:'Psychology',insights:'Insights',news:'News'};
  const message = journalSignal(data);
  const [quoteIndex] = React.useState(nextQuoteIndex);
  const pageQuote = TRADING_QUOTES[quoteIndex] || loginQuote;
  return <section className={`tj-dashboard-welcome tj-signal-page-${data.page}`} aria-label={`${names[data.page] || 'Journal'} insight`}>
    <div className="tj-dashboard-welcome-copy"><h1>{data.page === 'news' ? <span className="tj-news-desktop-headline">{message.title}<br/></span> : <>{message.title}<br/></>}<span className="tj-signal-secondary">{message.subtitle}</span></h1><p>{message.detail}</p></div>
    <TradingQuote quote={pageQuote}/>
  </section>;
}
