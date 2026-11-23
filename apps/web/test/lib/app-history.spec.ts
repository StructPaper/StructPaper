import { describe, it, expect } from 'vitest';
import { nextStack, pageBehind, isHistoryPage } from '@/lib/app-history';

describe('the pages walked through in a tab', () => {
  it('adds a page for every normal arrival, even one that leads to the page just behind', () => {
    let s: string[] = [];
    s = nextStack(s, '/papers');
    s = nextStack(s, '/papers/1');
    s = nextStack(s, '/preview');
    expect(s).toEqual(['/papers', '/papers/1', '/preview']);
    // "back to the editor" done with a link adds a browser history entry: it is a new page, not a back
    s = nextStack(s, '/papers/1');
    expect(s).toEqual(['/papers', '/papers/1', '/preview', '/papers/1']);
  });

  it('removes the page the user left on a real back', () => {
    const s = nextStack(['/papers', '/papers/1', '/preview'], '/papers/1', true);
    expect(s).toEqual(['/papers', '/papers/1']);
    expect(pageBehind(s)).toBe('/papers');
  });

  it('knows nothing is behind a page that was opened directly', () => {
    expect(pageBehind(nextStack([], '/papers/1'))).toBeNull();
  });

  it('ignores the same page twice and keeps the stack bounded', () => {
    expect(nextStack(['/a'], '/a')).toEqual(['/a']);
    let s: string[] = [];
    for (let i = 0; i < 120; i++) s = nextStack(s, `/p/${i}`);
    expect(s.length).toBe(50);
  });

  it('recognises a history page', () => {
    expect(isHistoryPage('/papers/abc/history')).toBe(true);
    expect(isHistoryPage('/papers/abc')).toBe(false);
  });
});
