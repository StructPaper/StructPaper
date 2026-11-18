// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createPaperAccess } from '@/features/papers/access';
import { PaperGate } from '@/features/papers/components/PaperGate';

afterEach(cleanup);

const server = (access: any, loading = false) => createPaperAccess({ kind: 'server', access, loading });
const OWNER = { canEdit: true, canShare: true, canDelete: true };
const EDITOR = { canEdit: true, canShare: false, canDelete: false };
const READER = { canEdit: false, canShare: false, canDelete: false };

describe('createPaperAccess (pure rules)', () => {
  it('owner: edits, shares, deletes', () => {
    expect(server(OWNER)).toMatchObject({ status: 'ready', canView: true, canEdit: true, canShare: true, canDelete: true, readOnly: false });
  });

  it('member who can edit: no share, no delete', () => {
    expect(server(EDITOR)).toMatchObject({ canView: true, canEdit: true, canShare: false, canDelete: false, readOnly: false });
  });

  it('reader: sees the paper but it is read-only', () => {
    expect(server(READER)).toMatchObject({ canView: true, canEdit: false, readOnly: true });
  });

  it('a paper that only exists on this machine is the user own (nobody to share with)', () => {
    expect(createPaperAccess({ kind: 'local' })).toMatchObject({ canView: true, canEdit: true, canDelete: true, canShare: false, readOnly: false });
  });

  it('no answer from the server means NO access (default deny), not read-only', () => {
    expect(server(undefined)).toMatchObject({ canView: false, canEdit: false, canDelete: false, canShare: false, readOnly: false });
  });

  it('while loading everything is denied and the reason is LOADING', () => {
    const access = server(OWNER, true);
    expect(access.status).toBe('loading');
    expect(access.canEdit).toBe(false);
    expect(access.readOnly).toBe(false);
    expect(access.explain('edit')).toEqual({ allowed: false, reason: 'LOADING' });
  });

  it('explain gives NO_PERMISSION for a denied action', () => {
    expect(server(READER).explain('delete')).toEqual({ allowed: false, reason: 'NO_PERMISSION' });
    expect(server(READER).explain('view')).toEqual({ allowed: true });
  });
});

describe('<PaperGate>', () => {
  it('renders children only when allowed, the fallback otherwise', () => {
    const { rerender } = render(
      <PaperGate access={server(OWNER)} allow="share" fallback={<span>no</span>}>
        <span>yes</span>
      </PaperGate>,
    );
    expect(screen.getByText('yes')).toBeDefined();

    rerender(
      <PaperGate access={server(EDITOR)} allow="share" fallback={<span>no</span>}>
        <span>yes</span>
      </PaperGate>,
    );
    expect(screen.queryByText('yes')).toBeNull();
    expect(screen.getByText('no')).toBeDefined();
  });

  it('a list needs all actions unless `any` is set', () => {
    const access = server(EDITOR);
    const { rerender } = render(<PaperGate access={access} allow={['edit', 'share']}><span>both</span></PaperGate>);
    expect(screen.queryByText('both')).toBeNull();

    rerender(<PaperGate access={access} allow={['edit', 'share']} any><span>both</span></PaperGate>);
    expect(screen.getByText('both')).toBeDefined();
  });

  it('shows the loading fallback (not the content, not the denial) while loading', () => {
    render(
      <PaperGate access={server(OWNER, true)} allow="edit" fallback={<span>denied</span>} loadingFallback={<span>loading</span>}>
        <span>content</span>
      </PaperGate>,
    );
    expect(screen.getByText('loading')).toBeDefined();
    expect(screen.queryByText('denied')).toBeNull();
    expect(screen.queryByText('content')).toBeNull();
  });

  it("mode 'disable' always renders and passes the decision", () => {
    const fn = vi.fn(() => <span>child</span>);
    render(<PaperGate access={server(READER)} allow="edit" mode="disable">{fn}</PaperGate>);
    expect(fn).toHaveBeenCalledWith({ allowed: false, reason: 'NO_PERMISSION' });
    expect(screen.getByText('child')).toBeDefined();
  });
});
