import { describe, it, expect } from 'vitest';
import { insertSnippet, cleanPastedLatex, bracketBalance, equationMention, TOOL_GROUPS, FORMULA_TEMPLATES, SEL, CARET } from '@/lib/equation-tools';
import { checkLatexMath } from '@/lib/math-text';

const r = String.raw;

describe('inserting at the cursor', () => {
  it('puts a symbol where the cursor is', () => {
    const e = insertSnippet('a+b', 1, 1, r`\alpha `);
    expect(e.text).toBe(r`a\alpha +b`);
    expect(e.start).toBe(1 + r`\alpha `.length);
  });

  it('wraps the selection: x selected, Fraction gives \\frac{x}{} with the cursor in the denominator', () => {
    const e = insertSnippet('y = x', 4, 5, `${r`\frac{`}${SEL}}{${CARET}}`);
    expect(e.text).toBe(r`y = \frac{x}{}`);
    expect(e.text.slice(0, e.start).endsWith(r`\frac{x}{`)).toBe(true);
  });

  it('without a selection the cursor goes to the first empty slot', () => {
    const e = insertSnippet('', 0, 0, `${r`\frac{`}${SEL}}{${CARET}}`);
    expect(e.text).toBe(r`\frac{}{}`);
    expect(e.start).toBe(r`\frac{`.length);
  });

  it('replaces a selection with a symbol', () => {
    expect(insertSnippet('a+b', 1, 2, r`\times `).text).toBe(r`a\times b`);
  });

  it('never goes outside the text', () => {
    expect(insertSnippet('ab', 9, 20, 'c').text).toBe('abc');
  });
});

describe('cleaning pasted LaTeX', () => {
  const cases: Array<[string, string]> = [
    ['$$x^2$$', 'x^2'],
    [r`\[ x^2 \]`, 'x^2'],
    [r`\(x^2\)`, 'x^2'],
    ['$x^2$', 'x^2'],
    [r`\begin{equation} x^2 \label{eq:1} \end{equation}`, 'x^2'],
    ['\\begin{equation*}\nx^2\n\\end{equation*}'.replace(/\\\\/g, '\\'), 'x^2'],
    [r`x^2 \tag{3}`, 'x^2'],
    ['  x^2  ', 'x^2'],
  ];
  it.each(cases)('%s -> %s', (raw, clean) => {
    expect(cleanPastedLatex(raw)).toBe(clean);
  });

  it('leaves a bare formula alone, and an empty paste empty', () => {
    expect(cleanPastedLatex(r`\frac{a}{b}`)).toBe(r`\frac{a}{b}`);
    expect(cleanPastedLatex('')).toBe('');
  });
});

describe('the catalogue', () => {
  it('every ready-made formula is well formed', () => {
    for (const f of FORMULA_TEMPLATES) {
      expect(checkLatexMath(f.latex), f.name).toBeNull();
      expect(bracketBalance(f.latex).ok, f.name).toBe(true);
    }
  });

  it('every structure produces balanced LaTeX with or without a selection', () => {
    for (const g of TOOL_GROUPS) {
      for (const t of g.tools) {
        expect(bracketBalance(insertSnippet('x', 0, 1, t.snippet).text).ok, t.hint).toBe(true);
        expect(bracketBalance(insertSnippet('', 0, 0, t.snippet).text).ok, t.hint).toBe(true);
      }
    }
  });

  it('every button has a label, a hint and something to insert', () => {
    for (const g of TOOL_GROUPS) for (const t of g.tools) expect(Boolean(t.label && t.hint && t.snippet)).toBe(true);
  });
});

describe('small helpers', () => {
  it('finds a missing brace and an unmatched \\left', () => {
    expect(bracketBalance(r`\frac{a}{b`).message).toContain('Thiếu 1');
    expect(bracketBalance('a}').message).toContain('thừa');
    expect(bracketBalance(r`\left( a`).ok).toBe(false);
    expect(bracketBalance(r`\left( a \right)`).ok).toBe(true);
  });

  it('writes what to type in the text to point at an equation', () => {
    expect(equationMention(3)).toBe('Công thức (3)');
    expect(equationMention(3, 'en')).toBe('Equation (3)');
    expect(equationMention(undefined)).toBe('Công thức (?)');
  });
});
