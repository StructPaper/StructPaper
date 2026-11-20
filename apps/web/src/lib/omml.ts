import { XMLParser } from 'fast-xml-parser';

/**
 * OMML (Word equation XML) -> LaTeX.
 * Structure-aware converter (walks the XML tree) replacing the old regex approach, which
 * dropped every run nested inside sub/superscripts. Unsupported constructs degrade to their text.
 */

type OrderedNode = Record<string, any>;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

const UNICODE_TO_LATEX: Record<string, string> = {
  α: '\\alpha ', β: '\\beta ', γ: '\\gamma ', δ: '\\delta ', ε: '\\epsilon ', ϵ: '\\epsilon ', ζ: '\\zeta ', η: '\\eta ',
  θ: '\\theta ', ι: '\\iota ', κ: '\\kappa ', λ: '\\lambda ', μ: '\\mu ', ν: '\\nu ', ξ: '\\xi ', π: '\\pi ',
  ρ: '\\rho ', σ: '\\sigma ', τ: '\\tau ', υ: '\\upsilon ', φ: '\\phi ', ϕ: '\\varphi ', χ: '\\chi ', ψ: '\\psi ', ω: '\\omega ',
  Γ: '\\Gamma ', Δ: '\\Delta ', Θ: '\\Theta ', Λ: '\\Lambda ', Ξ: '\\Xi ', Π: '\\Pi ', Σ: '\\Sigma ', Φ: '\\Phi ', Ψ: '\\Psi ', Ω: '\\Omega ',
  '±': '\\pm ', '∓': '\\mp ', '×': '\\times ', '·': '\\cdot ', '÷': '\\div ', '≤': '\\leq ', '≥': '\\geq ', '≠': '\\neq ',
  '≈': '\\approx ', '≡': '\\equiv ', '∼': '\\sim ', '∝': '\\propto ', '∞': '\\infty ', '∂': '\\partial ', '∇': '\\nabla ',
  '→': '\\to ', '←': '\\leftarrow ', '⇒': '\\Rightarrow ', '⇔': '\\Leftrightarrow ', '∈': '\\in ', '∉': '\\notin ',
  '⊂': '\\subset ', '∪': '\\cup ', '∩': '\\cap ', '∀': '\\forall ', '∃': '\\exists ', '…': '\\ldots ', '⋯': '\\cdots ',
  '∑': '\\sum ', '∏': '\\prod ', '∫': '\\int ', '∬': '\\iint ', '∮': '\\oint ', '√': '\\sqrt ', '°': '^{\\circ}', '−': '-', '′': "'",
};

const NARY_CHR: Record<string, string> = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '∮': '\\oint', '∐': '\\coprod' };
const ACCENT: Record<string, string> = { '^': '\\hat', '̂': '\\hat', '~': '\\tilde', '̃': '\\tilde', '¯': '\\bar', '̄': '\\bar', '˙': '\\dot', '̇': '\\dot', '→': '\\vec', '⃗': '\\vec' };
const FUNC_NAMES = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'lim', 'min', 'max', 'det', 'sup', 'inf', 'arg']);

function textOf(node: OrderedNode[] | undefined): string {
  if (!node) return '';
  return node.map((n) => (typeof n['#text'] === 'string' ? n['#text'] : '')).join('');
}

function escapeChar(ch: string): string {
  if (UNICODE_TO_LATEX[ch]) return UNICODE_TO_LATEX[ch];
  if ('#$%&_{}'.includes(ch)) return `\\${ch}`;
  if (ch === '\\') return '\\backslash ';
  return ch;
}

function child(nodes: OrderedNode[], name: string): OrderedNode[] | undefined {
  const hit = nodes.find((n) => name in n);
  return hit ? hit[name] : undefined;
}

function attr(node: OrderedNode, name: string): string | undefined {
  return node[':@']?.[`@_${name}`];
}

