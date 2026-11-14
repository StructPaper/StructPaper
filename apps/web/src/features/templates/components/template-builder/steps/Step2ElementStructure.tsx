'use client';

import React, { useState } from 'react';
import {
  SemanticElement,
  LayoutZoneConfig,
  ElementType,
} from '@/types/template-builder';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Type,
  Users,
  Grid,
  BoxSelect,
  Tag,
  Heading,
  Baseline,
  Sparkles,
  Image,
  Table,
  UserCheck,
  BookOpen,
  FileQuestion,
  Layers,
  ArrowRight,
  ArrowLeft,
  Inbox,
  X,
  Sigma,
  Code2,
  Link2,
  GripVertical,
  ChevronRight,
} from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';
import { Select } from '@/components/ui/Select';
import { flattenAllZones } from '../nested-zones';
import { AddElementModal, ACADEMIC_ELEMENT_METAS } from './AddElementModal';

interface Step2ElementStructureProps {
  elements: SemanticElement[];
  zones: LayoutZoneConfig[];
  selectedElementId: string | null;
  onSelectElement: (id: string) => void;
  onElementsChange: (elements: SemanticElement[]) => void;
  onNavigateToStyling: (elementId: string) => void;
  onNavigateToBack?: () => void;
  onNavigateForward?: () => void;
}

const ELEMENT_TYPE_METAS = ACADEMIC_ELEMENT_METAS;

