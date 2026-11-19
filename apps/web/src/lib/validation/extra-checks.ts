import type { CompletePaper } from '@/types/paper';
import { resolvePublication, UNKNOWN } from '../publication';
import type { ValidationGate, ValidationIssue } from './validators';

type Issue = Omit<ValidationIssue, 'gate'>;

const words = (s?: string) => (s || '').trim().split(/\s+/).filter(Boolean).length;
const clean = (ks?: string[]) => (ks || []).map((k) => k.trim()).filter(Boolean);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOI_RE = /^(https?:\/\/(dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+$/i;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const DATE_RE = /^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{4})$/;

/** Text the journal template leaves as a fill-in prompt: "[Tiêu đề đầy đủ của bài báo]", "Full name of Author 1"… */
const PLACEHOLDER_RE =
  /\[(nội dung|tiêu đề|chèn|cột \d|giá trị|tuyên bố|đóng góp|công thức|chú thích|tên |address|insert|content|column|value|equation|full |figure caption|table title|subsection|sub-subsection|abstract text|keyword)[^\]]*\]|họ và tên tác giả \d|full name of author \d/i;

/** End-of-paper statements of the template (docs/StandardTemplate), and how each may be titled. */
const STATEMENTS: Array<{ label: string; re: RegExp }> = [
  { label: 'Xung đột lợi ích', re: /xung đột lợi ích|conflicts? of interest|competing interests?/i },
  { label: 'Đóng góp của các tác giả', re: /đóng góp của (các )?tác giả|author contributions?/i },
  { label: 'Kinh phí', re: /kinh phí|funding|tài trợ/i },
  { label: 'Tính khả dụng của dữ liệu', re: /khả dụng của dữ liệu|data availability/i },
  { label: 'Lời cảm ơn', re: /lời cảm ơn|acknowledg/i },
];

/**
 * Checks beyond the structure rules: authors and affiliations, publication fields, leftover template
 * text, tables and equations, heading levels, references, and the statements the template asks for.
 * Shared by the import gate, the export gate and the QC tab, so they can never disagree.
 */