function propChr(props: OrderedNode[] | undefined, tag: string): string | undefined {
  const holder = props?.find((n) => tag in n);
  return holder ? attr(holder, 'm:val') : undefined;
}

/** Wrap in braces only when needed so output stays readable: x_{1} -> x_1. */
function group(latex: string): string {
  const t = latex.trim();
  if (/^\\[A-Za-z]+$/.test(t)) return `${t} `; // a command needs a space after it, or the next letter would join it (\nu z -> \nuz)
  return /^[A-Za-z0-9]$/.test(t) ? t : `{${t}}`;
}

function convertRun(children: OrderedNode[]): string {
  const rPr = child(children, 'm:rPr');
  const isPlain = rPr?.some((n) => 'm:sty' in n && attr(n, 'm:val') === 'p');
  const isText = rPr?.some((n) => 'm:nor' in n);
  const raw = children
    .filter((n) => 'm:t' in n)
    .map((n) => textOf(n['m:t']))
    .join('');
  if (!raw) return '';
  if (isText) return `\\text{${raw.replace(/[{}\\]/g, '')}}`;
  if (isPlain || FUNC_NAMES.has(raw)) {
    if (/^[A-Za-z]{2,}$/.test(raw)) return FUNC_NAMES.has(raw) ? `\\${raw === 'arg' ? 'arg' : raw} ` : `\\mathrm{${raw}}`;
  }
  return Array.from(raw).map(escapeChar).join('');
}

function convertChildren(nodes: OrderedNode[] | undefined): string {
  if (!nodes) return '';
  return nodes.map(convertNode).join('');
}

