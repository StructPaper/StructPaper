import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * End-to-end: import a real Word file -> validation gate -> edit -> autosave to the backend
 * (DB + object storage) -> export Word / XML / PDF -> reopen from the "Open" list.
 *
 * Needs the API on :8080 (see docs/DOCUMENT_WORKFLOW.md); skipped when it is not reachable.
 */
const API = process.env.API_BASE_URL || 'http://localhost:8080';
const FIXTURE = path.resolve(__dirname, '../fixtures/golden/papers/eic_stdjelm,+Journal+editor,+3.+1750.docx');
const OUT = path.resolve(__dirname, '../test-results/e2e-downloads');

async function apiUp(): Promise<boolean> {
  try {
    return (await fetch(`${API}/actuator/health`)).ok;
  } catch {
    return false;
  }
}

async function openMenu(page: Page, item: RegExp) {
  await page.getByRole('button', { name: /^Tệp/ }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

test.describe('Word-like document workflow (real backend)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(420_000);

  test('import -> gate -> autosave -> export -> reopen', async ({ page }) => {
    test.skip(!(await apiUp()), `API not reachable at ${API}`);
    fs.mkdirSync(OUT, { recursive: true });

    await page.goto('/papers/sample-preview-paper');
    await expect(page.getByTestId('document-menu-bar')).toBeVisible();

    // ---- New: name + import the original Word file ----
    await openMenu(page, /Mới/);
    const docName = `E2E bài ID1750 ${Date.now()}`;
    await page.getByTestId('new-document-name').fill(docName);
    await page.locator('[data-testid="create-paper-dropzone"] input[type="file"]').setInputFiles(FIXTURE);
    await page.locator('[data-testid^="compact-template-"]').filter({ hasText: /Kinh tế|Economics|EBL/i }).first().click();
    await page.getByTestId('continue-to-editor-btn').click();

    // ---- GATE 1: validation report before the editor opens ----
    const gate = page.getByRole('dialog', { name: 'Kiểm tra tài liệu vừa nhập' });
    await expect(gate).toBeVisible({ timeout: 60_000 });
    await expect(gate.getByTestId('validation-issues')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, '1-import-gate.png') });
    await gate.getByRole('button', { name: 'Vào chỉnh sửa' }).click();
    await expect(page.getByTestId('document-menu-bar').getByLabel('Tên tài liệu')).toHaveValue(docName, { timeout: 30_000 });

    // ---- autosave reaches the server ----
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', /saved/, { timeout: 30_000 });
    const listed = await (await fetch(`${API}/api/v1/documents`)).json();
    const saved = listed.find((d: any) => d.name === docName);
    expect(saved).toBeTruthy();
    const id = saved.id as string;

    // ---- explicit save creates a versioned snapshot ----
    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 30_000 });

    // ---- GATE 2 + export (advisory: user can still export) ----
    for (const [label, ext] of [[/XML JATS/, 'xml'], [/Word/, 'docx'], [/PDF/, 'pdf']] as const) {
      await openMenu(page, label);
      const exportGate = page.getByRole('dialog', { name: /Kiểm tra trước khi xuất/ });
      if (await exportGate.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await page.screenshot({ path: path.join(OUT, `2-export-gate-${ext}.png`) });
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: ext === 'pdf' ? 170_000 : 60_000 }),
          exportGate.getByRole('button', { name: /xuất/i }).last().click(),
        ]);
        const file = path.join(OUT, `export.${ext}`);
        await download.saveAs(file);
        expect(fs.statSync(file).size).toBeGreaterThan(500);
      }
    }
    const xml = fs.readFileSync(path.join(OUT, 'export.xml'), 'utf8');
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<article');

    // exports are archived on the server
    await expect
      .poll(async () => (await (await fetch(`${API}/api/v1/documents/${id}/exports`)).json()).map((e: any) => e.format).sort(), { timeout: 30_000 })
      .toEqual(expect.arrayContaining(['docx', 'xml', 'pdf']));

    // ---- reopen from the Open list after a full reload ----
    await page.reload();
    await openMenu(page, /Mở/);
    const item = page.getByTestId('open-document-list').getByRole('button', { name: new RegExp(docName) });
    await expect(item).toBeVisible({ timeout: 20_000 });
    await item.click();
    await expect(page.getByTestId('document-menu-bar').getByLabel('Tên tài liệu')).toHaveValue(docName, { timeout: 20_000 });
    await page.screenshot({ path: path.join(OUT, '3-reopened.png') });
  });
});
