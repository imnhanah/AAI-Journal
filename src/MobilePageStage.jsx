import React, {useLayoutEffect, useRef} from 'react';
import {MOBILE_MEDIA} from './mobileNavigation.js';
import {getBackNavigation} from './useBackNavigation.js';
import {phoneScrollTarget, usesDocumentPhoneScroll} from './phoneScroll.js';

// Phone page motion. The page that was on screen is kept as a still picture (a copy of its
// DOM) while the new one moves in, so only one live page ever exists. The direction comes
// from the back-navigation layer: 'push' slides the new page in from the right over the
// picture, 'pop' slides the picture away to the right over the page underneath, 'tab'
// crossfades. A move the layer did not report, or one with Reduce Motion on, is instant.
// Desktop renders the children unchanged: no extra elements, no picture.
//
// Steps inside a page (a trade or markup detail, a review, an open test, a Setup list) use
// the same push and pop through useStepMotion below.

const KINDS = ['push', 'pop', 'tab'];
const LAYER_CLASS = kind => `tj-page-live-${kind}`;
const END_SLACK = 150;

export function pageMoveDuration(kind) {
  if (typeof window === 'undefined') return 0;
  const name = kind === 'tab' ? '--dur-fade' : '--dur-page';
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return Number.parseFloat(value) || 0;
}

// The copy must not act like the page: no ids or radio names to clash with the live page,
// nothing focusable, and canvases (which do not copy) are redrawn as images.
export function stillPicture(layer) {
  const copy = layer.cloneNode(true);
  copy.classList.remove(...KINDS.map(LAYER_CLASS), 'tj-motion-active');
  copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  copy.querySelectorAll('input[name],select[name],textarea[name]').forEach(node => node.removeAttribute('name'));
  copy.querySelectorAll('[autofocus]').forEach(node => node.removeAttribute('autofocus'));
  copy.querySelectorAll('video,audio').forEach(node => node.removeAttribute('autoplay'));
  const from = layer.querySelectorAll('canvas'), to = copy.querySelectorAll('canvas');
  to.forEach((canvas, index) => { try { canvas.getContext('2d')?.drawImage(from[index], 0, 0); } catch {} });
  return copy;
}

// The colour actually painted behind the page: the nearest ancestor with a background.
function pageBackground(node) {
  for (let current = node; current; current = current.parentElement) {
    const colour = getComputedStyle(current).backgroundColor;
    if (colour && colour !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(colour)) return colour;
  }
  return 'var(--bg)';
}

// The stage on screen, so steps inside a page can use it.
let activeStage = null;

// A step inside a page: depth goes up when a detail opens (push) and down when it closes
// (pop). The picture is taken while the page renders the change, before React updates the
// screen, and the move plays once it has. Pages add one line: useStepMotion(open ? 1 : 0).
export function useStepMotion(depth) {
  const last = useRef(depth), shot = useRef(null);
  if (depth !== last.current) {
    shot.current = activeStage?.capture(depth > last.current ? 'push' : 'pop') || null;
    last.current = depth;
  }
  useLayoutEffect(() => {
    const taken = shot.current;
    shot.current = null;
    if (taken) activeStage?.play(taken);
  }, [depth]);
}

