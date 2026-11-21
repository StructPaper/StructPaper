import qrcode from 'qrcode-generator';
import { hasPublicationValue } from './publication';

/** The link a DOI points to, or null when there is no real DOI yet ("?" / blank). */
export function doiToUrl(doi: string | undefined): string | null {
  const v = (doi || '').trim();
  if (!hasPublicationValue(v)) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return /^10\.\d{4,9}\//.test(v) ? `https://doi.org/${v}` : null;
}

/**
 * A QR code drawn with plain TeX rules (no image file, no package), so it prints the same on every
 * engine (MiKTeX, TeX Live, Tectonic, the packaged app) and stays sharp at any size.
 * `sizeCm` is the full width including a one-module white margin.
 */
export function qrToLatex(text: string, sizeCm = 2.2, opts: { logo?: string } = {}): string {
  // Level H (30% recovery) so the press logo printed over the centre still scans, as on the journal's QR.
  const qr = qrcode(0, opts.logo ? 'H' : 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const m = ((sizeCm * 72.27) / 2.54 / (n + 2)).toFixed(3); // module size in pt
  const row = (r: number): string => {
    let out = '';
    let c = 0;
    while (c < n) {
      const dark = qr.isDark(r, c);
      let k = 1;
      while (c + k < n && qr.isDark(r, c + k) === dark) k++;
      const w = `${(k * Number(m)).toFixed(3)}pt`;
      out += dark ? `\\vrule width ${w} height ${m}pt depth 0pt` : `\\kern ${w}`;
      c += k;
    }
    return `\\hbox{\\kern ${m}pt ${out}\\kern ${m}pt}%`;
  };
  const rows = Array.from({ length: n }, (_, r) => row(r)).join('\n');
  const code = `\\vbox{\\kern ${m}pt%\n${rows}\n\\kern ${m}pt}`;
  if (!opts.logo) return `{\\color{black}\\offinterlineskip${code}}`;
  // Logo centred over the code on a white patch (about 26% of the width); plain code if the file is missing.
  const logoW = ((sizeCm * 72.27) / 2.54 * 0.26).toFixed(2);
  return `{\\color{black}\\offinterlineskip\\setbox0=${code}%
\\hbox{\\copy0\\kern-\\wd0\\hbox to \\wd0{\\hss\\vbox to \\ht0{\\vss\\IfFileExists{${opts.logo}}{\\setlength{\\fboxsep}{1pt}\\colorbox{white}{\\includegraphics[width=${logoW}pt]{${opts.logo}}}}{}\\vss}\\hss}}}`;
}

/** File name of the VNUHCM Press logo shipped with every compile (see LatexAssets.java / compile route). */
export const QR_LOGO_FILE = 'logo-vnuhcmpress-color.png';

/** What the title block puts above "Use your smartphone to scan this QR code…". */
export function qrBlockFor(doi: string | undefined): string {
  // With no DOI yet the code is the one printed on the VNUHCM samples (it scans to the journal's site).
  const url = doiToUrl(doi) ?? DEFAULT_QR_URL;
  // 42 pt (1.48 cm) square: the size printed on every VNUHCM sample
  return qrToLatex(url, 1.48, { logo: QR_LOGO_FILE });
}

/** What the QR code of the standard VNUHCM samples (STD, HS) encodes. */
export const DEFAULT_QR_URL = 'http://www.scienceandtechnology.com.vn/';
