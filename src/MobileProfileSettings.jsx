import React, {useRef, useState} from 'react';
import {useConfirmation} from './ConfirmationDialog.jsx';
import {CalendarDays, Camera, Check, ChevronRight, Clock, Cloud, EyeOff, Globe, Lock, LogOut, Monitor, Moon, Pencil, RefreshCw, Sun, Timer, Trash2} from 'lucide-react';
import ProfileThemePicker from './ProfileThemePicker';
import {Popup, TextField} from './MobileAccountSettings';
import BackButton from './BackButton.jsx';
import {useLeaveGuard} from './useLeaveGuard.js';
import './mobileProfileSettings.css';

const THEMES = [['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]];
const WEEK_DAYS = [['monday', 'Monday'], ['sunday', 'Sunday']];
const TIME_ZONES = ['Africa/Accra', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai'].map(zone => [zone, zone]);
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map(format => [format, format]);
const TIME_FORMATS = [['12', '12-hour'], ['24', '24-hour']];
const SESSIONS = [[90, '1h 30m'], [0, 'Stay signed in']];
const PRIVACY_TIMEOUTS = [[5, '5 minutes'], [15, '15 minutes'], [60, '1 hour']];

const Section = ({title, side, children}) => <>
  <div className="tj-mp-sec"><h2>{title}</h2>{side && <span>{side}</span>}</div>
  {children}
</>;

const Tile = ({glyph: Glyph}) => <span className="tj-ma-icon"><Glyph size={19}/></span>;

function Seg({label, options, value, onChange}) {
  return <div className="tj-mp-seg" role="group" aria-label={label}>{options.map(([optionValue, optionLabel, Glyph]) => <button type="button" key={optionValue} aria-pressed={optionValue === value} onClick={() => onChange(optionValue)}>{Glyph && <Glyph size={16} aria-hidden="true"/>}{optionLabel}</button>)}</div>;
}

// A row showing the current value. Tapping it lists the options; choosing one closes the list.
function ChoiceRow({glyph, label, note, options, value, onChange, disabled = false}) {
  const [open, setOpen] = useState(false);
  const current = options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
  return <>
    <button type="button" className="tj-ma-row" aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}><Tile glyph={glyph}/><span className="tj-ma-copy"><strong>{label}</strong>{note && <small>{note}</small>}</span><span className="tj-ma-value">{current}</span><ChevronRight className="tj-ma-chev" size={17} aria-hidden="true"/></button>
    {open && <Popup title={label} footer={null} onClose={() => setOpen(false)}>{options.map(([optionValue, optionLabel]) => <button type="button" key={optionValue} className="tj-mp-opt" aria-pressed={optionValue === value} onClick={() => { onChange(optionValue); setOpen(false); }}>{optionLabel}{optionValue === value && <Check size={18} aria-hidden="true"/>}</button>)}</Popup>}
  </>;
}

const SwitchRow = ({glyph, label, note, on, onChange}) => <div className="tj-ma-row is-static"><Tile glyph={glyph}/><span className="tj-ma-copy"><strong>{label}</strong>{note && <small>{note}</small>}</span>
  <button type="button" className="tj-ma-switch" role="switch" aria-label={label} aria-checked={on} onClick={onChange}><i aria-hidden="true"/></button></div>;

export default function MobileProfileSettings({summaryRef, onClose, onDiscard, onSave, saveDisabled, saving, dirty, identity, photo, appearance, region, privacy, sync, password, onDelete, onLogout}) {
  useLeaveGuard(!!dirty, 'profile');
  const confirm = useConfirmation();
  const logOut = async () => { if (await confirm({title:'Log out of AAICOREFX?', description:'You can sign back in at any time.', confirmLabel:'Log out', cancelLabel:'Stay'})) onLogout(); };
  const [editing, setEditing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const library = useRef(null), camera = useRef(null);
  const pickPhoto = input => { input.current?.click(); setPhotoOpen(false); };
  const upload = event => { photo.onUpload(event.target.files); event.target.value = ''; };

  return <div className="tj-ma tj-mp">
    <div className="tj-ma-scroll">
      <header className="tj-ma-head"><div className="tj-ma-title"><BackButton/><h1>Profile</h1><span aria-hidden="true"/></div></header>

      <section className="tj-mp-hero" ref={summaryRef}>
        <div className="tj-mp-avatar">
          <span><i>{photo.image ? <img src={photo.image} alt=""/> : photo.initials}</i></span>
          <button type="button" aria-label="Change photo" aria-haspopup="dialog" onClick={() => setPhotoOpen(true)}><b><Camera size={15}/></b></button>
        </div>
        <div className="tj-mp-name"><h2>{identity.name.trim() || 'Your name'}</h2>{identity.verified && <span><Check size={13} aria-hidden="true"/>Verified</span>}</div>
        <p className="tj-mp-mail">{identity.email || 'No email address'}</p>
        {photo.message && <p className="tj-mp-note" role="status">{photo.message}</p>}
        <div className="tj-mp-facts"><div><small>Member since</small><b>{identity.memberSince}</b></div><div><small>Last sign in</small><b>{identity.lastSignIn}</b></div></div>
        <button type="button" className="tj-mp-edit" aria-haspopup="dialog" onClick={() => setEditing(true)}><Pencil size={17} aria-hidden="true"/>Edit profile</button>
      </section>

      <Section title="Appearance" side="9 palettes">
        <div className="tj-mp-card">
          <Seg label="Theme" options={THEMES} value={appearance.theme} onChange={appearance.onTheme}/>
          <ProfileThemePicker mode={appearance.mode} palettes={appearance.palettes} showHeading={false} onPreview={appearance.onPreview} onChange={appearance.onPalette}/>
        </div>
      </Section>

      <Section title="Region & display" side="App-wide">
        <div className="tj-ma-group">
          <ChoiceRow glyph={Globe} label="Time zone" options={TIME_ZONES} value={region.timezone} onChange={region.onTimezone}/>
          <ChoiceRow glyph={CalendarDays} label="Date format" options={DATE_FORMATS} value={region.dateFormat} onChange={region.onDateFormat}/>
          <ChoiceRow glyph={Clock} label="Time format" options={TIME_FORMATS} value={region.timeFormat} onChange={region.onTimeFormat}/>
          <div className="tj-mp-week"><p>Week starts on</p><Seg label="Week starts on" options={WEEK_DAYS} value={region.weekStart} onChange={region.onWeekStart}/></div>
        </div>
      </Section>

      <Section title="Privacy & session">
        <div className="tj-ma-group">
          <ChoiceRow glyph={Clock} label="Sign-in session" note="Auto sign-out" options={SESSIONS} value={privacy.session} onChange={privacy.onSession}/>
          <SwitchRow glyph={EyeOff} label="Privacy Screen" note="Blur the journal after inactivity" on={privacy.enabled} onChange={privacy.onToggle}/>
          <ChoiceRow glyph={Timer} label="Privacy timeout" options={PRIVACY_TIMEOUTS} value={privacy.timeout} onChange={privacy.onTimeout} disabled={!privacy.enabled}/>
        </div>
      </Section>

      <Section title="Security & sync" side="Cloud & device">
        <div className="tj-ma-group">
          <SwitchRow glyph={Cloud} label="Cloud sync" note={sync.note} on={sync.on} onChange={sync.onToggle}/>
          {sync.on && <div className="tj-mp-sync"><small>Back up now across your devices</small><button type="button" disabled={sync.syncing} onClick={sync.onSync}><b><RefreshCw size={15} aria-hidden="true"/>{sync.syncing ? 'Syncing…' : 'Sync now'}</b></button></div>}
          <button type="button" className="tj-ma-row" aria-haspopup="dialog" onClick={password.onOpen}><Tile glyph={Lock}/><span className="tj-ma-copy"><strong>Change password</strong><small>Account security</small></span><ChevronRight className="tj-ma-chev" size={17} aria-hidden="true"/></button>
        </div>
      </Section>

      <div className="tj-mp-exit">
        <button type="button" className="tj-mp-delete" onClick={logOut}><LogOut size={19} aria-hidden="true"/>Log out</button>
        <button type="button" className="tj-mp-delete" onClick={onDelete}><Trash2 size={19} aria-hidden="true"/>Delete profile</button>
      </div>
    </div>

    <input ref={library} className="tj-mp-file" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={upload}/>
    <input ref={camera} className="tj-mp-file" type="file" accept="image/*" capture="user" tabIndex={-1} aria-hidden="true" onChange={upload}/>

    {dirty && <div className="tj-ma-savebar"><button type="button" onClick={onDiscard}>Discard</button><button type="button" className="is-save" disabled={saveDisabled} onClick={onSave}>{saving ? 'Saving…' : 'Save profile'}</button></div>}

    {editing && <Popup title="Edit profile" onClose={() => setEditing(false)}>
      <TextField label="Display name" value={identity.name} onChange={event => identity.onName(event.target.value)} autoComplete="name"/>
      <TextField label="Email" value={identity.email} disabled readOnly/>
    </Popup>}

    {photoOpen && <Popup title="Profile photo" footer={null} onClose={() => setPhotoOpen(false)}>
      <button type="button" className="tj-mp-opt" onClick={() => pickPhoto(camera)}>Take a photo</button>
      <button type="button" className="tj-mp-opt" onClick={() => pickPhoto(library)}>Choose from library</button>
      {photo.image && <button type="button" className="tj-mp-opt is-danger" onClick={() => { photo.onRemove(); setPhotoOpen(false); }}>Remove photo</button>}
    </Popup>}

    {password.open && <Popup title="Change password" onClose={password.onClose} footer={<button type="button" disabled={password.busy} onClick={password.onSubmit}>{password.busy ? 'Saving…' : 'Update password'}</button>}>
      <TextField label="New password" type="password" value={password.next} placeholder="At least 6 characters" autoComplete="new-password" onChange={event => password.onNext(event.target.value)}/>
      <TextField label="Confirm new password" type="password" value={password.confirm} autoComplete="new-password" onChange={event => password.onConfirm(event.target.value)}/>
      {password.status && <p className={`tj-mp-status ${password.status.type === 'error' ? 'is-error' : ''}`} role="status">{password.status.text}</p>}
    </Popup>}
  </div>;
}
