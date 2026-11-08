// Desktop Profile in the side panel (shell v2, after aaicorefx-desktop-shell.html). Presentation only:
// ProfileSettingsModal owns every value and handler, exactly as it does for the phone layout.
import { Check, Globe, ImagePlus, KeyRound, Lock, Monitor, Moon, PanelRight, Palette, Pencil, Sun, Trash2, X } from 'lucide-react';
import { useRef } from 'react';
import { ThemeSelect } from './JournalControls';
import { DARK_THEMES, LIGHT_THEMES } from './ThemeGrid';
import './desktopProfile.css';

const TIMEZONES = ['Africa/Accra', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai'];

const Card = ({ icon: Icon, title, sub, aside, className = '', children }) => <section className={`sp-card ${className}`}>
  <header className="sp-card-head"><i aria-hidden="true"><Icon size={16} strokeWidth={2.2}/></i><div><h3>{title}</h3>{sub && <small>{sub}</small>}</div>{aside && <div className="sp-card-aside">{aside}</div>}</header>
  {children}
</section>;

const Switch = ({ on, label, disabled, onChange }) => <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`pf2-sw ${on ? 'is-on' : ''}`} onClick={onChange}><i/></button>;

// "Now" in the chosen zone and formats, so the preview shows exactly what the app will show.
function nowPreview({ timezone, dateFormat, timeFormat }) {
  const now = new Date();
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(now).map((part) => [part.type, part.value]));
    const date = dateFormat === 'MM/DD/YYYY' ? `${parts.month}/${parts.day}/${parts.year}` : dateFormat === 'YYYY-MM-DD' ? `${parts.year}-${parts.month}-${parts.day}` : `${parts.day}/${parts.month}/${parts.year}`;
    const time = new Intl.DateTimeFormat(timeFormat === '24' ? 'en-GB' : 'en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: timeFormat !== '24' }).format(now);
    return `${date} · ${time}`;
  } catch { return '—'; }
}

