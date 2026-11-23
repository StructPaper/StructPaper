// @vitest-environment happy-dom
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { KeywordsInput } from '@/features/editor/components/KeywordsInput';
import { PublicationInfoFields } from '@/features/editor/components/PublicationInfoFields';

afterEach(cleanup);

describe('Keywords field accepts commas while typing', () => {
  const Host = ({ onList }: { onList: (l: string[]) => void }) => {
    const [list, setList] = useState<string[]>([]);
    return (
      <KeywordsInput
        aria-label="kw"
        value={list}
        onChange={(l) => {
          setList(l);
          onList(l);
        }}
      />
    );
  };

  it('keeps the comma (and the space after it) in the box, and reports clean keywords', () => {
    const seen = vi.fn();
    render(<Host onList={seen} />);
    const input = screen.getByLabelText('kw') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'tế bào' } });
    fireEvent.change(input, { target: { value: 'tế bào,' } });
    expect(input.value).toBe('tế bào,');

    fireEvent.change(input, { target: { value: 'tế bào, ' } });
    expect(input.value).toBe('tế bào, ');

    fireEvent.change(input, { target: { value: 'tế bào, màng mỏng' } });
    expect(seen).toHaveBeenLastCalledWith(['tế bào', 'màng mỏng']);
  });

  it('follows the list when it changes from outside (undo / load)', () => {
    const { rerender } = render(<KeywordsInput aria-label="kw" value={['a']} onChange={vi.fn()} />);
    rerender(<KeywordsInput aria-label="kw" value={['x', 'y']} onChange={vi.fn()} />);

    expect((screen.getByLabelText('kw') as HTMLInputElement).value).toBe('x, y');
  });
});

describe('Publication info shows blanks, not "?"', () => {
  const metadata: any = { journalId: 'VNUHCM-STD', publication: {} };

  it('never-entered fields are empty and there is no explanation about "?"', () => {
    render(<PublicationInfoFields metadata={metadata} onChange={vi.fn()} />);

    for (const id of ['volume', 'issue', 'firstPage', 'lastPage', 'doi']) {
      expect((document.getElementById(`pub-${id}`) as HTMLInputElement).value).toBe('');
    }
    // the publication date is picked from a calendar like the other dates, not typed into a box
    expect(document.getElementById('pub-published')).toBeNull();
    expect(screen.getByTestId('publication-info').textContent).toContain('Ngày đăng');
    expect(screen.getByTestId('publication-info').textContent).not.toContain('?');
  });

  it('typed values are shown as typed', () => {
    render(<PublicationInfoFields metadata={{ ...metadata, publication: { volume: '10' } }} onChange={vi.fn()} />);

    expect((document.getElementById('pub-volume') as HTMLInputElement).value).toBe('10');
  });
});
