#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { analyzeTrace, renderTextSummary, renderMarkdownSummary } from '../src/analyze.js';
import {
  analyzeTraceDigest,
  renderDigestTextSummary,
  renderDigestMarkdownSummary,
  splitTraceChunks
} from '../src/digest.js';

const args = process.argv.slice(2);
const mode = args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'text';
const wantsDigest = args.includes('--digest');
const filePath = args.find((arg) => !arg.startsWith('--')) ?? null;

try {
  const input = filePath ? fs.readFileSync(filePath, 'utf8') : fs.readFileSync(0, 'utf8');
  const useDigest = wantsDigest || splitTraceChunks(input).length > 1;

  if (useDigest) {
    const digest = analyzeTraceDigest(input);

    if (digest.totalTraces === 0) {
      fail('No trace provided. Pipe a stack trace or pass a file path.');
    }

    if (mode === 'json') {
      process.stdout.write(`${JSON.stringify(digest, null, 2)}\n`);
    } else if (mode === 'markdown') {
      process.stdout.write(`${renderDigestMarkdownSummary(digest)}\n`);
    } else {
      process.stdout.write(`${renderDigestTextSummary(digest)}\n`);
    }
  } else {
    const report = analyzeTrace(input);

    if (report.empty) {
      fail('No trace provided. Pipe a stack trace or pass a file path.');
    }

    if (mode === 'json') {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else if (mode === 'markdown') {
      process.stdout.write(`${renderMarkdownSummary(report)}\n`);
    } else {
      process.stdout.write(`${renderTextSummary(report)}\n`);
    }
   }
 } catch (error) {
   if (filePath) {
     fail(`Could not read trace file: ${error.message}`);
   }
 
   fail(`Could not read trace from stdin: ${error.message}`);
 }
 
 function fail(message) {
   process.stderr.write(`${message}\n`);
   process.exit(1);
 }
