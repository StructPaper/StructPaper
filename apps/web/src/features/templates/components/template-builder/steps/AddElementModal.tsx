'use client';

import React, { useState, useMemo } from 'react';
import { ElementType, LayoutZoneConfig } from '@/types/template-builder';
import {
  X,
  Search,
  Sparkles,
  Plus,
  Type,
  Users,
  Building2,
  Grid,
  BoxSelect,
  Tag,
  Heading,
  Baseline,
  Image,
  Table,
  Sigma,
  Code2,
  Link2,
  UserCheck,
  BookOpen,
  ListOrdered,
  ShieldAlert,
  Award,
  BookmarkCheck,
  BadgeAlert,
  HeartHandshake,
  Minus,
  FileQuestion,
  Layers,
  Check,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';

export type ElementCategoryTab =
  | 'all'
  | 'frontmatter'
  | 'body'
  | 'floats'
  | 'backmatter'
  | 'custom';

export interface AcademicElementMeta {
  type: ElementType;
  label: string;
  englishName: string;
  category: ElementCategoryTab;
  categoryLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  columnSpan: 'all' | 'single';
  badgeType: 'essential' | 'standard' | 'optional';
  specimenType: string;
}

export const ACADEMIC_ELEMENT_METAS: AcademicElementMeta[] = [
  // --- FRONTMATTER (Trang bìa & Đầu bài) ---
  {
    type: 'article-header-badge',
    label: 'Thẻ Đầu Trang & Loại Bài Báo',
    englishName: 'Header Badge & Article Type',
    category: 'frontmatter',
    categoryLabel: 'Trang bìa',
    icon: BadgeAlert,
    description: 'Biểu tượng Open Access Full Text Article và phân loại bài báo (Bài tổng quan, Nghiên cứu gốc).',
    columnSpan: 'all',
    badgeType: 'essential',
    specimenType: 'header-badge',
  },
  {
    type: 'article-title',
    label: 'Tiêu Đề Bài Báo Khoa Học',
    englishName: 'Article Title (Main & English)',
    category: 'frontmatter',
    categoryLabel: 'Trang bìa',
    icon: Type,
    description: 'Tiêu đề chính cỡ lớn chuẩn Serif/Sans kèm phụ đề song ngữ tiếng Anh cho cơ sở dữ liệu quốc tế.',
    columnSpan: 'all',
    badgeType: 'essential',
    specimenType: 'title',
  },
  {
    type: 'author-block',
    label: 'Khối Tác Giả & Ký Hiệu Mũ',
    englishName: 'Author List & Affiliation Superscripts',
    category: 'frontmatter',
    categoryLabel: 'Trang bìa',
    icon: Users,
    description: 'Họ tên các tác giả với số mũ đơn vị công tác và ký hiệu tác giả liên hệ (*).',
    columnSpan: 'all',
    badgeType: 'essential',
    specimenType: 'authors',
  },
  {
    type: 'affiliation-list',
    label: 'Danh Sách Đơn Vị Công Tác',
    englishName: 'Author Affiliations & Institutions',
    category: 'frontmatter',
    categoryLabel: 'Trang bìa',
    icon: Building2,
    description: 'Khoa phòng, trường viện, đại học công tác in nghiêng tinh tế chuẩn VNUHCM.',
    columnSpan: 'all',
    badgeType: 'essential',
    specimenType: 'affiliations',
  },
  {
    type: 'citation-strip',
    label: 'Dải Trích Dẫn Chân Trang Bìa',
    englishName: 'Citation Strip (How to Cite)',
    category: 'frontmatter',
    categoryLabel: 'Trang bìa',
    icon: BookmarkCheck,
    description: 'Dải nền xanh nhạt đặc trưng (#DBEAFE) hướng dẫn độc giả cách trích dẫn bài báo chính xác.',
    columnSpan: 'all',
    badgeType: 'essential',
    specimenType: 'citation-strip',
  },
  {
    type: 'metadata-grid',
    label: 'Lịch Sử Nộp Bài, DOI & QR Code',
    englishName: 'Timeline Metadata, DOI & Open Access',
    category: 'frontmatter',
    categoryLabel: 'Trang bìa',
    icon: Grid,
    description: 'Cột bên chuẩn học thuật: Ngày nhận, Ngày duyệt, Ngày đăng, mã DOI, giấy phép CC-BY-4.0.',
    columnSpan: 'single',
    badgeType: 'essential',
    specimenType: 'metadata-grid',
  },
  {
    type: 'abstract-box',
    label: 'Khung Tóm Tắt (Abstract)',
    englishName: 'Structured Abstract Box',
    category: 'frontmatter',
    categoryLabel: 'Trang bìa',
    icon: BoxSelect,
    description: 'Khối tóm tắt có viền màu học thuật hoặc nền màu xám/xanh nhẹ, căn lề 2 bên đều đặn.',
    columnSpan: 'all',
    badgeType: 'essential',
    specimenType: 'abstract',
  },
  {
    type: 'keywords-group',
    label: 'Từ Khoá Nghiên Cứu',
    englishName: 'Keywords (MeSH / Academic Indexing)',
    category: 'frontmatter',
    categoryLabel: 'Trang bìa',
    icon: Tag,
    description: 'Nhóm từ khoá học thuật phân tách bằng dấu chấm phẩy hoặc hiển thị dạng thẻ tag chuyên nghiệp.',
    columnSpan: 'all',
    badgeType: 'essential',
    specimenType: 'keywords',
  },

  // --- BODY & SECTIONS (Thân bài & Bố cục) ---
  {
    type: 'heading',
    label: 'Tiêu Đề Mục (Heading I, II, III)',
    englishName: 'Section Headings (H1, H2, H3)',
    category: 'body',
    categoryLabel: 'Thân bài',
    icon: Heading,
    description: 'Hệ thống phân cấp tiêu đề số La Mã (I, II) hoặc số thập phân (1.1, 1.2) chữ in hoa đậm.',
    columnSpan: 'single',
    badgeType: 'standard',
    specimenType: 'heading',
  },
  {
    type: 'body-text',
    label: 'Đoạn Văn Thân Bài (Paragraph)',
    englishName: 'Body Paragraph & Drop Cap',
    category: 'body',
    categoryLabel: 'Thân bài',
    icon: Baseline,
    description: 'Đoạn văn nội dung học thuật căn đều 2 bên (Justify), hỗ trợ thụt lề đầu dòng và chữ to đầu tiên (Drop Cap).',
    columnSpan: 'single',
    badgeType: 'standard',
    specimenType: 'body-text',
  },
  {
    type: 'callout-box',
    label: 'Hộp Điểm Nhấn (Highlights / Box)',
    englishName: 'Key Findings & Highlights Callout',
    category: 'body',
    categoryLabel: 'Thân bài',
    icon: Sparkles,
    description: 'Khung đóng viền màu hổ phách/xanh ghi nhận kết quả then chốt hoặc lưu ý của ban biên tập.',
    columnSpan: 'single',
    badgeType: 'optional',
    specimenType: 'callout',
  },

  // --- FLOATS & DATA (Minh hoạ & Khoa học) ---
  {
    type: 'figure-box',
    label: 'Khung Hình Ảnh & Đồ Thị (Figure)',
    englishName: 'Figure & Scientific Caption',
    category: 'floats',
    categoryLabel: 'Minh hoạ',
    icon: Image,
    description: 'Khung hiển thị hình vẽ, sơ đồ vector, hình phụ (a, b) kèm chú thích tiền tố Hình 1 in đậm nghiêng.',
    columnSpan: 'single',
    badgeType: 'standard',
    specimenType: 'figure',
  },
  {
    type: 'table-box',
    label: 'Bảng Biểu Chuẩn Booktabs (Table)',
    englishName: 'Booktabs Scientific Table',
    category: 'floats',
    categoryLabel: 'Minh hoạ',
    icon: Table,
    description: 'Chuẩn bảng xuất bản quốc tế 3 đường kẻ ngang (top-rule, mid-rule, bottom-rule) và chú thích trên đầu bảng.',
    columnSpan: 'single',
    badgeType: 'standard',
    specimenType: 'table',
  },
  {
    type: 'equation-box',
    label: 'Công Thức Toán Học (Equation)',
    englishName: 'Numbered Math Equation',
    category: 'floats',
    categoryLabel: 'Minh hoạ',
    icon: Sigma,
    description: 'Công thức toán căn giữa chuẩn LaTeX với số thứ tự đánh bên phải (1), (2).',
    columnSpan: 'single',
    badgeType: 'standard',
    specimenType: 'equation',
  },
  {
    type: 'code-algorithm',
    label: 'Thuật Toán & Mã Nguồn (Algorithm)',
    englishName: 'Algorithm Pseudocode & Source Code',
    category: 'floats',
    categoryLabel: 'Minh hoạ',
    icon: Code2,
    description: 'Khối mã giả thuật toán hoặc mã nguồn có đánh số dòng và 3 đường kẻ chuẩn xuất bản.',
    columnSpan: 'single',
    badgeType: 'optional',
    specimenType: 'algorithm',
  },

  // --- BACKMATTER & DISCLOSURES (Hậu thân & Đạo đức) ---
  {
    type: 'abbreviations-list',
    label: 'Danh Mục Từ Viết Tắt (Abbreviations)',
    englishName: 'List of Academic Abbreviations',
    category: 'backmatter',
    categoryLabel: 'Hậu thân',
    icon: ListOrdered,
    description: 'Bảng tra cứu thuật ngữ viết tắt trong y sinh/kỹ thuật theo dạng lưới 2 cột sắc nét (ASA, PPI, COX-1...).',
    columnSpan: 'single',
    badgeType: 'essential',
    specimenType: 'abbreviations',
  },
  {
    type: 'conflict-of-interest',
    label: 'Tuyên Bố Xung Đột Lợi Ích',
    englishName: 'Conflict of Interest Statement',
    category: 'backmatter',
    categoryLabel: 'Hậu thân',
    icon: ShieldAlert,
    description: 'Tuyên bố đạo đức xuất bản theo quy chuẩn quốc tế về xung đột lợi ích và quyền lợi của nhóm tác giả.',
    columnSpan: 'single',
    badgeType: 'essential',
    specimenType: 'conflict',
  },
  {
    type: 'author-contribution',
    label: 'Đóng Góp Của Các Tác Giả (CRediT)',
    englishName: 'Authors’ Contributions (CRediT Taxonomy)',
    category: 'backmatter',
    categoryLabel: 'Hậu thân',
    icon: Award,
    description: 'Phân định chi tiết vai trò của từng tác giả (lên ý tưởng, thu thập dữ liệu, viết bản thảo) chuẩn CRediT.',
    columnSpan: 'single',
    badgeType: 'essential',
    specimenType: 'author-contribution',
  },
  {
    type: 'acknowledgement-box',
    label: 'Lời Cảm Ơn & Nguồn Tài Trợ',
    englishName: 'Acknowledgements & Funding Grants',
    category: 'backmatter',
    categoryLabel: 'Hậu thân',
    icon: HeartHandshake,
    description: 'Ghi nhận đóng góp của phòng thí nghiệm và công bố mã số đề tài tài trợ từ quỹ nghiên cứu ĐHQG.',
    columnSpan: 'single',
    badgeType: 'essential',
    specimenType: 'acknowledgement',
  },
  {
    type: 'references-block',
    label: 'Tài Liệu Tham Khảo (Vancouver/IEEE)',
    englishName: 'References & Citation Bibliography',
    category: 'backmatter',
    categoryLabel: 'Hậu thân',
    icon: BookOpen,
    description: 'Danh mục tài liệu trích dẫn chuẩn Vancouver [1], IEEE hoặc APA 7th kèm liên kết số DOI.',
    columnSpan: 'single',
    badgeType: 'essential',
    specimenType: 'references',
  },
  {
    type: 'biography-box',
    label: 'Tiểu Sử Tác Giả & Ảnh Chân Dung',
    englishName: 'Author Biography & Portrait',
    category: 'backmatter',
    categoryLabel: 'Hậu thân',
    icon: UserCheck,
    description: 'Khung tóm tắt học hàm, học vị, hướng nghiên cứu và ảnh chân dung tác giả cuối bài viết.',
    columnSpan: 'single',
    badgeType: 'optional',
    specimenType: 'biography',
  },

  // --- CUSTOM & UTILITIES (Tùy biến & Bổ trợ) ---
  {
    type: 'link-box',
    label: 'Liên Kết DOI, Repository & QR Code',
    englishName: 'Interactive Link & Print QR Code',
    category: 'custom',
    categoryLabel: 'Tùy biến',
    icon: Link2,
    description: 'Thẻ liên kết ra trang lưu trữ GitHub, Zenodo kèm mã QR độ phân giải cao cho bản in ấn.',
    columnSpan: 'single',
    badgeType: 'optional',
    specimenType: 'link-box',
  },
  {
    type: 'divider-line',
    label: 'Đường Kẻ Phân Cách Trang Trí',
    englishName: 'Decorative Academic Rule / Divider',
    category: 'custom',
    categoryLabel: 'Tùy biến',
    icon: Minus,
    description: 'Đường kẻ mảnh (hairline), đường kẻ kép hoặc đường nét đứt phân tách các phân đoạn chuyên biệt.',
    columnSpan: 'all',
    badgeType: 'optional',
    specimenType: 'divider',
  },
  {
    type: 'custom-field',
    label: 'Trường Dữ Liệu Tự Do (Custom Field)',
    englishName: 'Custom Defined Academic Field',
    category: 'custom',
    categoryLabel: 'Tùy biến',
    icon: FileQuestion,
    description: 'Bất kỳ trường thông tin chuyên biệt nào bạn muốn đặt tên và thiết lập nội dung tự do.',
    columnSpan: 'single',
    badgeType: 'optional',
    specimenType: 'custom-field',
  },
];

interface AddElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddElement: (type: ElementType) => void;
  targetZoneId: string;
  onTargetZoneChange: (zoneId: string) => void;
  zones: LayoutZoneConfig[];
}

