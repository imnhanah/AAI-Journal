import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const journal = read('./TradingJournal.jsx');
const marker = 'export const CSS = `';
const start = journal.indexOf(marker) + marker.length;
const css = journal.slice(start, journal.indexOf('`;', start));

test('text entrance animations never transform root, page, modal or disclosure containers', () => {
  for (const text of [css, read('./journal-preloader.css'), read('./challenge.css'), read('./public-site.css')]) {
    postcss.parse(text).walkAtRules(/keyframes$/, rule => {
      if (!/^(journal-dashboard-arrive|journal-quote-arrive|tj-modal-panel-|tj-page-enter|tj-view-enter|tj-content-settle|tj-reference-island-|tj-sidebar-content-in|tj-sidebar-section-in|tj-challenge-card-pop|public-enter)/.test(rule.params)) return;
      rule.walkDecls('transform', d => assert.equal(d.value, 'none', rule.params));
    });
  }
});

test('text containers have no permanent compositing hints or backdrop filters', () => {
  for (const text of [css, ...['dailyRoutine','profileSettingsRedesign','settingsDangerZone','singleAccountSwitchDialog','challenge','journal-controls'].map(n => read(`./${n}.css`))]) {
    postcss.parse(text).walkDecls(d => {
      if (d.prop === 'will-change') assert.equal(d.value, 'auto');
      if (d.prop.endsWith('backdrop-filter') && d.value !== 'none') {
        assert.match(d.parent.selector || '', /::before|::backdrop/, d.parent.selector);
        if (d.parent.selector.includes('::before') && !d.parent.selector.includes('scroll-returning')) {
          const props = Object.fromEntries(d.parent.nodes.filter(n => n.type === 'decl').map(n => [n.prop,n.value]));
          assert.equal(props['pointer-events'], 'none');
          assert.equal(props['z-index'], '-1');
        }
      }
    });
  }
});

test('fixed menus have no transformed sidebar ancestor and text centering is transform-free', () => {
  postcss.parse(css).walkDecls('transform', d => {
    if (/tj-sidebar|tj-modal\b|tj-account-menu|tj-toast|tj-image-viewer-controls|tj-scatter|tj-reference-.*detail-inner|tj-dock-cell|tj-markup-overview-metrics/.test(d.parent.selector || '')) {
      assert.equal(d.value, 'none', d.parent.selector);
    }
  });
  assert.match(css, /\.tj-toast \{[^}]*margin-inline:auto/);
  assert.match(css, /\.tj-scatter-dot-wrap \{[^}]*display:grid; place-items:center/);
  assert.match(read('./accountSettingsRedesign.css'), /tj-settings-unit-input > span[^}]*align-items:center/);
});
