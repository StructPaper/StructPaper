// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportValidationModal, ExportGateModal } from '@/components/documents/ValidationModals';
import { DocumentMenuBar } from '@/components/documents/DocumentMenuBar';
import { mergeDocumentLists } from '@/components/documents/OpenDocumentDialog';
import type { ValidationReport, ValidationIssue } from '@/lib/validation/validators';

afterEach(cleanup);

const issue = (over: Partial<ValidationIssue>): ValidationIssue => ({
  id: 'i1',
  gate: 'export',
  severity: 'error',
  code: 'x',
  title: 'Có lỗi',
  message: 'Chi tiết lỗi',
  ...over,
});

const report = (issues: ValidationIssue[], gate: 'import' | 'export' = 'export', canProceed?: boolean): ValidationReport => {
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  return {
    gate,
    issues,
    errorCount,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    canProceed: canProceed ?? true,
  };
};

describe('ExportGateModal (gate 2)', () => {
  it('lists errors but still lets the user export', () => {
    const onExport = vi.fn();
    render(
      <ExportGateModal isOpen format="docx" report={report([issue({ title: 'Thiếu tác giả' })])} onClose={() => {}} onAutoFix={() => {}} onExport={onExport} />
    );
    expect(screen.getByText('Thiếu tác giả')).toBeTruthy();
    const btn = screen.getByRole('button', { name: 'Vẫn xuất Word' });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('blocks only when the PDF could not be compiled', () => {
    render(
      <ExportGateModal isOpen format="pdf" report={report([issue({ code: 'export.pdf.compile' })], 'export', false)} onClose={() => {}} onAutoFix={() => {}} onExport={() => {}} />
    );
    expect((screen.getByRole('button', { name: 'Vẫn xuất PDF' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows export with warnings only, labelled as acknowledging them', () => {
    const onExport = vi.fn();
    render(
      <ExportGateModal
        isOpen
        format="xml"
        report={report([issue({ severity: 'warning', title: 'Thiếu nguồn' })])}
        onClose={() => {}}
        onAutoFix={() => {}}
        onExport={onExport}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Vẫn xuất XML' }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('offers auto-fix only when an issue is auto-fixable', () => {
    const onAutoFix = vi.fn();
    const { rerender } = render(
      <ExportGateModal isOpen format="pdf" report={report([issue({})])} onClose={() => {}} onAutoFix={onAutoFix} onExport={() => {}} />
    );
    expect(screen.queryByText(/Tự động đánh lại số thứ tự/)).toBeNull();
    rerender(
      <ExportGateModal
        isOpen
        format="pdf"
        report={report([issue({ autoFixable: true, title: 'Bảng sai thứ tự' })])}
        onClose={() => {}}
        onAutoFix={onAutoFix}
        onExport={() => {}}
      />
    );
    fireEvent.click(screen.getByText(/Tự động đánh lại số thứ tự/));
    expect(onAutoFix).toHaveBeenCalled();
  });
});

describe('ImportValidationModal (gate 1)', () => {
  it('lists missing fields and lets the user continue to editing', () => {
    const onContinue = vi.fn();
    render(
      <ImportValidationModal
        isOpen
        fileLabel="Bai bao thu nghiem"
        report={report([issue({ gate: 'import', severity: 'warning', title: 'Thiếu tiêu đề tiếng Anh', fixTab: 'metadata' })], 'import', true)}
        onClose={() => {}}
        onAutoFix={() => {}}
        onContinue={onContinue}
      />
    );
    expect(screen.getByText('Bai bao thu nghiem')).toBeTruthy();
    expect(screen.getByText('Thiếu tiêu đề tiếng Anh')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vào chỉnh sửa' }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('groups issues in a collapsible light VS-Code-style tree with count badges', () => {
    render(
      <ImportValidationModal
        isOpen
        report={report([
          issue({
            id: 'a',
            gate: 'import',
            severity: 'error',
            code: 'numbering.table',
            title: 'Bảng đánh số sai thứ tự',
            message: 'Bảng thứ 1 đang mang số 3',
            fixTab: 'sections',
          }),
          issue({
            id: 'b',
            gate: 'import',
            severity: 'warning',
            code: 'figure.source',
            title: '2 hình thiếu nguồn',
            message: 'Chưa ghi "Nguồn: …": Hình 1, 2.',
            fixTab: 'sections',
          }),
          issue({
            id: 'c',
            gate: 'import',
            severity: 'warning',
            code: 'preflight.metadata',
            title: 'Thiếu tiêu đề tiếng Anh (Title)',
            message: 'Quy chuẩn tạp chí ĐHQG-HCM bắt buộc có tiêu đề tiếng Anh.',
            suggestion: 'Bổ sung tiêu đề tiếng Anh trong tab "Thông tin chung".',
            fixTab: 'metadata',
          }),
        ], 'import', true)}
        onClose={() => {}}
        onAutoFix={() => {}}
        onContinue={() => {}}
      />
    );

    const groupBtn = screen.getByTestId('validation-group-sections');
    expect(groupBtn.textContent).toContain('Nội dung, Bảng & Hình');
    expect(groupBtn.textContent).toContain('2');
    expect(screen.getByText('Hình 1, 2')).toBeTruthy();
    // Preflight boilerplate suggestion/paragraph should stay hidden from card clutter
    expect(screen.queryByText(/Bổ sung tiêu đề tiếng Anh trong tab/)).toBeNull();

    // Collapsing hides its items, re-expanding restores them
    fireEvent.click(groupBtn);
    expect(screen.queryByText('Bảng đánh số sai thứ tự')).toBeNull();
    fireEvent.click(groupBtn);
    expect(screen.getByText('Bảng đánh số sai thứ tự')).toBeTruthy();
  });

  it('refuses to continue when the file is effectively empty', () => {
    render(
      <ImportValidationModal isOpen report={report([], 'import', false)} onClose={() => {}} onAutoFix={() => {}} onContinue={() => {}} />
    );
    expect((screen.getByRole('button', { name: 'Vào chỉnh sửa' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('DocumentMenuBar', () => {
  const base = {
    name: 'Bài A',
    onRename: vi.fn(),
    saveState: 'idle' as const,
    savedAt: null,
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onExport: vi.fn(),
  };

  it('exposes New / Open / Save and the three export formats', () => {
    const props = { ...base, onNew: vi.fn(), onOpen: vi.fn(), onSave: vi.fn(), onExport: vi.fn() };
    render(<DocumentMenuBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Tệp/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Mới/ }));
    expect(props.onNew).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Tệp/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Mở/ }));
    expect(props.onOpen).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Tệp/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Lưu/ }));
    expect(props.onSave).toHaveBeenCalled();

    for (const [label, fmt] of [['Word', 'docx'], ['PDF', 'pdf'], ['XML', 'xml']] as const) {
      fireEvent.click(screen.getByRole('button', { name: /Tệp/ }));
      fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(label) }));
      expect(props.onExport).toHaveBeenLastCalledWith(fmt);
    }
  });

  it('renames on Enter/blur and ignores empty names', () => {
    const onRename = vi.fn();
    render(<DocumentMenuBar {...base} onRename={onRename} />);
    const input = screen.getByLabelText('Tên tài liệu') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Tên mới' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('Tên mới');

    onRename.mockClear();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(input.value).toBe('Bài A');
  });

  it('shows autosave state and offers conflict resolution', () => {
    const onKeepMine = vi.fn();
    const { rerender } = render(<DocumentMenuBar {...base} saveState="saving" />);
    expect(screen.getByTestId('save-status').getAttribute('data-state')).toBe('saving');
    rerender(<DocumentMenuBar {...base} saveState="conflict" onKeepMine={onKeepMine} />);
    fireEvent.click(screen.getByText('Ghi đè bằng bản của tôi'));
    expect(onKeepMine).toHaveBeenCalled();
  });
});

describe('mergeDocumentLists', () => {
  it('merges local and server documents by id, newest first, marking where they live', () => {
    const merged = mergeDocumentLists(
      [
        { id: 'a', name: 'Chỉ trên máy', updatedAt: '2026-01-01T00:00:00Z' },
        { id: 'b', name: 'Cả hai (cũ)', updatedAt: '2026-01-02T00:00:00Z' },
      ],
      [
        { id: 'b', name: 'Cả hai (mới)', updatedAt: '2026-01-05T00:00:00Z' },
        { id: 'c', name: 'Chỉ trên máy chủ', updatedAt: '2026-01-03T00:00:00Z' },
      ]
    );
    expect(merged.map((m) => [m.id, m.where])).toEqual([
      ['b', 'both'],
      ['c', 'cloud'],
      ['a', 'local'],
    ]);
    expect(merged[0].name).toBe('Cả hai (mới)');
  });
});
