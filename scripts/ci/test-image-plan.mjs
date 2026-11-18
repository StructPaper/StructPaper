#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isTextFile,
  readFileNormalized,
  hashPaths,
  generatePlan,
} from './image-plan.mjs';

function runTests() {
  console.log('--- Testing image-plan.mjs ---');

  // Test 1: File type detection
  assert.equal(isTextFile('src/index.ts'), true);
  assert.equal(isTextFile('package.json'), true);
  assert.equal(isTextFile('.dockerignore'), true);
  assert.equal(isTextFile('.env.example'), true);
  assert.equal(isTextFile('fonts/font.ttf'), false);
  assert.equal(isTextFile('images/logo.png'), false);
  console.log('✓ File type detection passes');

  // Test 2: CRLF normalization for text files
  const tempDir = mkdtempSync(join(tmpdir(), 'image-plan-test-'));
  try {
    const textPathLF = join(tempDir, 'file-lf.ts');
    const textPathCRLF = join(tempDir, 'file-crlf.ts');
    writeFileSync(textPathLF, 'const a = 1;\nconst b = 2;\n');
    writeFileSync(textPathCRLF, 'const a = 1;\r\nconst b = 2;\r\n');

    const bufLF = readFileNormalized(textPathLF, 'file-lf.ts');
    const bufCRLF = readFileNormalized(textPathCRLF, 'file-crlf.ts');
    assert.deepEqual(bufLF, bufCRLF, 'CRLF and LF should normalize to identical Buffer');
    console.log('✓ CRLF normalization for text files passes');

    // Test 3: Binary integrity and 1-byte mutation detection
    const binaryFile1 = join(tempDir, 'sample1.ttf');
    const binaryFile2 = join(tempDir, 'sample2.ttf');

    // Create binary data containing invalid UTF-8 byte sequences (e.g., 0xFF, 0xFE, 0xC0)
    const rawBytes1 = Buffer.from([0x00, 0x01, 0x00, 0x00, 0xff, 0xfe, 0x80, 0x7f, 0x12, 0x34]);
    const rawBytes2 = Buffer.from([0x00, 0x01, 0x00, 0x00, 0xff, 0xfe, 0x81, 0x7f, 0x12, 0x34]); // 1 bit/byte changed

    writeFileSync(binaryFile1, rawBytes1);
    writeFileSync(binaryFile2, rawBytes2);

    const readBuf1 = readFileNormalized(binaryFile1, 'sample1.ttf');
    const readBuf2 = readFileNormalized(binaryFile2, 'sample2.ttf');
    assert.deepEqual(readBuf1, rawBytes1, 'Binary file must preserve exact byte buffer');
    assert.deepEqual(readBuf2, rawBytes2, 'Binary file must preserve exact byte buffer');

    const hash1 = hashPaths(['sample1.ttf'], tempDir);
    const hash2 = hashPaths(['sample2.ttf'], tempDir);
    assert.notEqual(hash1, hash2, 'Changing 1 byte in a binary file MUST produce a different hash');
    console.log('✓ Binary byte-exactness and 1-byte mutation check passes');

    // Test 4: Workspace generation sanity
    const plan = generatePlan();
    assert.match(plan, /^HASH_API=[0-9a-f]{16}$/m);
    assert.match(plan, /^HASH_WORKER=[0-9a-f]{16}$/m);
    assert.match(plan, /^HASH_WEB=[0-9a-f]{16}$/m);
    assert.match(plan, /^HASH_DB_INIT=[0-9a-f]{16}$/m);
    console.log('✓ Full plan generation passes:\n' + plan.trim());

    console.log('--- All image-plan tests passed successfully! ---');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

runTests();
