import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTrace,
  buildSignature,
  renderTextSummary,
  renderMarkdownSummary,
  formatFrame
} from '../src/analyze.js';

test('analyzeTrace composes parse and diagnose, adds support frames, and builds a deterministic signature', () => {
  const report = analyzeTrace(`TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at internalBridge (node:internal/errors:405:5)\n    at updateView (/app/src/view.js:42:5)\n    at commitChanges (/app/src/commit.js:11:2)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`);

  assert.equal(report.runtime, 'javascript');
  assert.equal(report.errorName, 'TypeError');
  assert.match(report.message, /Cannot read properties of undefined/);
  assert.equal(report.culpritFrame.functionName, 'renderProfile');
  assert.deepEqual(
    report.supportFrames.map((frame) => frame.functionName),
    ['updateView', 'commitChanges']
  );
  assert.equal(
    report.signature,
    'javascript|TypeError|app/src/profile.js:88|nullish-data,undefined-property-access'
  );
  assert.equal(report.signature, buildSignature(report));
  assert.equal(report.diagnosis.confidence, 'high');
  assert.deepEqual(report.diagnosis.tags, ['nullish-data', 'undefined-property-access']);
  assert.deepEqual(
    report.hotspots.map(({ label, score, culpritCount, supportCount }) => ({
      label,
      score,
      culpritCount,
      supportCount,
    })),
    [
      {
        label: 'profile.js',
        score: 3,
        culpritCount: 1,
        supportCount: 0,
      },
      {
        label: 'commit.js',
        score: 1,
        culpritCount: 0,
        supportCount: 1,
      },
      {
        label: 'view.js',
        score: 1,
        culpritCount: 0,
        supportCount: 1,
      },
    ]
  );
});

test('buildSignature keeps enough file context to avoid same-basename collisions', () => {
  const first = buildSignature({
    runtime: 'javascript',
    errorName: 'TypeError',
    culpritFrame: {
      file: '/repo/apps/admin/src/index.js',
      line: 14,
      column: 2,
      functionName: 'boot'
    },
    diagnosis: {
      tags: ['generic-runtime-error']
    }
  });

  const second = buildSignature({
    runtime: 'javascript',
    errorName: 'TypeError',
    culpritFrame: {
      file: '/repo/apps/store/src/index.js',
      line: 14,
      column: 2,
      functionName: 'boot'
    },
    diagnosis: {
      tags: ['generic-runtime-error']
    }
  });

  assert.equal(first, 'javascript|TypeError|repo/apps/admin/src/index.js:14|generic-runtime-error');
  assert.equal(second, 'javascript|TypeError|repo/apps/store/src/index.js:14|generic-runtime-error');
  assert.notEqual(first, second);
});