export const AddElementModal: React.FC<AddElementModalProps> = ({
  isOpen,
  onClose,
  onAddElement,
  targetZoneId,
  onTargetZoneChange,
  zones,
}) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ElementCategoryTab>('all');

  const filteredElements = useMemo(() => {
    return ACADEMIC_ELEMENT_METAS.filter((el) => {
      const matchesTab = activeTab === 'all' || el.category === activeTab;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        el.label.toLowerCase().includes(q) ||
        el.englishName.toLowerCase().includes(q) ||
        el.description.toLowerCase().includes(q) ||
        el.type.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [activeTab, search]);

  if (!isOpen) return null;

  const currentZone = zones.find((z) => z.id === targetZoneId);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-[#F8FAFC] rounded-[28px] max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* --- MODAL HEADER (VNUHCM Health Sciences Identity) --- */}
        <div className="px-6 py-4 bg-[#0F284E] text-white flex items-center justify-between shadow-xs flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-2xs">
              <Sparkles className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                  Kho Phần Tử Khoa Học Chuẩn Mực
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  VNUHCM Demo Spec
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Lựa chọn khối thành phần theo đúng cấu trúc bài báo khoa học xuất bản thực tế
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* --- TARGET ZONE SELECTOR & SEARCH BAR --- */}
        <div className="p-4 bg-white border-b border-slate-200 space-y-3 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Zone Picker */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700 shrink-0">
                Thêm vào phân vùng:
              </span>
              <div className="flex-1 max-w-sm">
                <Select
                  value={targetZoneId}
                  onChange={(val) => onTargetZoneChange(val)}
                  variant="clean"
                  size="sm"
                  options={[
                    {
                      value: '',
                      label: '⚡ Chưa gán phân vùng (Lưu trữ / Chờ bố cục sau)',
                      description: 'Khối tự do, có thể xếp vào bất kỳ phân vùng nào sau này',
                    },
                    ...zones.map((z) => ({
                      value: z.id,
                      label: `${z.name} (${z.type})`,
                    })),
                  ]}
                />
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm phần tử (tên, từ khóa)..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B74B7]/40 focus:border-[#2B74B7] transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Academic Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: 'all', label: 'Tất cả phần tử', count: ACADEMIC_ELEMENT_METAS.length },
              { id: 'frontmatter', label: '🏛️ Trang bìa & Đầu bài', count: 8 },
              { id: 'body', label: '📖 Thân bài & Bố cục', count: 3 },
              { id: 'floats', label: '🔬 Minh họa & Bảng biểu', count: 4 },
              { id: 'backmatter', label: '📜 Hậu thân & Đạo đức', count: 6 },
              { id: 'custom', label: '⚙️ Tùy biến & Bổ trợ', count: 3 },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-category-tab={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as ElementCategoryTab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#2B74B7] text-white border-[#2B74B7] shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- ELEMENTS GRID (VNUHCM Health Sciences Specimen Cards) --- */}
        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {filteredElements.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Không tìm thấy thành phần nào phù hợp với &quot;{search}&quot;. Thử từ khoá khác!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredElements.map((meta) => {
                const Icon = meta.icon;
                return (
                  <div
                    key={meta.type}
                    className="group bg-white rounded-2xl border border-slate-200/90 hover:border-[#2B74B7] hover:shadow-md transition-all p-3.5 flex flex-col justify-between space-y-3 relative overflow-hidden"
                  >
                    {/* Top Header */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#E7ECF7] text-[#2B74B7] group-hover:bg-[#2B74B7] group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#2B74B7] truncate transition-colors">
                              {meta.label}
                            </h4>
                            <div className="text-[10px] text-slate-500 font-serif italic truncate">
                              {meta.englishName}
                            </div>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              meta.columnSpan === 'all'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {meta.columnSpan === 'all' ? 'Tràn 2 cột' : '1 cột'}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                        {meta.description}
                      </p>
                    </div>

                    {/* --- MINI ACADEMIC SPECIMEN PREVIEW --- */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 overflow-hidden text-left font-sans text-[7.5pt] select-none">
                      <AcademicSpecimenPreview type={meta.type} />
                    </div>

                    {/* Bottom Action Button */}
                    <button
                      type="button"
                      data-add-type={meta.type}
                      onClick={() => onAddElement(meta.type)}
                      className="w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-[#2B74B7] text-slate-700 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs group-hover:bg-[#2B74B7] group-hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        Thêm vào {currentZone ? `"${currentZone.name}"` : 'phân vùng'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- MODAL FOOTER --- */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0">
          <span>
            Khối được thêm sẽ tự động cập nhật ngay trên bản A4 Live Preview và Typst Engine.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * High-fidelity academic specimen previews simulating the exact look of the demo template
 */
const AcademicSpecimenPreview: React.FC<{ type: ElementType }> = ({ type }) => {
  switch (type) {
    case 'article-header-badge':
      return (
        <div className="flex items-center justify-between border-b border-slate-300 pb-1">
          <div className="flex items-center gap-1 text-[7pt] text-slate-600 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E65100] text-white flex items-center justify-center text-[5.5pt] font-black">
              🔓
            </span>
            <span>Open Access Full Text Article</span>
          </div>
          <span className="text-[7.5pt] font-serif font-bold italic underline text-[#2B74B7]">
            Bài tổng quan
          </span>
        </div>
      );

    case 'article-title':
      return (
        <div className="space-y-0.5 font-serif">
          <div className="font-bold text-[8.5pt] leading-tight text-[#0F284E]">
            Tổng quan về loét dạ dày tá tràng ở người cao tuổi và cập nhật trong điều trị
          </div>
          <div className="text-[7pt] text-slate-500 italic">
            Overview of peptic ulcer disease in the elderly and treatment updates
          </div>
        </div>
      );

    case 'author-block':
      return (
        <div className="font-sans text-[7.5pt] font-bold text-slate-900 leading-tight">
          Hà Vũ<sup className="text-slate-500 font-bold">*</sup>, Viên Vinh Phú
          <sup className="text-slate-500 font-bold">1</sup>
        </div>
      );

    case 'affiliation-list':
      return (
        <div className="font-serif italic text-[7pt] text-slate-600 leading-tight">
          Bộ môn Nội - Khoa Y – Trường Đại học Khoa học Sức khỏe - Đại học Quốc Gia TP.HCM
        </div>
      );

    case 'citation-strip':
      return (
        <div className="p-1 rounded bg-[#DBEAFE] border border-blue-200 text-[6.8pt] leading-tight text-slate-900">
          <span className="font-bold text-[#1E3A8A]">Trích dẫn bài báo này :</span> Vũ H, Phú V
          V. Sci. Tech. Dev. J. - Health Sci. 2026; 7(2):804-816.
        </div>
      );

    case 'metadata-grid':
      return (
        <div className="space-y-1 text-[6.8pt] font-sans">
          <div className="font-bold text-[#2B74B7]">Lịch sử nộp bài</div>
          <div className="text-slate-600">
            • Ngày nhận: 14-06-2025 • Ngày duyệt: 10-02-2026
          </div>
          <div className="font-mono text-slate-800 font-bold">
            DOI: 10.32508/vnuhcmj-hs.v7i1.630
          </div>
        </div>
      );

    case 'abstract-box':
      return (
        <div className="border-l-2 border-[#2B74B7] pl-1.5 space-y-0.5">
          <span className="font-bold text-[7.5pt] text-[#2B74B7]">TÓM TẮT: </span>
          <span className="text-[6.8pt] text-slate-700 leading-snug line-clamp-2">
            Bệnh loét dạ dày tá tràng hiện nay là một thách thức y tế lớn đối với người cao tuổi
            (từ 65 tuổi trở lên). Hai yếu tố gây bệnh hàng đầu là nhiễm Helicobacter pylori...
          </span>
        </div>
      );

    case 'keywords-group':
      return (
        <div className="flex items-center gap-1 flex-wrap text-[6.8pt]">
          <span className="font-bold text-[#2B74B7]">Từ khoá:</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-medium">
            Loét dạ dày tá tràng
          </span>
          <span className="px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-medium">
            H. pylori
          </span>
          <span className="px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-medium">
            PPI
          </span>
        </div>
      );

    case 'heading':
      return (
        <div className="font-sans font-bold text-[7.8pt] uppercase text-[#0F284E] tracking-tight">
          I. GIỚI THIỆU VỀ BỆNH LOÉT DẠ DÀY TÁ TRÀNG:
        </div>
      );

    case 'body-text':
      return (
        <div className="font-serif text-[7pt] text-slate-700 leading-snug line-clamp-2 text-justify">
          <span className="float-left text-base font-bold leading-none pr-1 text-[#2B74B7]">
            L
          </span>
          oét dạ dày tá tràng là tình trạng tổn thương niêm mạc qua lớp cơ niêm, thường xảy ra
          ở vùng môn vị hoặc tá tràng dưới tác động của acid dạ dày và pepsin...
        </div>
      );

    case 'callout-box':
      return (
        <div className="p-1 rounded bg-amber-50/80 border-l-2 border-amber-500 text-[6.8pt] leading-tight">
          <span className="font-bold text-amber-800">⚡ Điểm nhấn: </span>
          <span className="text-amber-900">
            Nội soi tiêu hóa trên kèm sinh thiết theo hệ thống Sydney cải tiến là tiêu chuẩn vàng.
          </span>
        </div>
      );

    case 'figure-box':
      return (
        <div className="p-1 rounded bg-slate-100 border border-slate-200 text-center space-y-0.5">
          <div className="h-6 bg-slate-200 rounded flex items-center justify-center text-[6pt] text-slate-500 font-mono">
            [Vector Graph / Image Plot]
          </div>
          <div className="text-[6.5pt] text-slate-700 text-left">
            <span className="font-bold text-[#2B74B7]">Hình 1:</span> Sơ đồ cơ chế sinh bệnh
            loét dạ dày ở người cao tuổi.
          </div>
        </div>
      );

    case 'table-box':
      return (
        <div className="space-y-0.5 text-[6.5pt] font-serif">
          <div className="font-bold text-[#2B74B7]">
            Bảng 1: Phác đồ tiệt trừ H. pylori khuyến nghị
          </div>
          <div className="border-t border-b border-slate-800 py-0.5 grid grid-cols-3 font-bold text-[6.2pt]">
            <span>Phác đồ</span>
            <span className="text-center">Thời gian</span>
            <span className="text-right">Tỷ lệ khỏi</span>
          </div>
          <div className="grid grid-cols-3 text-[6pt] text-slate-600 border-b border-slate-800 pb-0.5">
            <span>Bismuth 4 thuốc</span>
            <span className="text-center">14 ngày</span>
            <span className="text-right font-mono font-bold">92.4%</span>
          </div>
        </div>
      );

    case 'equation-box':
      return (
        <div className="flex items-center justify-between font-serif text-[7pt] italic text-slate-800 py-0.5 px-2 bg-slate-100/60 rounded">
          <span className="mx-auto">
            H<sub className="not-italic">score</sub> = &alpha;&middot;HpSA + &beta;&middot;NSAID &minus; &gamma;&middot;Age
          </span>
          <span className="font-sans font-bold text-slate-500 text-[6.5pt]">(1)</span>
        </div>
      );

    case 'code-algorithm':
      return (
        <div className="font-mono text-[6pt] bg-slate-900 text-emerald-400 p-1.5 rounded space-y-0.5">
          <div className="text-slate-400 font-bold">Thuật toán 1: Phân tầng nguy cơ xuất huyết</div>
          <div>1: input: patient_age, nsaid_history</div>
          <div>2: if patient_age &gt;= 65 then add_ppi_co_therapy()</div>
        </div>
      );

    case 'abbreviations-list':
      return (
        <div className="space-y-0.5">
          <div className="font-bold text-[7pt] text-[#2B74B7] uppercase">
            DANH MỤC CÁC TỪ VIẾT TẮT
          </div>
          <div className="grid grid-cols-2 gap-x-2 text-[6.2pt] leading-tight text-slate-700">
            <div>
              <span className="font-bold text-[#2B74B7]">ASA:</span> Acetylsalicylic acid
            </div>
            <div>
              <span className="font-bold text-[#2B74B7]">PPI:</span> Proton pump inhibitor
            </div>
            <div>
              <span className="font-bold text-[#2B74B7]">ICU:</span> Intensive Care Unit
            </div>
            <div>
              <span className="font-bold text-[#2B74B7]">COX-1:</span> Cyclooxygenase-1
            </div>
          </div>
        </div>
      );

    case 'conflict-of-interest':
      return (
        <div className="space-y-0.5">
          <div className="font-bold text-[7pt] text-[#2B74B7] uppercase">
            XUNG ĐỘT LỢI ÍCH
          </div>
          <div className="text-[6.5pt] text-slate-600 leading-tight">
            Tác giả cam kết không có mâu thuẫn quyền lợi và không có xung đột lợi ích liên quan đến
            bài nghiên cứu này.
          </div>
        </div>
      );

    case 'author-contribution':
      return (
        <div className="space-y-0.5">
          <div className="font-bold text-[7pt] text-[#2B74B7] uppercase">
            ĐÓNG GÓP CỦA CÁC TÁC GIẢ
          </div>
          <div className="text-[6.5pt] text-slate-600 leading-tight">
            <span className="font-bold">Hà Vũ:</span> lên ý tưởng, viết bản thảo;{' '}
            <span className="font-bold">Viên Vinh Phú:</span> chỉnh sửa bài báo.
          </div>
        </div>
      );

    case 'acknowledgement-box':
      return (
        <div className="space-y-0.5 p-1 bg-slate-100 rounded border border-slate-200">
          <div className="font-bold text-[7pt] text-[#2B74B7] uppercase">
            LỜI CẢM ƠN & NGUỒN TÀI TRỢ
          </div>
          <div className="text-[6.5pt] text-slate-600 leading-tight">
            Được tài trợ bởi ĐHQG-HCM trong khuôn khổ Đề tài mã số VNUHCM-2025-MED-01.
          </div>
        </div>
      );

    case 'references-block':
      return (
        <div className="space-y-0.5">
          <div className="font-bold text-[7pt] text-[#2B74B7] uppercase">
            TÀI LIỆU THAM KHẢO
          </div>
          <div className="text-[6.2pt] text-slate-700 leading-tight">
            <span className="font-bold text-[#2B74B7]">1. </span> Vũ H, Phú V V. Tổng quan về
            loét dạ dày tá tràng. <em>Sci. Tech. Dev. J.</em> 2026; 7(2):804-816.
          </div>
        </div>
      );

    case 'biography-box':
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-6 rounded bg-slate-200 flex items-center justify-center text-[7pt] shrink-0">
            👤
          </div>
          <div className="text-[6.5pt] leading-tight text-slate-700">
            <span className="font-bold">TS. Hà Vũ:</span> Giảng viên Bộ môn Nội, Khoa Y ĐHQG-HCM.
          </div>
        </div>
      );

    case 'link-box':
      return (
        <div className="flex items-center justify-between p-1 rounded bg-blue-50 border border-blue-200 text-[6.5pt]">
          <span className="font-mono text-blue-700">https://doi.org/10.32508/...</span>
          <span className="font-bold text-slate-700">[QR Code]</span>
        </div>
      );

    case 'divider-line':
      return (
        <div className="py-1">
          <hr className="border-t border-slate-400 border-dashed" />
        </div>
      );

    case 'custom-field':
    default:
      return (
        <div className="text-[6.8pt] text-slate-600 italic">
          Trường dữ liệu tùy biến người dùng tự định nghĩa.
        </div>
      );
  }
};
