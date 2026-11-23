// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const bar = vi.hoisted(() => ({ value: null as any }));
vi.mock('@/context/EditorSessionContext', () => ({ useEditorSession: () => ({ trashBar: bar.value }) }));

import { TrashTitleBarInfo, TrashTitleBarActions } from '@/components/titlebar/TrashTitleBarInfo';
import { isTrashPreviewRoute } from '@/components/titlebar/titlebar-routes';

afterEach(cleanup);

describe('the title bar on a deleted paper', () => {
  it('says it is in the trash and read-only, with who deleted it and the days left', () => {
    bar.value = { deletedAt: new Date().toISOString(), deletedBy: 'Lan', daysLeft: 2, busy: false };
    render(<TrashTitleBarInfo />);
    expect(screen.getByTestId('titlebar-trash').textContent).toContain('chỉ xem');
    expect(screen.getByTestId('titlebar-trash-info').textContent).toContain('bởi Lan');
    expect(screen.getByTestId('trash-preview-days').textContent).toContain('Còn 2 ngày');
    expect(screen.getByTestId('trash-preview-days').className).toContain('rose');
  });

  it('shows only the actions the server allows, and disables them while working', () => {
    const onRestore = vi.fn();
    bar.value = { deletedAt: new Date().toISOString(), daysLeft: 20, busy: false, onRestore };
    const { rerender } = render(<TrashTitleBarActions />);
    fireEvent.click(screen.getByTestId('trash-preview-restore'));
    expect(onRestore).toHaveBeenCalled();
    expect(screen.queryByTestId('trash-preview-purge')).toBeNull();
    bar.value = { ...bar.value, busy: true, onPurge: vi.fn() };
    rerender(<TrashTitleBarActions />);
    expect((screen.getByTestId('trash-preview-restore') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('trash-preview-purge') as HTMLButtonElement).disabled).toBe(true);
  });

  it('only a deleted paper\'s page uses it', () => {
    expect(isTrashPreviewRoute('/trash/abc')).toBe(true);
    expect(isTrashPreviewRoute('/trash')).toBe(false);
    expect(isTrashPreviewRoute('/papers/abc')).toBe(false);
  });
});