export default function DesktopProfilePanel({ identity, photo, appearance, region, panels, privacy, sync, password, onDelete, onClose, onSave, saveDisabled, saving, dirty }) {
  const photoRef = useRef(null);
  const themes = appearance.mode === 'light' ? LIGHT_THEMES : DARK_THEMES;
  const current = appearance.palettes?.[appearance.mode] || 'default';
  const currentName = themes.find((theme) => theme.id === `${appearance.mode}-${current}`)?.name || 'Default';
  return <div className="sp-form pf2">
    <header className="pf2-head">
      <div className="pf2-av-wrap">
        <button type="button" className="pf2-av" aria-label="Change profile photo" onClick={() => photoRef.current?.click()}>{photo.image ? <img src={photo.image} alt=""/> : photo.initials}</button>
        <button type="button" className="pf2-av-tool" aria-label="Upload photo" title="Upload photo" onClick={() => photoRef.current?.click()}><ImagePlus size={12}/></button>
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(event) => { photo.onUpload(event.target.files); event.target.value = ''; }}/>
      </div>
      <div className="pf2-id">
        <div className="pf2-name">{identity.editing
          ? <input className="tj-input pf2-name-in" autoFocus maxLength={40} aria-label="Display name" value={identity.name} onChange={(event) => identity.onName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && identity.onEdit()}/>
          : <><h2>{identity.name.trim() || 'Your name'}</h2>{identity.verified && <span className="pf2-vf"><Check size={11} strokeWidth={3.2}/>Verified</span>}</>}</div>
        <small>{identity.email || 'No email address'}</small>
      </div>
      <button type="button" className="pf2-btn" onClick={identity.onEdit}>{identity.editing ? <><Check size={15} strokeWidth={2.6}/>Done</> : <><Pencil size={15}/>Edit</>}</button>
      <button type="button" className="tj-modal-close sp-close" aria-label="Close profile" title="Close (Esc)" onClick={onClose}><X size={16} strokeWidth={2.4}/></button>
    </header>
    {photo.message && <p className="pf2-note" role="status">{photo.message}</p>}
    <div className="sp-summary">
      <div><small>Member since</small><b>{identity.memberSince}</b></div>
      <div><small>Last sign-in</small><b>{identity.lastSignIn}</b></div>
      <div><small>Theme</small><b>{currentName}</b></div>
    </div>
    <div className="sp-scroll pf2-scroll">
      <div className="sp-pane">
        <Card icon={Palette} title="Appearance" sub="Hover a palette to preview it, click to keep it."
          aside={<div className="sp-seg pf2-mode" role="group" aria-label="Appearance mode">{[['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'Auto', Monitor]].map(([value, label, Icon]) => <button key={value} type="button" aria-pressed={appearance.theme === value} onClick={() => appearance.onTheme(value)}><Icon size={14}/>{label}</button>)}</div>}>
          <div className="pf2-pal" role="group" aria-label={`${appearance.mode === 'light' ? 'Light' : 'Dark'} palettes`} onMouseLeave={() => appearance.onPreview(null)}>
            {themes.map((theme) => { const id = theme.id.replace(`${appearance.mode}-`, ''), on = id === current;
              return <button key={theme.id} type="button" className={`pf2-pc ${on ? 'is-on' : ''}`} aria-pressed={on} onMouseEnter={() => appearance.onPreview(id)} onFocus={() => appearance.onPreview(id)} onBlur={() => appearance.onPreview(null)} onClick={() => appearance.onPalette(appearance.mode, id)}>
                <span className="pf2-pcv" data-theme={theme.id} aria-hidden="true"><Check size={14} strokeWidth={3.2}/></span>
                <span className="pf2-pct"><b>{theme.name}</b><small>{theme.sub}</small></span>
              </button>; })}
          </div>
        </Card>
        <Card icon={Globe} title="Region & display" sub="Applies across the whole app.">
          <div className="sp-grid sp-c2 pf2-region">
            <div className="tj-field"><span className="tj-field-label">Time zone</span><ThemeSelect label="Time zone" value={region.timezone} onChange={(event) => region.onTimezone(event.target.value)}>{TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</ThemeSelect></div>
            <div className="tj-field"><span className="tj-field-label">Week starts on</span><div className="sp-seg" role="group" aria-label="Week starts on">{[['monday', 'Monday'], ['sunday', 'Sunday']].map(([value, label]) => <button key={value} type="button" aria-pressed={region.weekStart === value} onClick={() => region.onWeekStart(value)}>{label}</button>)}</div></div>
            <div className="tj-field"><span className="tj-field-label">Date format</span><ThemeSelect label="Date format" value={region.dateFormat} onChange={(event) => region.onDateFormat(event.target.value)}>{['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((format) => <option key={format} value={format}>{format}</option>)}</ThemeSelect></div>
            <div className="tj-field"><span className="tj-field-label">Time format</span><ThemeSelect label="Time format" value={region.timeFormat} onChange={(event) => region.onTimeFormat(event.target.value)}><option value="12">12-hour (AM/PM)</option><option value="24">24-hour</option></ThemeSelect></div>
          </div>
          <div className="pf2-prv"><small>Preview</small><b>{nowPreview(region)}</b><span>{region.timezone} · week starts {region.weekStart === 'sunday' ? 'Sunday' : 'Monday'}</span></div>
        </Card>
        <Card icon={PanelRight} title="Panels" sub="Where Log trade, Markups and Profile open." aside={<span className="pf2-chip">Previews live</span>}>
          <div className="pf2-sides" role="radiogroup" aria-label="Panel side">
            {[['left', 'Left side', 'After the sidebar'], ['right', 'Right side', 'At the right edge']].map(([value, label, note]) => <button key={value} type="button" role="radio" aria-checked={panels.position === value} className={`pf2-sd ${panels.position === value ? 'is-on' : ''}`} onClick={() => panels.onPosition(value)}>
              <span className={`pf2-sdv is-${value}`} aria-hidden="true"><i/><u/></span><span><b>{label}</b><small>{note}</small></span><em aria-hidden="true"><Check size={13} strokeWidth={3}/></em>
            </button>)}
          </div>
          <div className="pf2-row is-line"><div><b>Panel behavior</b><p>Push makes room beside the page; Overlay dims it. Narrow windows always overlay.</p></div>
            <div className="sp-seg pf2-w190" role="radiogroup" aria-label="Panel behavior">{[['push', 'Push'], ['overlay', 'Overlay']].map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={panels.behavior === value} aria-pressed={panels.behavior === value} onClick={() => panels.onBehavior(value)}>{label}</button>)}</div></div>
        </Card>
        <Card icon={Lock} title="Privacy & security" sub="Session, screen privacy and backup.">
          <div className="pf2-row"><div><b>Sign-in session</b><p>How long you stay signed in on this device.</p></div>
            <div className="sp-seg pf2-w230" role="group" aria-label="Sign-in session">{[[90, '1h 30m'], [0, 'Stay signed in']].map(([value, label]) => <button key={value} type="button" aria-pressed={privacy.session === value} onClick={() => privacy.onSession(value)}>{label}</button>)}</div></div>
          <div className="pf2-row is-line"><div><b>Privacy screen</b><p>Blur the journal after inactivity.</p></div>
            <div className="pf2-r2"><div className={`pf2-pto ${privacy.enabled ? '' : 'is-dim'}`}><ThemeSelect label="Privacy timeout" value={privacy.timeout} disabled={!privacy.enabled} onChange={(event) => privacy.onTimeout(Number(event.target.value))}><option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={60}>1 hour</option></ThemeSelect></div><Switch on={privacy.enabled} label="Privacy screen" onChange={privacy.onToggle}/></div></div>
          <div className="pf2-row is-line"><div><b>Cloud sync</b><p>{sync.note}</p></div>
            <div className="pf2-r2"><Switch on={sync.on} label="Cloud sync" onChange={sync.onToggle}/><button type="button" className="pf2-btn" disabled={!sync.on || sync.syncing} onClick={sync.onSync}>{sync.syncing ? 'Syncing…' : 'Sync now'}</button></div></div>
          <div className="pf2-row is-line"><div><b>Change password</b><p>Set a new password for this account.</p></div>
            <button type="button" className="pf2-btn" aria-expanded={password.open} onClick={password.open ? password.onClose : password.onOpen}><KeyRound size={15}/>{password.open ? 'Cancel' : 'Change password'}</button></div>
          {password.open && <div className="pf2-pw">
            <input type="password" className="tj-input" aria-label="New password" placeholder="New password" autoComplete="new-password" value={password.next} onChange={(event) => password.onNext(event.target.value)}/>
            <input type="password" className="tj-input" aria-label="Confirm password" placeholder="Confirm password" autoComplete="new-password" value={password.confirm} onChange={(event) => password.onConfirm(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && password.onSubmit()}/>
            <button type="button" className="pf2-btn is-pri" disabled={password.busy} onClick={password.onSubmit}>{password.busy ? 'Saving…' : 'Save password'}</button>
            {password.status && <span className={`pf2-pws ${password.status.type === 'error' ? 'is-err' : 'is-ok'}`} role="status">{password.status.text}</span>}
          </div>}
        </Card>
        <section className="sp-card pf2-danger"><div className="pf2-row"><div><b>Delete profile</b><p>Permanently deletes your profile and all your journal data.</p></div><button type="button" className="pf2-btn is-dng" onClick={onDelete}><Trash2 size={15}/>Delete profile</button></div></section>
      </div>
    </div>
    <footer className="sp-foot">
      <span className={`sp-foot-msg ${dirty ? 'is-dirty' : ''}`} role="status">{dirty ? 'Unsaved changes' : 'All settings saved'}</span>
      <button type="button" className="pf2-btn" onClick={onClose}>Cancel</button>
      <button type="button" className="pf2-btn is-pri" disabled={saveDisabled} onClick={onSave}>{saving ? 'Saving…' : 'Save profile'}</button>
    </footer>
  </div>;
}
