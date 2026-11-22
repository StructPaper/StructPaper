// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { fitPages, spacerElement, numberSide, contentHeight, footHeight, PAGE, PT_PX, type PageMeta } from '@/features/editor/overview/overview-pages';

const meta: PageMeta = { header: 'Journal 2026, 1(1):1-3', label: 'Trang', cite: 'A. B. 2026', citeLabel: 'Trích dẫn: ', numberPosition: 'alternating', skipFirstNumber: false, showNumbers: true, titleColor: '#2b74b7', firstPage: 1 };

describe('printed sheets', () => {
  it('keeps the measured geometry of the journal page', () => {
    expect(contentHeight(1)).toBe(648);
    expect(contentHeight(2)).toBe(648);
    expect(footHeight(2)).toBeCloseTo(792 - 51.8 - 648, 5);
    expect(PAGE.h).toBe(792);
  });

  it('puts the page number on the side the journal prints it', () => {
    expect(numberSide('alternating', 2)).toBe('left');
    expect(numberSide('alternating', 3)).toBe('right');
    expect(numberSide('center', 2)).toBe('center');
    expect(numberSide('right', 2)).toBe('right');
  });

  it('builds the foot, the gap and the head between two sheets', () => {
    const el = spacerElement(1, meta, false);
    expect(el.getAttribute('data-page')).toBe('2');
    expect(el.querySelector('.ov-cite-foot')!.textContent).toBe('Trích dẫn: A. B. 2026');
    expect(el.querySelector('.ov-pageno')!.textContent).toBe('1');
    expect(el.querySelector('.ov-pageno')!.getAttribute('data-first')).toBe('true');
    expect(el.querySelector('.ov-head-text')!.textContent).toBe('Journal 2026, 1(1):1-3');
    const last = spacerElement(3, { ...meta, firstPage: 10 }, true);
    expect(last.querySelector('.ov-head')).toBeNull();
    expect(last.querySelector('.ov-pageno')!.textContent).toBe('12'); // third page of an article that starts on page 10
    expect(last.querySelector('.ov-cite-foot')).toBeNull();
    expect(spacerElement(2, { ...meta, showNumbers: false }, false).querySelector('.ov-pageno')).toBeNull();
    expect(spacerElement(1, { ...meta, skipFirstNumber: true }, false).querySelector('.ov-pageno')).toBeNull();
  });

  it('pads a sheet whose text ends short, and takes the overrun from the foot of one that runs over', () => {
    const pm = document.createElement('div');
    pm.style.paddingTop = `${PAGE.top * PT_PX}px`;
    document.body.appendChild(pm);
    const g1 = spacerElement(1, meta, false);
    const g2 = spacerElement(2, meta, true);
    pm.append(g1, g2);
    const pt = (n: number) => n * PT_PX;
    // text of page 1: 500 pt (short of 648); text of page 2: 700 pt (over 648). The head of the next sheet ends the first spacer.
    const set = (el: HTMLElement, top: number, height: number) => {
      Object.defineProperty(el, 'offsetTop', { value: top, configurable: true });
      Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
    };
    const spacerHeight = pt(footHeight(1) + PAGE.gap + PAGE.top);
    set(g1, pt(PAGE.top) + pt(500), spacerHeight);
    set(g2, pt(PAGE.top) + pt(500) + spacerHeight + pt(700), pt(footHeight(2)));
    fitPages(pm);
    const pad1 = parseFloat((g1.querySelector('.ov-pad') as HTMLElement).style.height);
    expect(pad1).toBeCloseTo(pt(648 - 500), 3);
    const foot2 = parseFloat((g2.querySelector('.ov-foot') as HTMLElement).style.height);
    expect(foot2).toBeCloseTo(Math.max(pt(24), pt(footHeight(2)) - pt(700 - 648)), 3);
    expect((g2.querySelector('.ov-pad') as HTMLElement).style.height).toBe('0px');
  });
});
