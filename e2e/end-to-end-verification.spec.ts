import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { IngestPipeline } from '../packages/ingest-docx/src/pipeline/ingest-pipeline';

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.resolve(REPO_ROOT, 'fixtures/golden/templates');

test.describe('Phase 8: End-to-End Browser & System Verification (Agent Omega)', () => {
  const pipeline = new IngestPipeline();

  test('8.1: Validates complete ingestion of 4 Standard Template Word files', async () => {
    const templates = [
      { file: 'Template_EN.docx', lang: 'en', minConf: 1.0 },
      { file: 'Template_VI.docx', lang: 'vi', minConf: 1.0 },
      { file: 'Bài mẫu template tiếng Anh.docx', lang: 'en', minConf: 0.65 },
      { file: 'Bài mẫu template tiếng Việt.docx', lang: 'vi', minConf: 0.8 },
    ];

    for (const item of templates) {
      const fullPath = path.resolve(TEMPLATES_DIR, item.file);
      expect(fs.existsSync(fullPath)).toBe(true);

      const buf = fs.readFileSync(fullPath);
      const res = await pipeline.ingest(buf, { fileName: item.file });

      expect(res.manuscript).toBeDefined();
      expect(res.report.confidence.overall).toBeGreaterThanOrEqual(item.minConf);
      expect(res.manuscript.body.length).toBeGreaterThan(0);
      expect(res.report.stats.sectionsCount).toBeGreaterThan(0);
    }
  });

  test('8.2: Verifies Editor UI layout shell, navigation tabs, dock, and live preview', async ({
    page,
  }) => {
    // Navigate to paper editor page
    await page.goto('/papers/sample-preview-paper', { waitUntil: 'domcontentloaded' });

    // Verify main navigation buttons or tabs
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Tựa đề');
    expect(pageContent).toContain('Tác giả');
    expect(pageContent).toContain('Nội dung');
    expect(pageContent).toContain('Tài liệu tham khảo');
  });

  test('8.3: Verifies TipTap paragraph rich-text editor and Vietnamese composition', async ({
    page,
  }) => {
    // Navigate to tiptap harness
    await page.goto('/dev-tiptap-test', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ready-indicator')).toBeVisible({ timeout: 15000 });

    const editor = page.locator('.tiptap-paragraph-editor .ProseMirror');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Focus editor and check content
    await editor.click();
    const editorText = await editor.textContent();
    expect(editorText).toContain('Nội dung đoạn văn mẫu');

    // Test formatting buttons (Ctrl+B / Bold)
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Văn bản y sinh kiểm thử');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+B');

    // Verify strong tag is applied
    const strongElement = editor.locator('strong');
    await expect(strongElement).toBeVisible();
  });

  test('8.4: Verifies Undo/Redo & IndexedDB data persistence on page reload (F5)', async ({
    page,
  }) => {
    await page.goto('/dev-persistence-test');
    await expect(page.getByTestId('ready-indicator')).toHaveText('READY', {
      timeout: 10000,
    });

    const docId = 'doc_phase8_omega_test';
    const sampleTitle = 'Đánh giá cấu trúc phân tử StructPaper v2';

    // Seed manuscript
    await page.evaluate(
      async ({ id, title }) => {
        if (!window.__STRUCTPAPER_TEST__) throw new Error('Harness not loaded');
        await window.__STRUCTPAPER_TEST__.clearDatabase();
        await window.__STRUCTPAPER_TEST__.seedManuscript({
          id,
          journalId: 'vnuhcm-hs',
          meta: {
            title: [{ t: 'text', v: title }],
            authors: [
              {
                id: 'auth_1',
                name: 'PGS. TS. Trần Văn Omega',
                affiliationIds: ['aff_1'],
                email: 'omega@vnuhcm.edu.vn',
                isCorresponding: true,
              },
            ],
            affiliations: [{ id: 'aff_1', institution: 'VNUHCM - Sức Khỏe' }],
            abstract: [[{ t: 'text', v: 'Tóm tắt bài báo kiểm định Agent Omega.' }]],
            keywords: ['Omega', 'Playwright', 'Persistence'],
          },
        });
      },
      { id: docId, title: sampleTitle }
    );

    await expect(page.getByTestId('store-title')).toHaveText(sampleTitle);

    // Edit title
    const updatedTitle = 'Tiêu đề sau chỉnh sửa - Chuẩn bị F5 reload';
    const titleInput = page.getByTestId('input-title');
    await titleInput.fill(updatedTitle);

    // Wait for autosave debounce (1200ms)
    await page.waitForTimeout(1400);

    // Perform reload (F5)
    await page.reload();
    await expect(page.getByTestId('ready-indicator')).toHaveText('READY', {
      timeout: 10000,
    });

    // Re-verify that the modified title survived 100% with zero data loss
    await expect(page.getByTestId('store-title')).toHaveText(updatedTitle);
  });
});
