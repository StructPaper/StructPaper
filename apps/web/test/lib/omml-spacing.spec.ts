import { describe, it, expect } from 'vitest';
import { ommlToLatex } from '@/lib/omml';

const run = (t: string) => `<m:r><m:t>${t}</m:t></m:r>`;
const sub = (base: string, s: string) => `<m:sSub><m:e>${run(base)}</m:e><m:sub>${run(s)}</m:sub></m:sSub>`;

describe('a Greek letter used as a subscript does not swallow the letter after it', () => {
  it('lambda_nu followed by z_nu', () => {
    const latex = ommlToLatex(`<m:oMath>${sub('λ', 'ν')}${sub('z', 'ν')}</m:oMath>`);
    expect(latex).toBe(String.raw`\lambda _\nu z_\nu`.replace(' _', '_'));
    expect(latex).not.toContain(String.raw`\nuz`);
  });

  it('a plain letter subscript stays compact', () => {
    expect(ommlToLatex(`<m:oMath>${sub('x', 'i')}</m:oMath>`)).toBe('x_i');
  });
});
