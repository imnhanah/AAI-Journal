import { useRef, useState } from 'react';
import { useConfirmation } from './ConfirmationDialog.jsx';
import { prepareJournalPromotion, publishJournalPromotion } from './journalPromotion.js';

const tableLabel = value => value.replaceAll('_', ' ');

export default function JournalPromotion({ userId }) {
  const confirm = useConfirmation();
  const [plan, setPlan] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  const run = async task => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    try { await task(); }
    catch (problem) { setError(problem.message || 'Could not publish device data.'); }
    finally { setBusy(false); working.current = false; }
  };

  const review = () => run(async () => {
    setPlan(null);
    setMessage('Reading device data and checking cloud records…');
    setPlan(await prepareJournalPromotion(userId));
    setMessage('');
  });

  const publish = () => run(async () => {
    const accepted = await confirm({
      title: 'Publish this device’s data?',
      description: 'The app will add missing records and reuse identical records. If a cloud record differs, publishing stops. Your device data stays available.',
      confirmLabel: 'Publish device data',
    });
    if (!accepted) return;
    await publishJournalPromotion(plan,setMessage);
    setPlan(null);
    setMessage('Cloud save confirmed. Open Cloud Sync in Profile Settings to view the cloud journal.');
  });

  return <section className="tj-management-collection" aria-label="Publish device data">
    <h3>Publish device data</h3>
    <p>Add records and verified images from this device to your cloud journal.</p>
    <button type="button" className="tj-btn-outline" disabled={busy} onClick={review}>Preview cloud publish</button>
    {plan && <div>
      <p>{plan.count} records{plan.library ? ' and a Case Study Library' : ''} checked.</p>
      {plan.conflicts.length > 0 && <>
        <p role="alert">These cloud records differ from this device. Review both copies before retrying.</p>
        <ul>{plan.conflicts.map((item,index) => <li key={index}>
          {tableLabel(item.table)}{item.revision ? ` · Cloud revision ${item.revision}` : ''}
        </li>)}</ul>
      </>}
      {(plan.count > 0 || plan.library) && plan.conflicts.length === 0 &&
        <button type="button" className="tj-btn-primary" disabled={busy} onClick={publish}>Review and publish</button>}
    </div>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
