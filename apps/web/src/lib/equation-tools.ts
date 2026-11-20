/**
 * Helpers of the equation block: inserting symbols and structures at the cursor, cleaning LaTeX pasted from elsewhere, and the
 * catalogue of symbols, structures and ready-made formulas offered in the block.
 *
 * A snippet is LaTeX with two markers:
 *   ‹sel›  where the text selected in the box goes (so "x" selected then Fraction gives \frac{x}{})
 *   ‸      where the cursor ends up when something was selected (without a selection it goes to the first ‹sel›, else here)
 */

export const SEL = '‹sel›';
export const CARET = '‸';

export interface Edit {
  text: string;
  /** Selection after the edit (a cursor when start === end). */
  start: number;
  end: number;
}

/** Puts `snippet` where the cursor or selection is. */
export function insertSnippet(text: string, selStart: number, selEnd: number, snippet: string): Edit {
  const start = Math.max(0, Math.min(selStart, text.length));
  const end = Math.max(start, Math.min(selEnd, text.length));
  const selected = text.slice(start, end);

  let out = '';
  let caretAt = -1;
  let firstSlot = -1;
  for (const token of snippet.split(/(‹sel›|‸)/)) {
    if (token === SEL) {
      if (firstSlot < 0) firstSlot = out.length;
      out += selected;
    } else if (token === CARET) {
      if (caretAt < 0) caretAt = out.length;
    } else {
      out += token;
    }
  }
  // with a selection the cursor goes where the snippet says; without one, into the first slot to fill
  const at = selected ? (caretAt >= 0 ? caretAt : out.length) : firstSlot >= 0 ? firstSlot : caretAt >= 0 ? caretAt : out.length;
  return { text: text.slice(0, start) + out + text.slice(end), start: start + at, end: start + at };
}

/**
 * LaTeX copied from a paper, a web page or another editor comes with its own wrapping: $$ ... $$, \[ ... \], \( ... \),
 * \begin{equation} ... \end{equation}, a \label and a trailing number "(1)". The block holds the formula only.
 */
export function cleanPastedLatex(raw: string): string {
  let s = (raw ?? '').trim();
  if (!s) return '';
  const wrappers: Array<[RegExp, string]> = [
    [/^\$\$([\s\S]*)\$\$$/, '$1'],
    [/^\\\[([\s\S]*)\\\]$/, '$1'],
    [/^\\\(([\s\S]*)\\\)$/, '$1'],
    [/^\$([^$][\s\S]*)\$$/, '$1'],
    [/^\\begin\{(equation\*?|displaymath|align\*?|gather\*?)\}([\s\S]*)\\end\{\1\}$/, '$2'],
  ];
  for (const [re, to] of wrappers) {
    const m = s.match(re);
    if (m) {
      s = s.replace(re, to).trim();
      break;
    }
  }
  s = s.replace(/\\label\{[^}]*\}/g, '').replace(/\\nonumber|\\notag/g, '');
  // a number typed after the formula: "... (3)" or "... \tag{3}" on its own
  s = s.replace(/\\tag\*?\{[^}]*\}\s*$/, '').replace(/\s{2,}\(\d{1,3}\)\s*$/, '');
  return s.replace(/[ \t]+$/gm, '').trim();
}

export interface Tool {
  /** What the button shows. */
  label: string;
  /** What the pointer says (Vietnamese). */
  hint: string;
  snippet: string;
}

export interface ToolGroup {
  id: 'greek' | 'operators' | 'structures';
  name: string;
  tools: Tool[];
}

