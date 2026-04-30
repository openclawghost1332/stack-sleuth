import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const casebookHistoryInput = [
  '=== release-2026-04-15 ===',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '=== profile-rewrite ===',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
].join('\n');

const casebookCurrentInput = [
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  `ProfileHydrationError: Profile payload missing account metadata\n    at renderProfileState (/app/src/profile.js:102:9)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
].join('\n\n');

const incidentPackInput = [
  '@@ current @@',
  casebookCurrentInput,
  '',
  '@@ history @@',
  casebookHistoryInput,
  '',
  '@@ baseline @@',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '@@ candidate @@',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '@@ timeline @@',
  [
    '=== canary ===',
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    '',
    '=== partial ===',
    [
      `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
      `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
    ].join('\n\n'),
    '',
    '=== full-rollout ===',
    [
      `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
      `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
    ].join('\n\n')
  ].join('\n'),
].join('\n');

const incidentPackRegressionPriorityInput = [
  '@@ current @@',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '@@ history @@',
  [
    '=== known-profile ===',
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n'),
  '',
  '@@ baseline @@',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '@@ candidate @@',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
].join('\n');

const requiredIds = [
  'trace-input',
  'explain-button',
  'load-js-button',
  'load-python-button',
  'load-raw-log-button',
  'load-digest-button',
  'load-pack-button',
  'copy-button',
  'example-caption',
  'compare-baseline-input',
  'compare-candidate-input',
  'compare-button',
  'load-regression-button',
  'compare-caption',
  'casebook-current-input',
  'casebook-history-input',
  'casebook-button',
  'load-casebook-button',
  'copy-casebook-button',
  'casebook-caption',
  'timeline-input',
  'timeline-button',
  'load-timeline-button',
  'copy-timeline-button',
  'timeline-caption',
  'excavation-value',
  'runtime-value',
  'headline-value',
  'culprit-value',
  'confidence-value',
  'tags-value',
  'signature-value',
  'support-frames-value',
  'hotspots-value',
  'summary-value',
  'blast-radius-value',
  'digest-groups-value',
  'checklist-value',
  'regression-summary-value',
  'regression-incidents-value',
  'hotspot-shifts-value',
  'casebook-summary-value',
  'known-count-value',
  'novel-count-value',
  'closest-matches-value',
  'timeline-summary-value',
  'timeline-incidents-value',
  'timeline-hotspots-value',
];

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.value = '';
    this.children = [];
    this.listeners = new Map();
    this._textContent = '';
  }

  get textContent() {
    return this.children.length ? this.children.map((child) => child.textContent).join('') : this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  replaceChildren(...children) {
    this.children = children;
    this._textContent = '';
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  async dispatch(type) {
    const handlers = this.listeners.get(type) ?? [];
    for (const handler of handlers) {
      await handler({ target: this, currentTarget: this, type });
    }
  }
}

class FakeDocument {
  constructor(ids) {
    this.elements = new Map(ids.map((id) => [id, new FakeElement('div', id)]));
  }

  querySelector(selector) {
    if (!selector.startsWith('#')) {
      return null;
    }

    return this.elements.get(selector.slice(1)) ?? null;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

async function loadBrowserHarness() {
  const document = new FakeDocument(requiredIds);
  const clipboard = { text: '' };
  const navigator = {
    clipboard: {
      writeText: async (value) => {
        clipboard.text = String(value);
      }
    }
  };

  const priorDocument = globalThis.document;
  const priorNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'document', {
    value: document,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: navigator,
    configurable: true,
    writable: true,
  });

  await import(new URL(`../src/main.js?browser-test=${Date.now()}-${Math.random()}`, import.meta.url));

  return {
    document,
    clipboard,
    get: (id) => document.elements.get(id),
    async click(id) {
      await document.elements.get(id).dispatch('click');
    },
    async input(id, value) {
      const element = document.elements.get(id);
      element.value = value;
      await element.dispatch('input');
    },
    restore() {
      if (priorDocument === undefined) {
        delete globalThis.document;
      } else {
        Object.defineProperty(globalThis, 'document', {
          value: priorDocument,
          configurable: true,
          writable: true,
        });
      }

      if (priorNavigator === undefined) {
        delete globalThis.navigator;
      } else {
        Object.defineProperty(globalThis, 'navigator', {
          value: priorNavigator,
          configurable: true,
          writable: true,
        });
      }
    }
  };
}

test('browser copy invites pasting one or more traces for digesting, comparing, casebook lookup, and timeline analysis', () => {
  assert.match(indexHtml, /Paste one or more stack traces or raw logs/i);
  assert.match(indexHtml, /incident pack/i);
  assert.match(indexHtml, /Stack trace, raw log, or incident bundle/i);
  assert.match(indexHtml, /Paste one or more JavaScript, Python, or Ruby traces or raw logs here/i);
  assert.match(indexHtml, />Explain trace\(s\)<\/button>/i);
  assert.match(indexHtml, />Load incident pack example</i);
  assert.match(indexHtml, />Load raw log example</i);
  assert.match(indexHtml, /Regression Radar/i);
  assert.match(indexHtml, /Casebook Radar/i);
  assert.match(indexHtml, /Current incident batch/i);
  assert.match(indexHtml, /Labeled history casebook/i);
  assert.match(indexHtml, /known versus novel/i);
  assert.match(indexHtml, /Timeline Radar/i);
  assert.match(indexHtml, /Incident Pack Briefing/i);
  assert.match(indexHtml, />Analyze casebook</i);
  assert.match(indexHtml, />Copy casebook summary</i);
});

test('browser incident pack flow composes the briefing across current, casebook, regression, and timeline analyses', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', incidentPackInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'incident pack briefing');
    assert.equal(harness.get('headline-value').textContent, 'Casebook Radar flagged 1 novel incident in the current batch.');
    assert.match(harness.get('summary-value').textContent, /Casebook Radar matched 1 known incident and flagged 1 novel incident/i);
    assert.match(harness.get('casebook-summary-value').textContent, /matched 1 known incident and flagged 1 novel incident/i);
    assert.match(harness.get('regression-summary-value').textContent, /1 new, 1 volume-up/i);
    assert.match(harness.get('timeline-summary-value').textContent, /1 new/i);
    assert.match(harness.get('checklist-value').children[0].textContent, /Inspect novel incidents first/i);
  } finally {
    harness.restore();
  }
});

test('browser incident pack copy support writes the rendered briefing to the clipboard', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', incidentPackInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Incident Pack Briefing/);
    assert.match(harness.clipboard.text, /Available analyses: current, casebook, regression, timeline/);
    assert.equal(harness.get('example-caption').textContent, 'Incident Pack Briefing copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser incident pack shared cards follow the same regression-first priority as the briefing headline', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', incidentPackRegressionPriorityInput);
    await harness.click('explain-button');

    assert.equal(harness.get('headline-value').textContent, 'Regression Radar found 1 new incident and 0 volume-up incidents in the candidate batch.');
    assert.match(harness.get('culprit-value').textContent, /renderInvoice/);
    assert.match(harness.get('signature-value').textContent, /invoice\.js:19/);
    assert.match(harness.get('summary-value').textContent, /Regression Radar found 1 new incident, 0 volume-up incidents, and 0 resolved incidents/i);
    assert.match(harness.get('blast-radius-value').textContent, /Source: direct\./i);
  } finally {
    harness.restore();
  }
});

test('browser incident pack guidance explains supported @@ section @@ headers when the pack markers are malformed', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', '@@ notes @@\nfoo');
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'incident pack guidance');
    assert.match(harness.get('headline-value').textContent, /did not find any supported incident-pack sections/i);
    assert.match(harness.get('summary-value').textContent, /Use @@ current @@, @@ history @@, @@ baseline @@, @@ candidate @@, or @@ timeline @@/i);
    assert.match(harness.get('checklist-value').children[0].textContent, /Rename the section headers to supported incident-pack names/i);
  } finally {
    harness.restore();
  }
});

test('browser Casebook Radar analyze flow renders known and novel counts plus the closest historical match', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('casebook-current-input', casebookCurrentInput);
    await harness.input('casebook-history-input', casebookHistoryInput);
    await harness.click('casebook-button');

    assert.equal(harness.get('runtime-value').textContent, 'casebook radar');
    assert.equal(harness.get('known-count-value').textContent, '1');
    assert.equal(harness.get('novel-count-value').textContent, '1');
    assert.match(harness.get('headline-value').textContent, /1 known matches, 1 novel incidents/i);
    assert.match(harness.get('summary-value').textContent, /Closest prior incident: release-2026-04-15\./i);
    assert.match(harness.get('casebook-summary-value').textContent, /matched 1 known incident and flagged 1 novel incident/i);
    const closestMatches = harness.get('closest-matches-value').children.map((child) => child.textContent);
    assert.equal(closestMatches.length, 2);
    assert.match(closestMatches[0], /^release-2026-04-15: 1 exact matches, 1 shared culprit paths, 2 shared diagnosis tags$/);
    assert.match(closestMatches[1], /^profile-rewrite: 1 exact matches, 1 shared culprit paths, 2 shared diagnosis tags$/);
    assert.equal(harness.get('casebook-caption').textContent, 'Closest prior incident match: release-2026-04-15.');
  } finally {
    harness.restore();
  }
});

test('browser Casebook Radar copy support writes the rendered summary to the clipboard', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('casebook-current-input', casebookCurrentInput);
    await harness.input('casebook-history-input', casebookHistoryInput);
    await harness.click('copy-casebook-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Casebook Radar/);
    assert.match(harness.clipboard.text, /Known incidents: 1/);
    assert.match(harness.clipboard.text, /Novel incidents: 1/);
    assert.match(harness.clipboard.text, /Known in: release-2026-04-15/);
    assert.equal(harness.get('casebook-caption').textContent, 'Casebook Radar summary copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser Casebook Radar clears shared result cards when one casebook input becomes incomplete', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('casebook-current-input', casebookCurrentInput);
    await harness.input('casebook-history-input', casebookHistoryInput);
    await harness.click('casebook-button');
    assert.match(harness.get('headline-value').textContent, /1 known matches, 1 novel incidents/i);

    await harness.input('casebook-current-input', '');

    assert.equal(harness.get('casebook-summary-value').textContent, 'Paste a current incident batch plus labeled prior incidents to see known versus novel matches.');
    assert.equal(harness.get('known-count-value').textContent, '-');
    assert.equal(harness.get('novel-count-value').textContent, '-');
    assert.equal(harness.get('headline-value').textContent, 'Paste one or more traces or raw logs to get started');
    assert.equal(harness.get('culprit-value').textContent, 'No frame selected yet');
    assert.equal(harness.get('signature-value').textContent, '-');
    assert.deepEqual(
      harness.get('checklist-value').children.map((child) => child.textContent),
      ['Run an example or paste one or more real traces to see actionable next steps.']
    );
    assert.deepEqual(
      harness.get('closest-matches-value').children.map((child) => child.textContent),
      ['Closest prior incidents will appear here after a Casebook Radar lookup.']
    );
  } finally {
    harness.restore();
  }
});
