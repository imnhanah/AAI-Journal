import { useState } from 'react';
import { Award, CalendarDays, Check, Plus } from 'lucide-react';
import ChallengeCompletePopup from './ChallengeCompletePopup.jsx';
import './certificateArchive.css';

const money = (value, currency = 'USD') => new Intl.NumberFormat(undefined, { style:'currency', currency }).format(Number(value || 0));

export default function CertificateArchive({ certificates = [], currency = 'USD' }) {
  const [selected, setSelected] = useState(null);
  const rows = [...certificates].sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0));
  return <section className="tj-certificate-archive">
    <header><span className="tj-certificate-archive-icon"><Award size={22}/></span><div><h2>Certificates</h2><p>Challenge achievements saved to this workspace.</p></div><span className="tj-certificate-archive-count"><b>{rows.length}</b> Earned</span></header>
    {!rows.length ? <div className="tj-certificate-archive-empty"><Award size={22}/><strong>No certificates yet</strong><span>Complete a challenge to keep its certificate here.</span></div> : <div className="tj-certificate-archive-list">{rows.map((certificate) => <article key={certificate.id}>
      <span className="tj-certificate-deco" aria-hidden="true"/>
      <div className="tj-certificate-top"><span className="tj-certificate-badge"><Award size={18}/></span><div className="tj-certificate-name"><strong>{certificate.accountName}</strong><span>{certificate.modeName} · {certificate.totalLevels} levels</span></div><em className="tj-certificate-done"><Check size={12}/>Completed</em></div>
      <div className="tj-certificate-foot"><div className="tj-certificate-archive-meta"><b>{money(certificate.completionBalance ?? certificate.finalTarget, currency)}</b><span>Final balance</span><small><CalendarDays size={13}/>{new Date(certificate.completedAt || certificate.archivedAt).toLocaleDateString()}</small></div>
      <button type="button" className="tj-btn-outline" onClick={() => setSelected(certificate)}>View</button></div>
    </article>)}<div className="tj-certificate-next"><span><Plus size={18}/></span><strong>Next certificate</strong><small>Complete a challenge to earn another.</small></div></div>}
    {selected && <ChallengeCompletePopup facts={selected} money={(value) => money(value, currency)} initialView="certificate" soundEnabled={false} onClose={() => setSelected(null)}/>}
  </section>;
}