const greek = (name: string, char: string, cmd = name): Tool => ({ label: char, hint: `${name} (\\${cmd})`, snippet: `\\${cmd} ` });

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'greek',
    name: 'Chữ Hy Lạp',
    tools: [
      greek('alpha', 'α'), greek('beta', 'β'), greek('gamma', 'γ'), greek('delta', 'δ'), greek('epsilon', 'ε', 'varepsilon'),
      greek('zeta', 'ζ'), greek('eta', 'η'), greek('theta', 'θ'), greek('lambda', 'λ'), greek('mu', 'μ'), greek('nu', 'ν'),
      greek('xi', 'ξ'), greek('pi', 'π'), greek('rho', 'ρ'), greek('sigma', 'σ'), greek('tau', 'τ'), greek('phi', 'φ', 'varphi'),
      greek('chi', 'χ'), greek('psi', 'ψ'), greek('omega', 'ω'), greek('Gamma', 'Γ'), greek('Delta', 'Δ'), greek('Theta', 'Θ'),
      greek('Lambda', 'Λ'), greek('Sigma', 'Σ'), greek('Phi', 'Φ'), greek('Psi', 'Ψ'), greek('Omega', 'Ω'),
    ],
  },
  {
    id: 'operators',
    name: 'Toán tử và quan hệ',
    tools: [
      { label: '±', hint: 'Cộng trừ (\\pm)', snippet: '\\pm ' },
      { label: '×', hint: 'Nhân (\\times)', snippet: '\\times ' },
      { label: '÷', hint: 'Chia (\\div)', snippet: '\\div ' },
      { label: '·', hint: 'Chấm nhân (\\cdot)', snippet: '\\cdot ' },
      { label: '≤', hint: 'Nhỏ hơn hoặc bằng (\\leq)', snippet: '\\leq ' },
      { label: '≥', hint: 'Lớn hơn hoặc bằng (\\geq)', snippet: '\\geq ' },
      { label: '≠', hint: 'Khác (\\neq)', snippet: '\\neq ' },
      { label: '≈', hint: 'Xấp xỉ (\\approx)', snippet: '\\approx ' },
      { label: '∝', hint: 'Tỉ lệ với (\\propto)', snippet: '\\propto ' },
      { label: '→', hint: 'Mũi tên (\\rightarrow)', snippet: '\\rightarrow ' },
      { label: '⇒', hint: 'Suy ra (\\Rightarrow)', snippet: '\\Rightarrow ' },
      { label: '∈', hint: 'Thuộc (\\in)', snippet: '\\in ' },
      { label: '∀', hint: 'Với mọi (\\forall)', snippet: '\\forall ' },
      { label: '∃', hint: 'Tồn tại (\\exists)', snippet: '\\exists ' },
      { label: '∞', hint: 'Vô cực (\\infty)', snippet: '\\infty ' },
      { label: '∂', hint: 'Đạo hàm riêng (\\partial)', snippet: '\\partial ' },
      { label: '∇', hint: 'Nabla (\\nabla)', snippet: '\\nabla ' },
      { label: '°', hint: 'Độ (^{\\circ})', snippet: '^{\\circ}' },
    ],
  },
  {
    id: 'structures',
    name: 'Cấu trúc',
    tools: [
      { label: 'a/b', hint: 'Phân số (\\frac)', snippet: `\\frac{${SEL}}{${CARET}}` },
      { label: 'xⁿ', hint: 'Số mũ (^)', snippet: `^{${SEL}${CARET}}` },
      { label: 'xₙ', hint: 'Chỉ số dưới (_)', snippet: `_{${SEL}${CARET}}` },
      { label: '√', hint: 'Căn bậc hai (\\sqrt)', snippet: `\\sqrt{${SEL}${CARET}}` },
      { label: 'ⁿ√', hint: 'Căn bậc n (\\sqrt[n])', snippet: `\\sqrt[${CARET}]{${SEL}}` },
      { label: 'Σ', hint: 'Tổng (\\sum)', snippet: `\\sum_{i=1}^{n} ${SEL}${CARET}` },
      { label: '∏', hint: 'Tích (\\prod)', snippet: `\\prod_{i=1}^{n} ${SEL}${CARET}` },
      { label: '∫', hint: 'Tích phân (\\int)', snippet: `\\int_{a}^{b} ${SEL}${CARET}\\,dx` },
      { label: 'lim', hint: 'Giới hạn (\\lim)', snippet: `\\lim_{x \\to \\infty} ${SEL}${CARET}` },
      { label: 'x̄', hint: 'Gạch ngang trên, trung bình (\\bar)', snippet: `\\bar{${SEL}${CARET}}` },
      { label: 'x̂', hint: 'Mũ, ước lượng (\\hat)', snippet: `\\hat{${SEL}${CARET}}` },
      { label: '→x', hint: 'Vector (\\vec)', snippet: `\\vec{${SEL}${CARET}}` },
      { label: '( )', hint: 'Ngoặc tự co giãn (\\left( \\right))', snippet: `\\left( ${SEL}${CARET} \\right)` },
      { label: '| |', hint: 'Giá trị tuyệt đối (\\left| \\right|)', snippet: `\\left| ${SEL}${CARET} \\right|` },
      { label: '{ cases', hint: 'Hệ điều kiện (cases)', snippet: `\\begin{cases}\n${SEL}${CARET} & \\text{nếu } \\\\\n & \\text{ngược lại}\n\\end{cases}` },
      { label: '[ ]', hint: 'Ma trận 2×2 (bmatrix)', snippet: `\\begin{bmatrix}\n${SEL}${CARET} & \\\\\n & \n\\end{bmatrix}` },
      { label: 'abc', hint: 'Chữ thường trong công thức (\\text)', snippet: `\\text{${SEL}${CARET}}` },
    ],
  },
];

