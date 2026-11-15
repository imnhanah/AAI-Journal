import { useState } from 'react';
import ChallengeSetupWindow from './ChallengeSetupWindow.jsx';

const mockAccount = { id: 'harness', name: 'Demo Account', baseCurrency: 'USD' };
const defaultSetup = { name: 'Demo Account', mode: 'risk', reward: 1.5, levelCount: 30, adaptiveRiskPct: 10, adaptiveDrawdownPct: 50 };

export default function LocalChallengeHarness() {
  const [setup, setSetup] = useState(defaultSetup);
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }}>
      <ChallengeSetupWindow
        setup={setup}
        setSetup={setSetup}
        account={mockAccount}
        balance={10000}
        locked={false}
        saving={false}
        deleting={false}
        isNew={true}
        onCancel={() => {}}
        onSave={(s) => alert(JSON.stringify(s, null, 2))}
        onDelete={() => {}}
      />
    </div>
  );
}