function convertNode(node: OrderedNode): string {
  const tag = Object.keys(node).find((k) => k !== ':@');
  if (!tag) return '';
  const kids: OrderedNode[] = node[tag] ?? [];
  switch (tag) {
    case 'm:oMathPara':
    case 'm:oMath':
    case 'm:e':
    case 'm:num':
    case 'm:den':
    case 'm:sub':
    case 'm:sup':
    case 'm:deg':
    case 'm:lim':
    case 'm:fName':
    case 'm:box':
    case 'm:phant':
    case 'm:groupChr':
      return tag === 'm:box' || tag === 'm:phant' || tag === 'm:groupChr' ? convertChildren(child(kids, 'm:e')) : convertChildren(kids);
    case 'm:r':
      return convertRun(kids);
    case 'm:f':
      return `\\frac{${convertChildren(child(kids, 'm:num'))}}{${convertChildren(child(kids, 'm:den'))}}`;
    case 'm:sSub':
      return `${group(convertChildren(child(kids, 'm:e')))}_${group(convertChildren(child(kids, 'm:sub')))}`;
    case 'm:sSup':
      return `${group(convertChildren(child(kids, 'm:e')))}^${group(convertChildren(child(kids, 'm:sup')))}`;
    case 'm:sSubSup':
      return `${group(convertChildren(child(kids, 'm:e')))}_${group(convertChildren(child(kids, 'm:sub')))}^${group(convertChildren(child(kids, 'm:sup')))}`;
    case 'm:sPre':
      return `{}_${group(convertChildren(child(kids, 'm:sub')))}^${group(convertChildren(child(kids, 'm:sup')))}${group(convertChildren(child(kids, 'm:e')))}`;
    case 'm:rad': {
      const hide = child(kids, 'm:radPr')?.some((n) => 'm:degHide' in n && attr(n, 'm:val') !== '0');
      const deg = convertChildren(child(kids, 'm:deg')).trim();
      const body = convertChildren(child(kids, 'm:e'));
      return !hide && deg ? `\\sqrt[${deg}]{${body}}` : `\\sqrt{${body}}`;
    }
    case 'm:nary': {
      const pr = child(kids, 'm:naryPr');
      const chr = propChr(pr, 'm:chr') ?? '∫';
      const op = NARY_CHR[chr] ?? '\\int';
      const sub = convertChildren(child(kids, 'm:sub')).trim();
      const sup = convertChildren(child(kids, 'm:sup')).trim();
      const subHide = pr?.some((n) => 'm:subHide' in n && attr(n, 'm:val') !== '0');
      const supHide = pr?.some((n) => 'm:supHide' in n && attr(n, 'm:val') !== '0');
      return `${op}${sub && !subHide ? `_${group(sub)}` : ''}${sup && !supHide ? `^${group(sup)}` : ''} ${convertChildren(child(kids, 'm:e'))}`;
    }
    case 'm:d': {
      const pr = child(kids, 'm:dPr');
      const beg = propChr(pr, 'm:begChr') ?? '(';
      const end = propChr(pr, 'm:endChr') ?? ')';
      const sep = propChr(pr, 'm:sepChr') ?? '|';
      const delim = (c: string, side: 'l' | 'r') => {
        if (c === '') return '.';
        if (c === '{' || c === '}') return `\\${c}`;
        if (c === '⟨') return '\\langle ';
        if (c === '⟩') return '\\rangle ';
        if (c === '‖') return '\\|';
        return c;
      };
      const parts = kids.filter((n) => 'm:e' in n).map((n) => convertChildren(n['m:e']));
      return `\\left${delim(beg, 'l')} ${parts.join(sep === '|' ? ', ' : sep)} \\right${delim(end, 'r')}`;
    }
    case 'm:func':
      return `${convertChildren(child(kids, 'm:fName')).trim()} ${convertChildren(child(kids, 'm:e'))}`;
    case 'm:acc': {
      const chr = propChr(child(kids, 'm:accPr'), 'm:chr') ?? '^';
      return `${ACCENT[chr] ?? '\\hat'}{${convertChildren(child(kids, 'm:e'))}}`;
    }
    case 'm:bar': {
      const under = child(kids, 'm:barPr')?.some((n) => 'm:pos' in n && attr(n, 'm:val') === 'bot');
      return `${under ? '\\underline' : '\\overline'}{${convertChildren(child(kids, 'm:e'))}}`;
    }
    case 'm:limLow':
      return `${group(convertChildren(child(kids, 'm:e')))}_${group(convertChildren(child(kids, 'm:lim')))}`;
    case 'm:limUpp':
      return `${group(convertChildren(child(kids, 'm:e')))}^${group(convertChildren(child(kids, 'm:lim')))}`;
    case 'm:eqArr': {
      const rows = kids.filter((n) => 'm:e' in n).map((n) => convertChildren(n['m:e']));
      return `\\begin{aligned} ${rows.join(' \\\\ ')} \\end{aligned}`;
    }
    case 'm:m': {
      const rows = kids
        .filter((n) => 'm:mr' in n)
        .map((mr) => mr['m:mr'].filter((c: OrderedNode) => 'm:e' in c).map((c: OrderedNode) => convertChildren(c['m:e'])).join(' & '));
      return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
    }
    default:
      // Property blocks (…Pr, ctrlPr) and anything unknown produce no output of their own.
      if (tag.endsWith('Pr') || tag === 'm:ctrlPr' || tag.startsWith('w:') || tag === '#text') return '';
      return convertChildren(kids);
  }
}

/**
 * Convert an OMML fragment (the inside or the whole of <m:oMath>/<m:oMathPara>) to LaTeX.
 * Returns '' when nothing meaningful could be extracted.
 */
export function ommlToLatex(ommlXml: string): string {
  if (!ommlXml || !ommlXml.trim()) return '';
  const wrapped = /<m:oMath/.test(ommlXml) ? ommlXml : `<m:oMath>${ommlXml}</m:oMath>`;
  // The extractor may hand us a fragment without namespace declarations; fast-xml-parser does not need them.
  const tree = parser.parse(wrapped) as OrderedNode[];
  return convertChildren(tree)
    .replace(/\s+/g, ' ')
    .replace(/\s*([_^])\s*/g, '$1')
    .trim();
}
