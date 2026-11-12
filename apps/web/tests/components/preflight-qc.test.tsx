// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { computePreflightCheckWrapper } from '@/components/editor/preflight-wrapper';
import { PreflightQCTab } from '@/components/editor/PreflightQCTab';
import type { CompletePaper } from '@/types/paper';

describe('Preflight QC & PreflightQCTab Integration', () => {
  afterEach(() => {
    cleanup();
  });
  const samplePaper: CompletePaper = {
    id: 'paper-test-1',
    metadata: {
      title: 'Đánh giá cấu trúc tế bào trong điều trị bệnh lý đường hô hấp',
      titleEn: 'Evaluation of cellular structure in respiratory pathology treatments',
      articleType: 'Bài báo nghiên cứu',
      journalId: 'VNUHCM-HS',
      journalName: 'Tạp chí Phát triển KH&CN - Khoa học Sức khỏe',
      journalAbbv: 'Sci. Tech. Dev. J. - Health Sci.',
      authors: [
        {
          id: 'auth-1',
          name: 'BS. Trần Văn B',
          affiliationIds: [1],
          isCorresponding: true,
          email: 'tranvanb@med.edu.vn',
        },
      ],
      affiliations: [
        {
          id: 1,
          name: 'Đại học Y Dược TP.HCM',
        },
      ],
      corresponding: {
        name: 'BS. Trần Văn B',
        email: 'tranvanb@med.edu.vn',
        affiliation: 'Đại học Y Dược TP.HCM',
      },
      abstract: Array.from({ length: 280 }, (_, i) => `từ${i}`).join(' '),
      abstractEn: Array.from({ length: 40 }, (_, i) => `word${i}`).join(' '),
      keywords: ['hô hấp', 'tế bào', 'bệnh lý', 'lâm sàng'],
      keywordsEn: ['respiratory', 'cellular', 'pathology', 'clinical'],
      dates: { received: '2026-01-01', revised: '', accepted: '', published: '' },
      doi: '10.32508/vnuhcm-hs.123',
      volume: '1',
      issue: '1',
      year: '2026',
      firstPage: 1,
      lastPage: 10,
    },
    sections: [
      {
        id: 'sec-1',
        title: '1. Đặt vấn đề / Giới thiệu',
        type: 'h1',
        content: 'Nội dung mở đầu nghiên cứu [1].',
      },
      {
        id: 'sec-2',
        title: '2. Phương pháp nghiên cứu',
        type: 'h1',
        content: 'Mô tả phương pháp thực nghiệm.',
      },
      {
        id: 'sec-3',
        title: '3. Kết quả',
        type: 'h1',
        content: 'Báo cáo kết quả thu thập.',
      },
      {
        id: 'sec-4',
        title: '4. Kết luận',
        type: 'h1',
        content: 'Tóm tắt kết luận.',
      },
      {
        id: 'sec-cite',
        title: 'Trích dẫn bài báo',
        type: 'citation',
        content: 'Trích dẫn bài báo này: Trần Văn B (2026). Đánh giá cấu trúc tế bào...',
      },
    ],
    references: [
      {
        id: 1,
        raw: 'Nguyen VA, et al. Respiratory Research. 2025; 10(1): 1-10.',
        isCited: true,
        citationCount: 1,
      },
    ],
  };

  it('computes preflight check with @structpaper/qc-engine', () => {
    const preflight = computePreflightCheckWrapper(samplePaper);
    expect(preflight).toBeDefined();
    expect(preflight.score).toBeGreaterThanOrEqual(90);
    expect(preflight.titleOk).toBe(true);
    expect(preflight.abstractOk).toBe(true);
    expect(preflight.imradOk).toBe(true);
    expect(preflight.authorsCount).toBe(1);
    expect(preflight.vancouverConformant).toBe(true);
    expect(preflight.pillars).toBeDefined();
    expect(preflight.pillars?.imrad).toBeDefined();
    expect(preflight.pillars?.citations).toBeDefined();
  });

  it('renders PreflightQCTab with 6 pillars and responds to fix navigation', () => {
    const paperWithIssue: CompletePaper = {
      ...samplePaper,
      metadata: {
        ...samplePaper.metadata,
        title: 'Ngắn', // will trigger title issue
      },
    };

    const handleNavigate = vi.fn();
    render(<PreflightQCTab paper={paperWithIssue} onNavigateTab={handleNavigate} />);

    // Check header
    expect(screen.getByText('Kiểm Định Cấu Trúc & Tiêu Chuẩn')).toBeDefined();
    expect(screen.getByText('Điểm chuẩn hóa')).toBeDefined();

    // Check 6 pillars rendered
    expect(screen.getByText('1. Tiêu đề & Định danh')).toBeDefined();
    expect(screen.getByText('2. Tác giả & Đơn vị')).toBeDefined();
    expect(screen.getByText('3. Tóm tắt & Từ khóa')).toBeDefined();
    expect(screen.getByText('4. Khung cấu trúc IMRaD')).toBeDefined();
    expect(screen.getByText('5. Minh họa & Bảng biểu')).toBeDefined();
    expect(screen.getByText('6. Trích dẫn Vancouver')).toBeDefined();

    // Find "Sửa ngay" button
    const fixButton = screen.getAllByRole('button', { name: /Sửa ngay/i })[0];
    expect(fixButton).toBeDefined();
    fireEvent.click(fixButton);

    expect(handleNavigate).toHaveBeenCalled();
  });

  it('renders minimalist VS Code-style collapsible problems tree with groups and responds to toggle', () => {
    const paperWithIssues: CompletePaper = {
      ...samplePaper,
      metadata: {
        ...samplePaper.metadata,
        title: 'Ngắn',
        keywords: ['chỉ một'],
      },
    };

    const handleNavigate = vi.fn();
    render(<PreflightQCTab paper={paperWithIssues} onNavigateTab={handleNavigate} />);

    // Verify tree container is rendered
    expect(screen.getByTestId('preflight-issues-tree')).toBeDefined();

    // Verify metadata group header
    const metadataGroupBtn = screen.getByTestId('preflight-group-metadata');
    expect(metadataGroupBtn).toBeDefined();
    expect(metadataGroupBtn.getAttribute('aria-expanded')).toBe('true');

    // Click to collapse group
    fireEvent.click(metadataGroupBtn);
    expect(metadataGroupBtn.getAttribute('aria-expanded')).toBe('false');

    // Click to re-expand group
    fireEvent.click(metadataGroupBtn);
    expect(metadataGroupBtn.getAttribute('aria-expanded')).toBe('true');

    // Toggle all groups
    const toggleAllBtn = screen.getByRole('button', { name: /Thu gọn tất cả/i });
    fireEvent.click(toggleAllBtn);
    expect(metadataGroupBtn.getAttribute('aria-expanded')).toBe('false');

    const expandAllBtn = screen.getByRole('button', { name: /Mở rộng tất cả/i });
    fireEvent.click(expandAllBtn);
    expect(metadataGroupBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders clean success banner when paper has zero preflight issues', () => {
    const perfectPreflight = {
      ...computePreflightCheckWrapper(samplePaper),
      issues: [],
      score: 100,
    };

    render(<PreflightQCTab preflight={perfectPreflight} onNavigateTab={vi.fn()} />);

    expect(screen.getByText(/Bản thảo hoàn hảo và đầy đủ 100%/i)).toBeDefined();
    expect(screen.queryByTestId('preflight-issues-tree')).toBeNull();
  });
});