test('render helpers produce copy-ready text and markdown summaries from a real python trace', () => {
  const report = analyzeTrace(`Traceback (most recent call last):\n  File \"app.py\", line 42, in <module>\n    run()\n  File \"service.py\", line 17, in run\n    return user[\"email\"]\nKeyError: 'email'`);

  const text = renderTextSummary(report);
  const markdown = renderMarkdownSummary(report);

  assert.match(text, /Runtime: python/);
  assert.match(text, /Signature: python\|KeyError\|service\.py:17\|missing-key/);
  assert.match(text, /Support frames: <module> \(app\.py:42\)/);
  assert.match(text, /Suspect hotspots: service\.py \(score 3\), app\.py \(score 1\)/);
  assert.match(text, /Checklist:/);

  assert.match(markdown, /^# Stack Sleuth Report/m);
  assert.match(markdown, /- \*\*Signature:\*\* `python\|KeyError\|service\.py:17\|missing-key`/);
  assert.match(markdown, /- `&lt;module&gt; \(app\.py:42\)`/);
  assert.match(markdown, /## Suspect hotspots\n- `service\.py` \(score 3, culprit 1x, support 0x\)\n- `app\.py` \(score 1, culprit 0x, support 1x\)/);
  assert.match(markdown, /## Checklist/);
});

test('render helpers safely fall back when diagnosis or support frames are missing', () => {
  const partialReport = {
    runtime: 'javascript',
    errorName: 'TypeError',
    message: 'boom',
    culpritFrame: {
      file: '/app/src/index.js',
      line: 4,
      column: 9,
      functionName: 'boot'
    },
    signature: 'javascript|TypeError|app/src/index.js:4|untagged'
  };

  const text = renderTextSummary(partialReport);
  const markdown = renderMarkdownSummary(partialReport);

  assert.match(text, /Support frames: None/);
  assert.match(text, /Confidence: unknown/);
  assert.match(text, /Tags: untagged/);
  assert.match(text, /Summary: No diagnosis available yet\./);
  assert.match(text, /Suspect hotspots: index\.js \(score 3\)/);
  assert.match(text, /- No checklist available yet\./);

  assert.match(markdown, /- \*\*Confidence:\*\* unknown/);
  assert.match(markdown, /- \*\*Tags:\*\* untagged/);
  assert.match(markdown, /## Support frames\n- `None`/);
  assert.match(markdown, /## Suspect hotspots\n- `index\.js` \(score 3, culprit 1x, support 0x\)/);
  assert.match(markdown, /## Summary\nNo diagnosis available yet\./);
  assert.match(markdown, /## Checklist\n- No checklist available yet\./);
});

test('renderMarkdownSummary escapes markdown-breaking and html-like content from traces', () => {
  const markdown = renderMarkdownSummary({
    runtime: 'javascript',
    errorName: 'TypeError',
    message: 'oops `inline` <img src=x onerror=alert(1)>',
    culpritFrame: {
      file: '/app/src/`boom`.js',
      line: 9,
      column: 1,
      functionName: 'explode<script>'
    },
    supportFrames: [
      {
        file: '/tmp/<bad>.js',
        line: 2,
        column: null,
        functionName: 'next`step'
      }
    ],
    signature: 'sig`x`<b>',
    diagnosis: {
      confidence: 'high',
      tags: ['tag`x`', '<warn>'],
      summary: 'sum <b>html</b> `ticks`',
      checklist: ['item <script>x</script> `tick`']
    }
  });

  assert.match(markdown, /- \*\*Error:\*\* TypeError: oops &#96;inline&#96; &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(markdown, /- \*\*Signature:\*\* `sig&#96;x&#96;&lt;b&gt;`/);
  assert.match(markdown, /- \*\*Culprit:\*\* `explode&lt;script&gt; \(\/app\/src\/&#96;boom&#96;\.js:9\)`/);
  assert.match(markdown, /- \*\*Tags:\*\* tag&#96;x&#96;, &lt;warn&gt;/);
  assert.match(markdown, /- `next&#96;step \(\/tmp\/&lt;bad&gt;\.js:2\)`/);
  assert.match(markdown, /## Summary\nsum &lt;b&gt;html&lt;\/b&gt; &#96;ticks&#96;/);
  assert.match(markdown, /## Checklist\n- item &lt;script&gt;x&lt;\/script&gt; &#96;tick&#96;/);
  assert.doesNotMatch(markdown, /<img|<script>|<b>/);
});

test('formatFrame returns a readable fallback and preserves function locations', () => {
  assert.equal(formatFrame(null), 'No application frame detected');
  assert.equal(
    formatFrame({
      file: '/app/src/profile.js',
      line: 88,
      column: 17,
      functionName: 'renderProfile'
    }),
    'renderProfile (/app/src/profile.js:88)'
  );
});

test('whitespace-only input returns a normalized empty analysis state', () => {
  const report = analyzeTrace('   \n\t  ');

  assert.equal(report.empty, true);
  assert.equal(report.signature, 'empty-trace');
  assert.equal(report.culpritFrame, null);
  assert.deepEqual(report.supportFrames, []);
  assert.deepEqual(report.hotspots, []);
  assert.equal(report.diagnosis, null);
  assert.match(renderTextSummary(report), /No trace provided/i);
  assert.match(renderMarkdownSummary(report), /No trace provided/i);
});