export interface FormulaTemplate {
  name: string;
  latex: string;
}

/** Ready-made formulas that come up often in papers. */
export const FORMULA_TEMPLATES: FormulaTemplate[] = [
  { name: 'Trung bình mẫu', latex: '\\bar{x} = \\frac{1}{n} \\sum_{i=1}^{n} x_i' },
  { name: 'Độ lệch chuẩn', latex: 's = \\sqrt{\\frac{1}{n-1} \\sum_{i=1}^{n} (x_i - \\bar{x})^2}' },
  { name: 'Hồi quy tuyến tính', latex: 'y_i = \\beta_0 + \\beta_1 x_i + \\varepsilon_i' },
  { name: 'Hồi quy bội', latex: 'y_{i,t} = \\alpha + \\beta_1 x_{1,i,t} + \\beta_2 x_{2,i,t} + \\varepsilon_{i,t}' },
  { name: 'Phân phối chuẩn', latex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}' },
  { name: 'Xác suất có điều kiện', latex: 'P(A \\mid B) = \\frac{P(B \\mid A)\\, P(A)}{P(B)}' },
  { name: 'Kiểm định t', latex: 't = \\frac{\\bar{x} - \\mu_0}{s / \\sqrt{n}}' },
  { name: 'Hệ số tương quan Pearson', latex: 'r = \\frac{\\sum (x_i - \\bar{x})(y_i - \\bar{y})}{\\sqrt{\\sum (x_i - \\bar{x})^2 \\sum (y_i - \\bar{y})^2}}' },
  { name: 'Nghiệm phương trình bậc hai', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { name: 'Hàm sigmoid', latex: '\\sigma(z) = \\frac{1}{1 + e^{-z}}' },
  { name: 'Hàm mất mát bình phương', latex: 'L(\\theta) = \\frac{1}{2m} \\sum_{i=1}^{m} \\left( h_\\theta(x^{(i)}) - y^{(i)} \\right)^2' },
  { name: 'Tích phân xác định', latex: '\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)' },
];

/** What the author will read in the text to point at an equation: "Công thức (3)" / "Equation (3)". */
export const equationMention = (num: number | undefined, lang: 'vi' | 'en' = 'vi'): string => `${lang === 'en' ? 'Equation' : 'Công thức'} (${num ?? '?'})`;

/** The braces, brackets and \left/\right a formula opens and closes (what the box shows next to the formula as a quick check). */
export function bracketBalance(latex: string): { ok: boolean; message?: string } {
  const s = latex.replace(/\\[{}]/g, '').replace(/\\left\\?[.(\[|{]/g, '(').replace(/\\right\\?[.)\]|}]/g, ')');
  let braces = 0;
  for (const ch of s) {
    if (ch === '{') braces++;
    if (ch === '}') braces--;
    if (braces < 0) return { ok: false, message: 'Có dấu } thừa.' };
  }
  if (braces > 0) return { ok: false, message: `Thiếu ${braces} dấu }.` };
  const lefts = (latex.match(/\\left\b/g) ?? []).length;
  const rights = (latex.match(/\\right\b/g) ?? []).length;
  if (lefts !== rights) return { ok: false, message: lefts > rights ? 'Có \\left chưa có \\right.' : 'Có \\right chưa có \\left.' };
  return { ok: true };
}