export const Step2ElementStructure: React.FC<Step2ElementStructureProps> = ({
  elements,
  zones,
  selectedElementId,
  onSelectElement,
  onElementsChange,
  onNavigateToStyling,
  onNavigateToBack,
  onNavigateForward,
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [targetZoneForAdd, setTargetZoneForAdd] = useState<string>(
    zones[0]?.id || ''
  );
  const [collapsedZones, setCollapsedZones] = useState<Record<string, boolean>>({});

  const toggleZoneCollapse = (zoneId: string) => {
    setCollapsedZones((prev) => ({
      ...prev,
      [zoneId]: !prev[zoneId],
    }));
  };

  const flattened = flattenAllZones(zones);
  const activeZoneIds = new Set(flattened.map((f) => f.zone.id));
  const unassignedElements = elements
    .filter((e) => !e.zoneId || !activeZoneIds.has(e.zoneId))
    .sort((a, b) => a.order - b.order);

  const rowZoneOptions = [
    {
      value: '',
      label: '⚡ Chưa gán phân vùng',
    },
    ...flattened.map((f) => ({
      value: f.zone.id,
      label: f.displayName,
    })),
  ];

  // Add new element with academic defaults from demo template
  const handleAddNewElement = (type: ElementType) => {
    const meta = ACADEMIC_ELEMENT_METAS.find((m) => m.type === type);
    const chosenZoneId = targetZoneForAdd; // Keeps '' when unassigned!
    const newElement: SemanticElement = {
      id: `elem_${type}_${Date.now()}`,
      type,
      name: meta?.label || 'Thành phần mới',
      zoneId: chosenZoneId,
      order: elements.length + 1,
      spanColumns: meta?.columnSpan === 'all',
      visible: true,
      styling: {
        fontFamily: type === 'article-title' ? 'Times New Roman' : 'Arial',
        fontSize: type === 'article-title' ? 18 : type === 'heading' ? 12 : 10,
        fontWeight: type === 'heading' || type === 'article-title' ? 'bold' : 'normal',
        fontStyle: type === 'affiliation-list' ? 'italic' : 'normal',
        textColor: type === 'article-title' ? '#0F284E' : '#1A1A1A',
        textAlign: type === 'article-title' ? 'left' : type === 'body-text' ? 'justify' : 'left',
        lineHeight: 1.25,
        textTransform: type === 'heading' ? 'uppercase' : 'none',
        backgroundColor:
          type === 'callout-box'
            ? '#FFF7ED'
            : type === 'citation-strip'
              ? '#DBEAFE'
              : 'transparent',
        borderStyle:
          type === 'callout-box'
            ? 'left-solid'
            : type === 'citation-strip'
              ? 'all-borders'
              : 'none',
        borderColor:
          type === 'callout-box'
            ? '#F97316'
            : type === 'citation-strip'
              ? '#BFDBFE'
              : '#E2E8F0',
        borderWidth: 1,
        borderRadius: 4,
        padding: { top: 2, right: 2, bottom: 2, left: 2 },
        margin: { top: 4, bottom: 4 },
      },
      specialProps: {
        customContentSample: `Mẫu nội dung của ${meta?.label}`,
        ...(type === 'article-header-badge'
          ? {
              articleType: 'Bài tổng quan',
              isOpenAccess: true,
              openAccessText: 'Open Access Full Text Article',
            }
          : {}),
        ...(type === 'article-title'
          ? {
              customContentSample:
                'Tổng quan về loét dạ dày tá tràng ở người cao tuổi và cập nhật trong điều trị',
            }
          : {}),
        ...(type === 'author-block'
          ? {
              authorNames: 'Hà Vũ*, Viên Vinh Phú',
            }
          : {}),
        ...(type === 'affiliation-list'
          ? {
              affiliations: [
                {
                  id: 'aff_1',
                  index: '',
                  department: 'Bộ môn Nội - Khoa Y',
                  institution:
                    'Trường Đại học Khoa học Sức khỏe - Đại học Quốc Gia TP.HCM',
                  address: 'TP. Hồ Chí Minh, Việt Nam',
                },
              ],
              affiliationText:
                'Bộ môn Nội - Khoa Y – Trường Đại học Khoa học Sức khỏe - Đại học Quốc Gia Thành phố Hồ Chí Minh',
            }
          : {}),
        ...(type === 'citation-strip'
          ? {
              citationLabel: 'Trích dẫn bài báo này :',
              citationText:
                'Vũ H, Phú V V. Tổng quan về loét dạ dày tá tràng ở người cao tuổi và cập nhật trong điều trị. Sci. Tech. Dev. J. - Health Sci. 2026; 7(2):804-816.',
              citationJournal: 'Sci. Tech. Dev. J. - Health Sci.',
            }
          : {}),
        ...(type === 'metadata-grid'
          ? {
              metadataLayout: 'sidebar-academic',
              historyReceived: '14-06-2025',
              historyRevised: '10-02-2026',
              historyAccepted: '14-04-2026',
              historyPublished: '07-05-2026',
              correspondenceAuthor: 'Hà Vũ',
              correspondenceAffiliation:
                'Bộ môn Nội - Khoa Y – Trường Đại học Khoa học Sức khỏe - Đại học Quốc Gia TP.HCM',
              correspondenceEmail: 'hvu@uhsvnu.edu.vn',
              doiUrl: 'https://doi.org/10.32508/vnuhcmj-hs.v7i1.630',
              copyrightNotice:
                '© ĐHQG Tp.HCM. Đây là bài báo công bố mở được phát hành theo các điều khoản của Creative Commons Attribution 4.0 International license.',
            }
          : {}),
        ...(type === 'abstract-box'
          ? {
              abstractTitle: 'TÓM TẮT',
              customContentSample:
                'Bệnh loét dạ dày tá tràng hiện nay là một thách thức y tế lớn đối với người cao tuổi (từ 65 tuổi trở lên). Mặc dù tỷ lệ mắc bệnh chung có xu hướng giảm, nhưng tần suất biến chứng và tỷ lệ tử vong ở nhóm dân số già lại gia tăng rõ rệt...',
            }
          : {}),
        ...(type === 'keywords-group'
          ? {
              keywords: [
                'Bệnh loét dạ dày tá tràng',
                'bệnh nhân cao tuổi',
                'Helicobacter pylori',
                'thuốc chống viêm không steroid',
                'thuốc ức chế bơm proton',
              ],
            }
          : {}),
        ...(type === 'heading'
          ? {
              headingLevel: 1,
              headingNumbering: 'ROMAN',
              customContentSample: 'GIỚI THIỆU VỀ BỆNH LOÉT DẠ DÀY TÁ TRÀNG:',
            }
          : {}),
        ...(type === 'body-text'
          ? {
              customContentSample:
                'Loét dạ dày tá tràng là tình trạng tổn thương niêm mạc qua lớp cơ niêm, thường xảy ra ở vùng hang vị hoặc tá tràng dưới tác động của acid dạ dày và men pepsin...',
              firstLineIndent: 5,
            }
          : {}),
        ...(type === 'callout-box'
          ? {
              calloutTitle: '⚡ Điểm nhấn nghiên cứu',
              customContentSample:
                'Nội soi tiêu hóa trên kèm sinh thiết theo hệ thống Sydney cải tiến được coi là tiêu chuẩn vàng để xác định vị trí loét, loại trừ ung thư và đánh giá tình trạng nhiễm H. pylori.',
            }
          : {}),
        ...(type === 'figure-box'
          ? {
              captionPrefix: 'Hình',
              captionPosition: 'below',
              captionText:
                'Sơ đồ cơ chế sinh bệnh loét dạ dày tá tràng liên quan đến nhiễm H. pylori và NSAID ở người cao tuổi',
              figureSource: 'Nguồn: Nhóm nghiên cứu y sinh ĐHQG-HCM (2026)',
              figureAlignment: 'center',
              figureSubfigures: false,
            }
          : {}),
        ...(type === 'table-box'
          ? {
              captionPrefix: 'Bảng',
              captionPosition: 'above',
              captionText:
                'So sánh các phác đồ tiệt trừ H. pylori khuyến nghị cho bệnh nhân cao tuổi',
              tableBorderMode: 'booktabs',
              zebraStriping: false,
              tableFootnote:
                '* Ghi chú: P-CAB: Vonoprazan liều 20 mg 2 lần/ngày; PPI: Omeprazole 20 mg hoặc Esomeprazole 40 mg.',
            }
          : {}),
        ...(type === 'equation-box'
          ? {
              equationNumber: '(1)',
              equationLatex:
                '\\mathcal{H}_{score} = \\alpha \\cdot \\text{HpSA} + \\beta \\cdot \\text{NSAID} - \\gamma \\cdot \\text{Age}',
              equationAlign: 'center',
            }
          : {}),
        ...(type === 'code-algorithm'
          ? {
              algorithmTitle:
                'Thuật toán 1: Phân tầng nguy cơ xuất huyết tiêu hóa do thuốc ở người cao tuổi',
              codeLanguage: 'Pseudocode',
              showLineNumbers: true,
              algorithmInputs: 'Hồ sơ bệnh nhân P, Tiền sử NSAID N',
              algorithmOutputs: 'Chỉ định phối hợp PPI & Phác đồ tiệt trừ H. pylori',
            }
          : {}),
        ...(type === 'abbreviations-list'
          ? {
              abbreviations: [
                { term: 'ASA', definition: 'Acetylsalicylic acid' },
                { term: 'COX-1', definition: 'Cyclooxygenase-1' },
                { term: 'HpSA', definition: 'Helicobacter pylori stool antigen' },
                { term: 'ICU', definition: 'Intensive Care Unit (phòng chăm sóc tích cực)' },
                { term: 'MALT', definition: 'Mucosa-associated lymphoid tissue lymphoma' },
                { term: 'NSAID', definition: 'Non-steroidal anti-inflammatory drug' },
                { term: 'OLGA', definition: 'Operative Link on Gastritis Assessment' },
                { term: 'OLGIM', definition: 'Operative Link on Gastric Intestinal Metaplasia' },
                { term: 'PPI', definition: 'Proton pump inhibitor (Thuốc ức chế bơm Proton)' },
              ],
            }
          : {}),
        ...(type === 'conflict-of-interest'
          ? {
              conflictText:
                'Tác giả cam kết không có mâu thuẫn quyền lợi và không có xung đột lợi ích liên quan đến bài nghiên cứu này.',
            }
          : {}),
        ...(type === 'author-contribution'
          ? {
              contributions: [
                { author: 'Hà Vũ', role: 'lên ý tưởng, viết và hoàn thiện bản thảo bài báo' },
                { author: 'Viên Vinh Phú', role: 'tham gia viết và chỉnh sửa bản thảo bài báo' },
              ],
            }
          : {}),
        ...(type === 'acknowledgement-box'
          ? {
              acknowledgementText:
                'Nghiên cứu này được tài trợ bởi Đại học Quốc gia Thành phố Hồ Chí Minh (ĐHQG-HCM) trong khuôn khổ Đề tài mã số VNUHCM-2025-MED-01.',
              grantNumber: 'VNUHCM-2025-MED-01',
            }
          : {}),
        ...(type === 'references-block'
          ? {
              referenceHeadingText: 'TÀI LIỆU THAM KHẢO',
              referenceItems: [
                {
                  num: '1',
                  text: 'Vũ H, Phú V V. Tổng quan về loét dạ dày tá tràng ở người cao tuổi và cập nhật trong điều trị. Sci. Tech. Dev. J. - Health Sci. 2026; 7(2):804-816.',
                  url: 'https://doi.org/10.32508/vnuhcmj-hs.v7i1.630',
                },
                {
                  num: '2',
                  text: 'Malfertheiner P, Megraud F, Rokkas T, et al. Management of Helicobacter pylori infection: the Maastricht VI/Florence consensus report. Gut. 2022; 71(9):1724-1762.',
                  url: 'https://doi.org/10.1136/gutjnl-2022-327745',
                },
              ],
            }
          : {}),
        ...(type === 'biography-box'
          ? {
              authorName: 'TS. Hà Vũ',
              showAuthorPhoto: true,
              bioText:
                'Bộ môn Nội - Khoa Y – Trường Đại học Khoa học Sức khỏe - Đại học Quốc Gia TP.HCM. Hướng nghiên cứu chuyên sâu về bệnh lý tiêu hóa và quản lý dược lâm sàng ở bệnh nhân cao tuổi.',
            }
          : {}),
        ...(type === 'link-box'
          ? {
              linkType: 'doi',
              linkLabel: 'Mã định danh DOI',
              linkUrl: 'https://doi.org/10.32508/vnuhcmj-hs.v7i1.630',
              linkStyle: 'pill',
              showQrCode: true,
            }
          : {}),
      },
    };

    onElementsChange([...elements, newElement]);
    setShowAddModal(false);
    onSelectElement(newElement.id);
    const assignedZone = zones.find((z) => z.id === chosenZoneId);
    toast.success(
      'Thêm thành phần',
      assignedZone
        ? `Đã thêm khối "${meta?.label || 'mới'}" vào ${assignedZone.name}!`
        : `Đã thêm khối "${meta?.label || 'mới'}" (Chưa gán phân vùng)!`
    );
  };

  // Duplicate an element
  const handleDuplicate = (el: SemanticElement) => {
    const duplicated: SemanticElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: `elem_${el.type}_${Date.now()}`,
      name: `${el.name} (Bản sao)`,
      order: el.order + 1,
    };
    onElementsChange([...elements, duplicated]);
    toast.success('Nhân bản', `Đã nhân bản "${el.name}"`);
  };

  // Delete an element
  const handleDelete = (id: string) => {
    onElementsChange(elements.filter((e) => e.id !== id));
    toast.success('Đã xóa khối thành phần');
  };

  // Move element up/down in same zone or within unassigned group
  const handleMove = (id: string, direction: 'up' | 'down') => {
    const el = elements.find((e) => e.id === id);
    if (!el) return;

    const isUnassigned = !el.zoneId || !activeZoneIds.has(el.zoneId);
    const peerElements = isUnassigned
      ? elements.filter((e) => !e.zoneId || !activeZoneIds.has(e.zoneId)).sort((a, b) => a.order - b.order)
      : elements.filter((e) => e.zoneId === el.zoneId).sort((a, b) => a.order - b.order);

    const currIdx = peerElements.findIndex((e) => e.id === id);
    const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;

    if (targetIdx < 0 || targetIdx >= peerElements.length) return;

    const temp = peerElements[currIdx];
    peerElements[currIdx] = peerElements[targetIdx];
    peerElements[targetIdx] = temp;

    peerElements.forEach((item, i) => (item.order = i + 1));

    const otherEls = elements.filter((e) =>
      isUnassigned
        ? (e.zoneId && activeZoneIds.has(e.zoneId))
        : e.zoneId !== el.zoneId
    );
    onElementsChange([...otherEls, ...peerElements]);
  };

  // Update element field
  const handleUpdateElement = (id: string, updated: Partial<SemanticElement>) => {
    onElementsChange(
      elements.map((e) => (e.id === id ? { ...e, ...updated } : e))
    );
  };

  const renderElementItem = (
    el: SemanticElement,
    elIdx: number,
    groupLength: number,
    isUnassigned = false
  ) => {
    const meta = ELEMENT_TYPE_METAS.find((m) => m.type === el.type);
    const Icon = meta?.icon || Type;
    const isSelected = selectedElementId === el.id;

    return (
      <div
        key={el.id}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('application/structpaper-element-id', el.id);
          e.dataTransfer.setData('text/plain', el.id);
          e.dataTransfer.effectAllowed = 'copyMove';
        }}
        className={`p-3.5 rounded-3xl transition-all flex flex-col gap-2.5 relative focus-within:z-30 shadow-[0_0_10px_rgba(0,0,0,0.03)] cursor-grab active:cursor-grabbing ${isSelected
          ? 'border-2 border-[#78C841] bg-white ring-2 ring-[#78C841]/20'
          : isUnassigned
            ? 'border border-amber-200/90 bg-white hover:bg-amber-50/20 hover:border-amber-400'
            : 'border border-zinc-200/60 bg-white hover:bg-white hover:border-zinc-300'
          }`}
      >
        {/* Row 1: Left: Drag Handle, Icon, Name input, Type Badge, Staging Badge. Right: Move, Copy, Eye, Delete, Định dạng */}
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="text-zinc-400 hover:text-zinc-800 cursor-grab active:cursor-grabbing p-0.5 shrink-0"
              title="Kéo thả khối này sang lưới xem trước bên phải để gán vào phân vùng"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs">
              <Icon className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={el.name}
                onChange={(e) =>
                  handleUpdateElement(el.id, { name: e.target.value })
                }
                className="text-xs font-extrabold text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-[#78C841] outline-none truncate max-w-[200px] min-w-[100px]"
              />
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-700 font-mono font-bold shrink-0">
                {el.type}
              </span>
              {isUnassigned && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300 shrink-0 flex items-center gap-1 shadow-2xs">
                  <span>✋ Kéo sang lưới</span>
                </span>
              )}
            </div>
          </div>

          {/* Action button cluster */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {/* Reorder buttons */}
            <button
              type="button"
              onClick={() => handleMove(el.id, 'up')}
              disabled={elIdx === 0}
              className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 cursor-pointer transition-colors"
              title="Lên trên"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleMove(el.id, 'down')}
              disabled={elIdx === groupLength - 1}
              className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 cursor-pointer transition-colors"
              title="Xuống dưới"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* Duplicate */}
            <button
              type="button"
              onClick={() => handleDuplicate(el)}
              className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors"
              title="Nhân bản khối này"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {/* Visibility toggle (Eye) - styled identically to trash, next to trash */}
            <button
              type="button"
              onClick={() =>
                handleUpdateElement(el.id, { visible: !el.visible })
              }
              className={`p-1.5 rounded-xl hover:bg-zinc-100 cursor-pointer transition-colors ${
                el.visible
                  ? 'text-zinc-500 hover:text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
              title={el.visible ? 'Đang hiển thị (Click để ẩn)' : 'Đang ẩn (Click để hiện)'}
            >
              {el.visible ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => handleDelete(el.id)}
              className="p-1.5 rounded-xl hover:bg-red-50 text-zinc-400 hover:text-red-600 cursor-pointer transition-colors"
              title="Xóa khối này"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Jump to Styling */}
            <button
              type="button"
              onClick={() => {
                onSelectElement(el.id);
                onNavigateToStyling(el.id);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-400/80 hover:bg-[#68af38] text-white text-xs font-extrabold shadow-sm transition-all hover:scale-102 active:scale-98 cursor-pointer ml-1"
              title="Chỉnh font chữ, màu sắc, viền ở Bước 3"
            >
              <span>Định dạng</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Description on left, Zone Selector and Span Columns on right */}
        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-zinc-100 flex-wrap">
          <div className="text-[11px] text-zinc-500 truncate min-w-0 flex-1">
            {meta?.description}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Zone reassign dropdown */}
            <div className="w-40 min-w-[140px]">
              <Select
                value={el.zoneId && activeZoneIds.has(el.zoneId) ? el.zoneId : ''}
                onChange={(val) => {
                  handleUpdateElement(el.id, { zoneId: val });
                  const targetZone = zones.find((z) => z.id === val);
                  toast.success(
                    'Cập nhật phân vùng',
                    targetZone
                      ? `Đã chuyển "${el.name}" vào ${targetZone.name}`
                      : `Đã đưa "${el.name}" về danh sách chưa gán`
                  );
                }}
                variant="flat-white"
                size="xs"
                align="right"
                options={rowZoneOptions}
              />
            </div>

            {/* Span columns toggle */}
            <button
              type="button"
              disabled={isUnassigned}
              onClick={() =>
                handleUpdateElement(el.id, {
                  spanColumns: !el.spanColumns,
                })
              }
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${el.spanColumns
                ? 'bg-purple-100 text-purple-700 border-purple-200'
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                } ${isUnassigned ? 'opacity-40 cursor-not-allowed' : ''}`}
              title="Tràn toàn bộ cột trong phân vùng (Span all columns)"
            >
              {el.spanColumns ? 'Tràn cột' : 'Theo cột'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Add Button */}
      <div className="relative z-30 focus-within:z-40 p-2 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-700" />
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
              Bước 3: Cấu trúc Thành phần ({elements.length})
            </h3>
          </div>

          <button
            id="btn-add-element-modal"
            type="button"
            onClick={() => {
              setTargetZoneForAdd(zones[0]?.id || '');
              setShowAddModal(true);
            }}
            className="btn-pill-lime text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm khối thành phần mới</span>
          </button>
        </div>
      </div>

      {/* 0. Khối Chưa Gán Phân Vùng (Staging / Buffer Area) */}
      <div className="relative z-20 focus-within:z-40 bg-gray-200/50 rounded-[32px] p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-amber-600" />
            <h3 className="font-extrabold text-xs sm:text-sm text-zinc-900 uppercase tracking-tight">
              Khối Chưa Gán Phân Vùng (Chờ Sắp Xếp)
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${unassignedElements.length > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-zinc-100 text-zinc-500'
                }`}
            >
              {unassignedElements.length} thành phần
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setTargetZoneForAdd('');
              setShowAddModal(true);
            }}
            className="text-xs text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1.5 cursor-pointer bg-amber-100/70 hover:bg-amber-200/70 px-3 py-1.5 rounded-xl border border-amber-200/80 transition-all shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm khối tự do</span>
          </button>
        </div>

        {unassignedElements.length === 0 ? (
          <div className="py-4 px-4 text-center text-xs text-amber-700/70 bg-amber-50/40 border border-dashed border-amber-200/70 rounded-2xl">
            Tất cả khối thành phần hiện đã được xếp vào các phân vùng bố cục bên dưới. Bạn có thể nhấn &quot;+ Thêm khối tự do&quot; để tạo khối chờ chưa thuộc phân vùng nào. Khi bạn xóa một phân vùng, các khối bên trong cũng sẽ được tự động bảo toàn tại đây.
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-[11px] text-amber-800 bg-amber-50 px-3.5 py-2 rounded-2xl border border-amber-200/60 flex items-center justify-between">
              <span>
                💡 Các khối này chưa thuộc phân vùng nào. Bạn có thể bấm &quot;Định dạng&quot; hoặc chọn menu phân vùng bên phải để đưa vào bố cục bất cứ lúc nào.
              </span>
            </div>
            {unassignedElements.map((el, elIdx) =>
              renderElementItem(el, elIdx, unassignedElements.length, true)
            )}
          </div>
        )}
      </div>

      {/* Elements grouped by Zones */}
      <div className="space-y-4">
        {zones.map((zone, zoneIdx) => {
          const directZoneElements = elements
            .filter((e) => e.zoneId === zone.id)
            .sort((a, b) => a.order - b.order);

          const hasSubZones = Boolean(zone.subZones && zone.subZones.length > 0);
          const isCollapsed = Boolean(collapsedZones[zone.id]);

          const allSubZoneIds = hasSubZones ? zone.subZones!.map((sz) => sz.id) : [];
          const totalChildElements = elements.filter(
            (e) => e.zoneId && allSubZoneIds.includes(e.zoneId)
          ).length;
          const totalZoneElements = directZoneElements.length + totalChildElements;

          return (
            <div
              key={zone.id}
              className="relative z-20 focus-within:z-40 bg-white rounded-[32px] p-5 shadow-[0_0_16px_rgba(0,0,0,0.06),0_0_4px_rgba(0,0,0,0.03)] space-y-4 border border-zinc-200/80 transition-all"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200/60 flex-wrap gap-2">
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  {/* Zone sequential number badge */}
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-xs font-mono font-extrabold shadow-2xs shrink-0">
                    {zoneIdx + 1}
                  </span>

                  <BoxSelect className="w-4 h-4 text-zinc-700 shrink-0" />

                  <h3 className="font-extrabold text-xs sm:text-sm text-zinc-900 uppercase tracking-tight truncate max-w-[240px]">
                    {zone.name}
                  </h3>

                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-50 border border-indigo-200 text-indigo-900 shadow-2xs">
                    📄 Trang {zone.page || (zone.pageScope === 'subsequent-pages' ? 2 : 1)}
                  </span>

                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-mono font-bold">
                    {zone.type} ({totalZoneElements})
                  </span>

                  {hasSubZones && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#78C841]/15 border border-[#78C841]/40 text-[#14532D] font-bold flex items-center gap-1 shadow-2xs">
                      <Layers className="w-3 h-3 text-[#78C841]" />
                      <span>{zone.subZones!.length} vùng con (Cấp 2)</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  {/* Collapse / Expand hierarchy toggle button */}
                  {hasSubZones && (
                    <button
                      type="button"
                      onClick={() => toggleZoneCollapse(zone.id)}
                      className="px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title={isCollapsed ? 'Mở rộng xem các vùng con' : 'Thu gọn phân cấp'}
                    >
                      {isCollapsed ? (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Mở rộng</span>
                        </>
                      ) : (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Thu gọn</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setTargetZoneForAdd(zone.id);
                      setShowAddModal(true);
                    }}
                    className="btn-pill-subtle text-xs py-1 px-2.5 flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm vào phân vùng</span>
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <>
                  {/* Direct elements of parent zone */}
                  {directZoneElements.length > 0 && (
                    <div className="space-y-1">
                      {directZoneElements.map((el, elIdx) =>
                        renderElementItem(el, elIdx, directZoneElements.length, false)
                      )}
                    </div>
                  )}

                  {/* Sub-zones hierarchical branch view */}
                  {hasSubZones && (
                    <div className="ml-2 sm:ml-4 pl-3 sm:pl-4 border-l-2 border-[#78C841]/60 space-y-3 mt-2 pt-1">
                      <div className="text-[11px] font-bold text-[#14532D] flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#78C841]" />
                        <span>CÁC PHÂN VÙNG CON CẤP 2 ({zone.subZones!.length} VÙNG):</span>
                      </div>

                      {zone.subZones!.map((subZone, subIdx) => {
                        const subElements = elements
                          .filter((e) => e.zoneId === subZone.id)
                          .sort((a, b) => a.order - b.order);
                        const isSubCollapsed = Boolean(collapsedZones[subZone.id]);

                        return (
                          <div
                            key={subZone.id}
                            className="bg-[#78C841]/5 hover:bg-[#78C841]/10 border border-[#78C841]/30 rounded-2xl p-3.5 space-y-2.5 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className="px-2 py-0.5 rounded-md bg-[#14532D] text-white text-[11px] font-mono font-extrabold shadow-2xs shrink-0">
                                  {zoneIdx + 1}.{subIdx + 1}
                                </span>
                                <Layers className="w-3.5 h-3.5 text-[#78C841] shrink-0" />
                                <h4 className="font-extrabold text-xs text-zinc-950 truncate max-w-[200px]">
                                  {subZone.name}
                                </h4>
                                {subZone.gridArea && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#78C841]/20 text-[#14532D] font-mono font-bold">
                                    {subZone.gridArea.colSpan}c×{subZone.gridArea.rowSpan}r
                                  </span>
                                )}
                                <span className="text-[10px] text-zinc-500 font-semibold">
                                  ({subElements.length} thành phần)
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                {subElements.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleZoneCollapse(subZone.id)}
                                    className="p-1 rounded-lg hover:bg-[#78C841]/20 text-[#14532D] text-xs font-bold transition-colors"
                                    title={isSubCollapsed ? 'Mở rộng' : 'Thu gọn'}
                                  >
                                    {isSubCollapsed ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetZoneForAdd(subZone.id);
                                    setShowAddModal(true);
                                  }}
                                  className="text-xs py-1 px-2.5 rounded-xl bg-white hover:bg-[#78C841]/10 border border-[#78C841]/50 text-[#14532D] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                >
                                  <Plus className="w-3 h-3 text-[#14532D]" />
                                  <span>Thêm vào vùng con</span>
                                </button>
                              </div>
                            </div>

                            {!isSubCollapsed && (
                              <>
                                {subElements.length === 0 ? (
                                  <div className="py-3 px-3 text-center text-xs text-zinc-600 bg-white/70 border border-dashed border-[#78C841]/50 rounded-xl">
                                    Chưa có thành phần nào trong vùng con này. Kéo thả khối chưa gán vào đây hoặc bấm &quot;+ Thêm&quot;.
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {subElements.map((el, elIdx) =>
                                      renderElementItem(el, elIdx, subElements.length, false)
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Empty state if no direct elements and no subzones */}
                  {!hasSubZones && directZoneElements.length === 0 && (
                    <div className="py-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-2xl">
                      Chưa có thành phần nào trong phân vùng này. Kéo thả khối chưa gán từ trên xuống hoặc bấm &quot;+ Thêm vào phân vùng&quot;.
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Add New Element */}
      <AddElementModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddElement={handleAddNewElement}
        targetZoneId={targetZoneForAdd}
        onTargetZoneChange={setTargetZoneForAdd}
        zones={zones}
      />


    </div>
  );
};