export default class MobilePageStage extends React.Component {
  constructor(props) {
    super(props);
    this.ghost = React.createRef();
    this.dim = React.createRef();
    this.scrolls = new Map();
    this.state = {phone:typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA).matches};
  }

  componentDidMount() {
    this.media = window.matchMedia(MOBILE_MEDIA);
    this.onMedia = () => { this.finish(); this.setState({phone:this.media.matches}); };
    this.media.addEventListener('change', this.onMedia);
    activeStage = this;
  }

  componentWillUnmount() {
    if (activeStage === this) activeStage = null;
    this.media?.removeEventListener('change', this.onMedia);
    this.finish();
  }

  live() { return this.ghost.current?.parentElement?.querySelector(':scope > .tj-page-transition') || null; }
  scroller() { return phoneScrollTarget(this.ghost.current); }

  getSnapshotBeforeUpdate(previous) {
    if (previous.page === this.props.page) return null;
    const kind = getBackNavigation().takeMove();
    const layer = this.live(), scroller = this.scroller();
    if (scroller) this.scrolls.set(previous.page, scroller.scrollTop);
    if (previous.account !== this.props.account) return null;
    return this.capture(kind);
  }

  // The picture of what is on screen now, before it changes. Null when nothing should move.
  capture(kind) {
    const layer = this.live(), scroller = this.scroller();
    // Do not clip a document-scroll gesture for page motion in browser Safari.
    // The existing installed-app transition remains unchanged.
    if (usesDocumentPhoneScroll() || !this.state.phone || !KINDS.includes(kind) || !layer || !scroller) return null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const box = scroller.getBoundingClientRect(), place = layer.getBoundingClientRect();
    return {kind, picture:stillPicture(layer), box, left:place.left - box.left, top:place.top - box.top, width:place.width};
  }

  componentDidUpdate(previous, previousState, shot) {
    if (previous.page === this.props.page) return;
    const scroller = this.scroller();
    // Going back returns to where that page was scrolled.
    if (shot?.kind === 'pop' && scroller) {
      const saved = this.scrolls.get(this.props.page) || 0;
      scroller.scrollTop = saved;
      requestAnimationFrame(() => { if (scroller.scrollTop !== saved) scroller.scrollTop = saved; });
    }
    if (!shot) { this.finish(); return; }
    this.play(shot);
  }

  play({kind, picture, box, left, top, width}) {
    this.finish();
    const ghost = this.ghost.current, dim = this.dim.current, layer = this.live();
    if (!ghost || !dim || !layer) return;
    for (const node of [ghost, dim]) Object.assign(node.style, {top:`${box.top}px`, left:`${box.left}px`, width:`${box.width}px`, height:`${box.height}px`});
    Object.assign(picture.style, {position:'absolute', top:`${top}px`, left:`${left}px`, width:`${width}px`, margin:'0'});
    // The frame stays still and clips; only the sheet inside it moves, so nothing ever
    // reaches past the screen edge (which would scroll the app sideways).
    const sheet = document.createElement('div');
    sheet.className = 'tj-page-ghost-sheet';
    sheet.append(picture);
    ghost.replaceChildren(sheet);
    // The moving page reaches to the edges of the scrolling area, up under the header (which
    // has no background of its own), and fills the screen height, with the page background,
    // so the picture never shows round its edges.
    const stage = layer.parentElement, scroller = this.scroller(), place = layer.getBoundingClientRect();
    stage.style.setProperty('--stage-pad-left', `${Math.max(0, place.left - box.left)}px`);
    stage.style.setProperty('--stage-pad-right', `${Math.max(0, box.right - place.right)}px`);
    stage.style.setProperty('--stage-pad-top', `${Math.max(0, place.top - box.top + (scroller?.scrollTop || 0))}px`);
    stage.style.setProperty('--stage-height', `${box.height}px`);
    stage.style.setProperty('--stage-bg', pageBackground(stage));
    ghost.dataset.move = dim.dataset.move = kind;
    layer.classList.add(LAYER_CLASS(kind), 'tj-motion-active');
    ghost.classList.add('tj-motion-active');
    stage.classList.add('tj-page-stage-moving');
    scroller?.classList.add('tj-page-stage-clip');
    // The header stays where it is; its title and Back fade in.
    const heading = document.querySelector('.tj-topbar-left');
    if (heading) { heading.classList.remove('tj-motion-title'); void heading.offsetWidth; heading.classList.add('tj-motion-title'); }
    const done = event => { if (!event || event.target === layer) this.finish(); };
    this.running = {layer, ghost, dim, done, heading, scroller, timer:setTimeout(() => this.finish(), pageMoveDuration(kind) + END_SLACK)};
    layer.addEventListener('animationend', done);
  }

  // Removes the picture once the move ends, with a timer in case animationend never comes.
  finish() {
    const running = this.running;
    if (!running) return;
    this.running = null;
    clearTimeout(running.timer);
    running.layer.removeEventListener('animationend', running.done);
    running.layer.classList.remove(...KINDS.map(LAYER_CLASS), 'tj-motion-active');
    const stage = running.layer.parentElement;
    stage?.classList.remove('tj-page-stage-moving');
    running.scroller?.classList.remove('tj-page-stage-clip');
    for (const name of ['--stage-pad-left', '--stage-pad-right', '--stage-pad-top', '--stage-height', '--stage-bg']) stage?.style.removeProperty(name);
    running.ghost.classList.remove('tj-motion-active');
    running.ghost.replaceChildren();
    delete running.ghost.dataset.move;
    delete running.dim.dataset.move;
    running.heading?.classList.remove('tj-motion-title');
  }

  render() {
    if (!this.state.phone) return this.props.children;
    return <>
      {this.props.children}
      <div ref={this.dim} className="tj-page-dim" aria-hidden="true"/>
      <div ref={this.ghost} className="tj-page-ghost" aria-hidden="true" inert=""/>
    </>;
  }
}
