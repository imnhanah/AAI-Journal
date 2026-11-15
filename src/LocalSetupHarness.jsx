import { useState } from 'react';
import DesktopJournalSetup from './DesktopJournalSetup.jsx';

const noop = () => {};
const asyncNoop = async () => {};

const MOCK_ROUTINE = {
  items: [
    { id: 'r1', group: 'before', text: 'Check economic calendar', enabled: true, locked: false },
    { id: 'r2', group: 'before', text: 'Review overnight news', enabled: true, locked: false },
    { id: 'r3', group: 'before', text: 'Mark key levels on D1', enabled: true, locked: false },
    { id: 'r4', group: 'pretrade', text: 'Confirm higher-TF bias', enabled: true, locked: false },
    { id: 'r5', group: 'pretrade', text: 'Check spread is acceptable', enabled: true, locked: false },
    { id: 'r6', group: 'pretrade', text: 'Set SL and TP before entry', enabled: true, locked: false },
  ],
  history: [
    { date: '2026-11-11', done: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'] },
    { date: '2026-11-12', done: ['r1', 'r2', 'r3', 'r4'] },
  ],
};

const MOCK_PRESETS = [
  { name: 'Conservative', risk: 0.5, rr: 3 },
  { name: 'Standard', risk: 1, rr: 2.5 },
  { name: 'Aggressive', risk: 2, rr: 2 },
];

const MOCK_ACCOUNT = {
  rules: [
    { id: 'rule1', text: 'Only trade during London or NY session' },
    { id: 'rule2', text: 'No more than 2 trades per day' },
    { id: 'rule3', text: 'Never move SL to breakeven within 1R' },
  ],
  baseCurrency: 'USD',
};

export default function LocalSetupHarness() {
  const [section, setSection] = useState('daily-routine');
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0' }} className="tj-root">
      <DesktopJournalSetup
        section={section}
        onSection={setSection}
        membershipAdmin={false}
        membershipPanel={null}
        userId="test-user"
        account={MOCK_ACCOUNT}
        certificates={[]}
        typeTags={['HTF alignment', 'Confluence zone', 'Clean structure', 'Volume spike']}
        mistakeTags={['Chased entry', 'Moved SL early']}
        mistakeDefaults={['FOMO entry', 'Revenge trade', 'Oversize position', 'No plan']}
        confluenceSessions={['Breakout', 'Pullback', 'Reversal', 'Continuation']}
        instruments={[{ symbol: 'EURUSD' }, { symbol: 'GBPUSD' }, { symbol: 'XAUUSD' }, { symbol: 'NAS100' }]}
        riskPresets={MOCK_PRESETS}
        onRiskPresets={asyncNoop}
        onTypeTags={asyncNoop}
        onMistakes={asyncNoop}
        onConfluence={asyncNoop}
        onInstruments={asyncNoop}
        onAddRule={asyncNoop}
        onUpdateRule={asyncNoop}
        onRemoveRule={asyncNoop}
        onExportBackup={noop}
        onImportBackup={noop}
        onRestoreSnapshot={asyncNoop}
        onUpdateRoutine={asyncNoop}
        routine={MOCK_ROUTINE}
        snapshots={[]}
        localOnly={false}
      />
    </div>
  );
}
