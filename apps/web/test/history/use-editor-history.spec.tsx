// @vitest-environment happy-dom
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { useEditorHistory } from '@/features/editor/hooks/useEditorHistory';
import type { EditorTab } from '@/lib/history/paper-content';

const paper = (): any => ({
  id: 'p1',
  version: 3,
  profilePin: { base: 1 },
  metadata: { title: 'Gốc', abstract: '', keywords: [], authors: [], affiliations: [], dates: {} },
  sections: [
    { id: 's1', type: 'paragraph', content: 'Đoạn một' },
    { id: 's2', type: 'paragraph', content: 'Đoạn hai' },
  ],
  references: [],
});

/** Two tabs with a field each, the way the editor lays out its panels. */
const Harness: React.FC<{ initial?: any; onShow?: (id: string, edit: boolean) => void }> = ({ initial = paper(), onShow }) => {
  const [formData, setFormData] = useState(initial);
  const [tab, setTab] = useState<EditorTab>('metadata');
  const [dirty, setDirty] = useState(false);
  const h = useEditorHistory({ formData, setFormData, setIsDirty: setDirty, setActiveTab: setTab, showSection: (id, edit) => onShow?.(id, edit) });
  return (
    <div>
      <button data-testid="to-sections" onClick={() => setTab('sections')} />
      <button data-testid="to-metadata" onClick={() => setTab('metadata')} />
      <span data-testid="tab">{tab}</span>
      <span data-testid="dirty">{String(dirty)}</span>
      <span data-testid="version">{formData.version}</span>
      <span data-testid="state">{`${h.canUndo}/${h.canRedo}/${h.undoLabel}`}</span>
      <div data-editor-panel={tab}>
        {tab === 'metadata' && (
          <input data-testid="title" value={formData.metadata.title} onChange={(e) => setFormData((p: any) => ({ ...p, metadata: { ...p.metadata, title: e.target.value } }))} />
        )}
        {tab === 'sections' &&
          formData.sections.map((s: any, i: number) => (
            <div id={`section-card-${s.id}`} key={s.id}>
              <textarea
                data-testid={`para-${s.id}`}
                value={s.content}
                onChange={(e) => setFormData((p: any) => ({ ...p, sections: p.sections.map((x: any) => (x.id === s.id ? { ...x, content: e.target.value } : x)) }))}
              />
            </div>
          ))}
      </div>
      <button data-testid="undo" onClick={h.undo} />
    </div>
  );
};

afterEach(cleanup);
const ctrlZ = (opts: { shift?: boolean } = {}) => fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: !!opts.shift });

describe('Ctrl+Z over the whole paper', () => {
  it('undoes a change, redoes it, and leaves the server bookkeeping alone', async () => {
    render(<Harness />);
    const title = screen.getByTestId('title') as HTMLInputElement;
    title.focus();
    fireEvent.change(title, { target: { value: 'Mới' } });
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('true/false/Sửa tiêu đề'));

    ctrlZ();
    await waitFor(() => expect((screen.getByTestId('title') as HTMLInputElement).value).toBe('Gốc'));
    expect(screen.getByTestId('version').textContent).toBe('3');
    expect(screen.getByTestId('dirty').textContent).toBe('true');
    expect(screen.getByTestId('state').textContent).toContain('false/true');

    ctrlZ({ shift: true });
    await waitFor(() => expect((screen.getByTestId('title') as HTMLInputElement).value).toBe('Mới'));
  });

  it('a run of typing is one step', async () => {
    render(<Harness />);
    const title = screen.getByTestId('title') as HTMLInputElement;
    title.focus();
    for (const v of ['M', 'Mớ', 'Mới']) fireEvent.change(title, { target: { value: v } });
    ctrlZ();
    await waitFor(() => expect((screen.getByTestId('title') as HTMLInputElement).value).toBe('Gốc'));
  });

  it('goes back to the tab the change was made in and puts the cursor in that very field', async () => {
    const shown: [string, boolean][] = [];
    render(<Harness onShow={(id, edit) => shown.push([id, edit])} />);
    fireEvent.click(screen.getByTestId('to-sections'));
    const second = screen.getByTestId('para-s2') as HTMLTextAreaElement;
    second.focus();
    fireEvent.change(second, { target: { value: 'Đoạn hai đã sửa' } });
    // the author moves to another tab, then undoes
    fireEvent.click(screen.getByTestId('to-metadata'));
    expect(screen.getByTestId('tab').textContent).toBe('metadata');

    ctrlZ();
    await waitFor(() => expect(screen.getByTestId('tab').textContent).toBe('sections'));
    await waitFor(() => expect((screen.getByTestId('para-s2') as HTMLTextAreaElement).value).toBe('Đoạn hai'));
    expect(shown.at(-1)).toEqual(['s2', true]);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('para-s2')));
  });

  it('does not take Ctrl+Z from a field outside the editor panels, or while a dialog is open', async () => {
    render(
      <>
        <input data-testid="outside" />
        <Harness />
      </>,
    );
    const title = screen.getByTestId('title') as HTMLInputElement;
    title.focus();
    fireEvent.change(title, { target: { value: 'Mới' } });

    screen.getByTestId('outside').focus();
    ctrlZ();
    await act(async () => new Promise((r) => setTimeout(r, 150)));
    expect((screen.getByTestId('title') as HTMLInputElement).value).toBe('Mới');

    title.focus();
    const dialog = document.createElement('div');
    dialog.setAttribute('data-testid', 'modal-portal-root');
    document.body.appendChild(dialog);
    ctrlZ();
    await act(async () => new Promise((r) => setTimeout(r, 150)));
    expect((screen.getByTestId('title') as HTMLInputElement).value).toBe('Mới');
    dialog.remove();
  });

  it('another paper starts with an empty history', async () => {
    const { rerender } = render(<Harness initial={paper()} />);
    const title = screen.getByTestId('title') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Mới' } });
    await waitFor(() => expect(screen.getByTestId('state').textContent).toContain('true'));
    rerender(<Harness key="other" initial={{ ...paper(), id: 'p2' }} />);
    expect(screen.getByTestId('state').textContent).toMatch(/^false\/false/);
  });
});