export function extraChecks(paper: CompletePaper, _gate: ValidationGate): Issue[] {
  const out: Issue[] = [];
  const md = paper.metadata;
  const sections = paper.sections || [];
  const refs = paper.references || [];

  // ---- abstract / keywords of the second language
  const enWords = words(md.abstractEn);
  if (md.abstractEn?.trim() && (enWords < 275 || enWords > 500)) {
    out.push({ id: 'abstract_en_words', severity: 'warning', code: 'field.abstractEn.length', title: `Abstract có ${enWords} từ`, message: 'Bản tiếng Anh cũng nên dài 275–500 từ như bản tiếng Việt.', fixTab: 'abstract' });
  }
  const kwVi = clean(md.keywords).length;
  const kwEn = clean(md.keywordsEn).length;
  if (kwEn > 0 && (kwEn < 3 || kwEn > 5)) {
    out.push({ id: 'keywords_en_count', severity: 'warning', code: 'field.keywordsEn.count', title: `Có ${kwEn} từ khóa tiếng Anh`, message: 'Template quy định 3–5 từ khóa.', fixTab: 'abstract' });
  }
  if (kwVi > 0 && kwEn > 0 && kwVi !== kwEn) {
    out.push({ id: 'keywords_mismatch', severity: 'info', code: 'field.keywords.mismatch', title: 'Số từ khóa hai ngôn ngữ khác nhau', message: `Tiếng Việt ${kwVi} từ khóa, tiếng Anh ${kwEn}.`, suggestion: 'Hai bản nên là cùng một danh sách từ khóa.', fixTab: 'abstract' });
  }

  // ---- article type
  if (!(md.articleType || '').trim()) {
    out.push({ id: 'article_type', severity: 'warning', code: 'field.articleType.empty', title: 'Chưa chọn loại bài báo', message: 'Loại bài báo được in ở đầu trang và trong tệp XML.', fixTab: 'metadata' });
  }

  // ---- authors and affiliations
  const authors = md.authors || [];
  const affs = md.affiliations || [];
  const affIds = new Set(affs.map((a) => a.id));
  const names = authors.map((a) => (a.name || '').trim());
  if (authors.some((_, i) => !names[i])) {
    out.push({ id: 'author_name', severity: 'error', code: 'author.name.empty', title: 'Có tác giả chưa nhập tên', message: 'Mỗi tác giả cần có họ tên.', fixTab: 'authors' });
  }
  const dupes = names.filter((n, i) => n && names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i);
  if (dupes.length) {
    out.push({ id: 'author_dupe', severity: 'warning', code: 'author.duplicate', title: 'Tác giả bị lặp', message: `Trùng: ${[...new Set(dupes)].join(', ')}.`, fixTab: 'authors' });
  }
  if (affs.length > 0) {
    const noAff = authors.filter((a) => !(a.affiliationIds || []).length).map((a) => a.name || '(chưa tên)');
    if (noAff.length) {
      out.push({ id: 'author_no_aff', severity: 'warning', code: 'author.affiliation.missing', title: `${noAff.length} tác giả chưa gán cơ quan`, message: noAff.slice(0, 4).join(', ') + (noAff.length > 4 ? ', …' : '.'), fixTab: 'authors' });
    }
    const unknown = authors.filter((a) => (a.affiliationIds || []).some((id) => !affIds.has(id)));
    if (unknown.length) {
      out.push({ id: 'author_bad_aff', severity: 'error', code: 'author.affiliation.unknown', title: 'Tác giả gán cơ quan không tồn tại', message: unknown.map((a) => a.name).slice(0, 4).join(', ') + '.', suggestion: 'Chọn lại cơ quan trong thẻ Tác giả.', fixTab: 'authors' });
    }
    const used = new Set(authors.flatMap((a) => a.affiliationIds || []));
    const unused = affs.filter((a) => !used.has(a.id));
    if (unused.length && authors.length > 0) {
      out.push({ id: 'aff_unused', severity: 'warning', code: 'affiliation.unused', title: `${unused.length} cơ quan chưa có tác giả nào`, message: 'Cơ quan không gán cho ai sẽ in thừa hoặc đánh số sai.', fixTab: 'authors' });
    }
  }
  const email = (md.corresponding?.email || authors.find((a) => a.isCorresponding)?.email || '').trim();
  if (email && !EMAIL_RE.test(email)) {
    out.push({ id: 'corr_email', severity: 'error', code: 'field.email.format', title: 'Email tác giả liên hệ sai định dạng', message: `"${email}" không phải địa chỉ email.`, fixTab: 'authors' });
  }

  // ---- publication data
  const pub = resolvePublication(md);
  if (pub.doi && pub.doi !== UNKNOWN && !DOI_RE.test(pub.doi.trim())) {
    out.push({ id: 'doi_format', severity: 'warning', code: 'field.doi.format', title: 'DOI sai định dạng', message: `"${pub.doi}" phải có dạng 10.xxxx/…`, fixTab: 'metadata' });
  }
  const first = Number(pub.firstPage);
  const last = Number(pub.lastPage);
  if (Number.isFinite(first) && Number.isFinite(last) && pub.firstPage !== UNKNOWN && pub.lastPage !== UNKNOWN && pub.firstPage && pub.lastPage && first > last) {
    out.push({ id: 'pages_order', severity: 'warning', code: 'field.publication.pages', title: 'Trang đầu lớn hơn trang cuối', message: `${pub.firstPage} > ${pub.lastPage}.`, fixTab: 'metadata' });
  }
  for (const [label, value] of [['Tập', pub.volume], ['Số', pub.issue]] as const) {
    if (value && value !== UNKNOWN && !/^\d+$/.test(value.trim())) {
      out.push({ id: `pub_${label}`, severity: 'info', code: 'field.publication.number', title: `${label} không phải số`, message: `"${value}"`, fixTab: 'metadata' });
    }
  }

  // ---- dates in the future
  const today = Date.now();
  (['received', 'revised', 'accepted'] as const).forEach((k) => {
    const m = (md.dates?.[k] || '').trim().match(DATE_RE);
    if (m && Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) > today) {
      out.push({ id: `date_future_${k}`, severity: 'warning', code: 'field.date.future', title: 'Có ngày ở tương lai', message: `Ngày ${k === 'received' ? 'nhận' : k === 'revised' ? 'sửa' : 'chấp nhận'}: ${md.dates[k]}.`, fixTab: 'metadata' });
    }
  });

  // ---- text left over from the template
  const leftovers: string[] = [];
  [md.title, md.titleEn, md.abstract, md.abstractEn].forEach((t) => PLACEHOLDER_RE.test(t || '') && leftovers.push((t || '').slice(0, 40)));
  sections.forEach((s) => {
    const text = `${s.title || ''} ${s.content || ''} ${(s as any).figure?.caption || ''} ${(s as any).table?.caption || ''}`;
    if (PLACEHOLDER_RE.test(text)) leftovers.push((s.title || s.content || '').slice(0, 40));
  });
  if (leftovers.length) {
    out.push({ id: 'placeholder', severity: 'warning', code: 'content.placeholder', title: `${leftovers.length} chỗ còn chữ mẫu của template`, message: `Ví dụ: "${leftovers[0]}…"`, suggestion: 'Thay bằng nội dung thật hoặc xóa.', fixTab: 'sections' });
  }

  // ---- tables, figures, equations, headings
  sections.forEach((s, idx) => {
    if (s.type === 'table' && s.table) {
      const cols = s.table.headers?.length ?? 0;
      const ragged = (s.table.rows || []).filter((r) => cols > 0 && r.length !== cols).length;
      if (ragged > 0 && !(s.table.grid || s.table.bodyRows)) {
        out.push({ id: `table_ragged_${idx}`, severity: 'error', code: 'table.ragged', title: `Bảng ${s.table.num ?? idx + 1} có hàng lệch cột`, message: `${ragged} hàng không đủ ${cols} cột.`, fixTab: 'sections' });
      }
    }
    if (s.type === 'figure' && s.figure && !(s.figure.src || s.figure.assetId)) {
      out.push({ id: `fig_no_image_${idx}`, severity: 'error', code: 'figure.image.missing', title: `Hình ${s.figure.num ?? idx + 1} chưa có ảnh`, message: 'Chưa tải ảnh lên cho hình này.', fixTab: 'sections' });
    }
    if (s.type === 'equation' && !(s.equation?.latex || '').trim()) {
      out.push({ id: `eq_empty_${idx}`, severity: 'error', code: 'equation.empty', title: 'Có công thức để trống', message: 'Nhập công thức hoặc xóa khối này.', fixTab: 'sections' });
    }
  });
  const levels = sections.filter((s) => /^h[1-3]$/.test(s.type)).map((s) => Number(s.type.slice(1)));
  const skipped = levels.filter((lv, i) => i > 0 && lv - levels[i - 1] > 1).length;
  if (skipped > 0) {
    out.push({ id: 'heading_levels', severity: 'warning', code: 'structure.heading.level', title: `${skipped} tiêu đề nhảy cấp`, message: 'Ví dụ từ mục cấp 1 xuống thẳng cấp 3.', suggestion: 'Thêm mục cấp 2 ở giữa hoặc hạ cấp tiêu đề.', fixTab: 'sections' });
  }

  // ---- statements the template asks for after the conclusion
  const titles = sections.filter((s) => /^h[1-3]$/.test(s.type) || s.type === 'paragraph').map((s) => `${s.title || ''}`).join('\n');
  const headingText = sections.map((s) => s.title || '').join('\n') + '\n' + titles;
  const missing = STATEMENTS.filter((st) => !st.re.test(headingText)).map((st) => st.label);
  if (sections.length > 3 && missing.length > 0) {
    out.push({ id: 'statements', severity: 'info', code: 'structure.statements', title: `Thiếu ${missing.length} mục cuối bài theo template`, message: missing.join(', ') + '.', suggestion: 'Ghi rõ "Không có" nếu không áp dụng.', fixTab: 'sections' });
  }

  // ---- references
  const raw = refs.map((r) => (r.raw || '').trim());
  const short = raw.filter((r) => r.length > 0 && r.length < 25).length;
  if (short) {
    out.push({ id: 'refs_short', severity: 'warning', code: 'reference.short', title: `${short} tài liệu tham khảo quá ngắn`, message: 'Thiếu tác giả, tên, năm hoặc nguồn.', fixTab: 'refs' });
  }
  const noYear = raw.filter((r) => r.length >= 25 && !YEAR_RE.test(r)).length;
  if (noYear) {
    out.push({ id: 'refs_no_year', severity: 'warning', code: 'reference.noyear', title: `${noYear} tài liệu tham khảo không có năm`, message: 'Kiểu Vancouver cần năm xuất bản.', fixTab: 'refs' });
  }
  const norm = raw.map((r) => r.toLowerCase().replace(/\s+/g, ' '));
  const dupRefs = norm.filter((r, i) => r.length > 0 && norm.indexOf(r) !== i).length;
  if (dupRefs) {
    out.push({ id: 'refs_dupe', severity: 'warning', code: 'reference.duplicate', title: `${dupRefs} tài liệu tham khảo bị lặp`, message: 'Hai mục giống hệt nhau.', fixTab: 'refs' });
  }

  return out;
}
