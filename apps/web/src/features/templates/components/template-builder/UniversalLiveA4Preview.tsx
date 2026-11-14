'use client';

import React, { useState, useEffect } from 'react';
import {
  UniversalTemplateSchema,
  GridAreaCoords,
  LayoutZoneConfig,
  SemanticElement,
} from '@/types/template-builder';
import { PaperGridOverlay } from './grid-zone-builder/PaperGridOverlay';
import { STANDARD_PAPER_SIZES, MM_TO_PX } from './preview/previewConstants';
import { getSpecialElementsDemoList } from './preview/specialElementsDemo';
import { PreviewControlBar } from './preview/PreviewControlBar';
import { PreviewHeader } from './preview/PreviewHeader';
import { PreviewFooter } from './preview/PreviewFooter';
import { PreviewZoneContent } from './preview/PreviewZoneContent';
import { ElementStyleContextMenu } from './preview/ElementStyleContextMenu';
import { toast } from '@/components/DynamicIslandToast';
import { ID630_DEMO_PAGES } from '@/lib/template-builder/id630-demo-pages';
import { findZoneDeep } from './nested-zones/nestedZoneUtils';
import { Plus } from 'lucide-react';

export interface UniversalLiveA4PreviewProps {
  initialPage?: number;
  schema: UniversalTemplateSchema;
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string) => void;
  onSelectZone?: (zoneId: string) => void;
  onSelectHeader?: () => void;
  onOpenGridBuilder?: () => void;
  showGridOverlay?: boolean;
  onToggleGridOverlay?: () => void;
  onAddZoneWithArea?: (area: GridAreaCoords, pageNumber?: number) => void;
  onUpdateZoneArea?: (zoneId: string, area: GridAreaCoords) => void;
  onUpdateZoneSecondaryArea?: (zoneId: string, area: GridAreaCoords | null) => void;
  onDeleteZone?: (zoneId: string) => void;
  onUpdateZoneName?: (zoneId: string, name: string) => void;
  onDrillDownZone?: (zoneId: string) => void;
  selectedZoneId?: string | null;
  focusedZoneId?: string | null;
  onFocusZone?: (zoneId: string | null) => void;
  onAddSubZoneWithArea?: (parentId: string, area: GridAreaCoords) => void;
  onUpdateSubZone?: (subZoneId: string, updated: Partial<LayoutZoneConfig>) => void;
  onDeleteSubZone?: (subZoneId: string) => void;
  selectedSubZoneId?: string | null;
  onSelectSubZone?: (subZoneId: string) => void;
  onAssignElementToZone?: (elementId: string, zoneId: string) => void;
  onUpdateElement?: (elementId: string, updated: Partial<SemanticElement>) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onNavigateToStep?: (step: string) => void;
  className?: string;
  isStep4?: boolean;
  demoSpecialElements?: boolean;
  onToggleDemoSpecialElements?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const EXTENDED_SCHOLARLY_BODY_TEXT = [
  'Văn bản khoa học đóng vai trò trung tâm trong công tác công bố và lan toả tri thức học thuật.',
  'Các tạp chí thuộc hệ sinh thái Đại học Quốc gia TP.HCM đòi hỏi quy chuẩn dàn trang nghiêm ngặt về số cột, lề trang, font chữ và phong cách trích dẫn theo định dạng chuẩn quốc tế.',
  'Hệ thống kết hợp phân tích cú pháp OpenXML nội bộ với mô hình ngôn ngữ lớn để bảo toàn hoàn chỉnh ảnh đồ họa vector, công thức toán học MathML và mạng lưới trích dẫn tài liệu tham khảo.',
  'Đặc biệt, quy trình trích xuất tự động phân tích cấu trúc cây phân cấp của văn bản, phân định chính xác giữa các phần tiêu đề, tác giả, cơ quan công tác và phần tóm tắt mở đầu.',
  'Khi dung lượng của khối phân vùng đầu tiên đạt đến giới hạn biên, luồng văn bản sẽ tự động chuyển tiếp liền mạch sang khối phân vùng kế tiếp theo thiết kế dòng chảy đa khối độc lập.',
  'Cơ chế phân tách này bảo đảm tính toàn vẹn ngữ nghĩa của từng câu văn và loại bỏ hoàn toàn hiện tượng vỡ khung hay tràn tự do ngoài lề quy định.',
  'Các thuật toán cân bằng dòng và tối ưu khoảng cách ký tự giúp phân bổ văn bản đồng đều trên cả hai khối cột, tạo nên bố cục ấn phẩm học thuật đạt chuẩn thẩm mỹ cao và sẵn sàng cho quy trình xuất bản chế bản điện tử.',
  'Kết quả thử nghiệm thực tế trên tập dữ liệu bài báo khoa học ĐHQG-HCM cho thấy độ chính xác nhận dạng cấu trúc đạt trên 98,5%, giảm thiểu tối đa thời gian biên tập và định dạng thủ công của ban biên tập chuyên ngành.',
  'Việc chuẩn hóa quy trình biên tập tài liệu điện tử theo kiến trúc phân vùng linh hoạt giúp các cơ sở nghiên cứu và trường đại học thành viên nâng cao năng suất xuất bản định kỳ.',
  'Đồng thời, giải pháp này tạo tiền đề vững chắc cho việc tích hợp kho lưu trữ mở và kết nối dữ liệu liên thông với các hệ thống chỉ mục khoa học hàng đầu thế giới.',
  'Trong bối cảnh chuyển đổi số giáo dục đại học, việc ứng dụng các mô hình học sâu vào xử lý văn bản bán cấu trúc mang lại nhiều triển vọng đột phá trong quản trị tri thức.',
  'Các tài liệu khoa học thường chứa đựng nhiều thành phần phức tạp như bảng dữ liệu đa tầng, hình ảnh vi mô có độ phân giải cao và các chú thích chân trang chi tiết.',
  'Nếu không có cơ chế điều phối luồng thông minh, sự xuất hiện của các phần tử nổi này có thể gây ra hiện tượng xô lệch dòng hoặc để lại các khoảng trống không mong muốn trên trang in.',
  'Hệ thống StructPaper đề xuất giải thuật phân bổ động dựa trên trọng số hình học của từng khối lưới, cho phép nội dung văn bản tự động lấp đầy phần diện tích hữu dụng trước khi kích hoạt điểm chuyển tiếp.',
  'Nhờ đó, tính liên tục của trải nghiệm đọc được duy trì tuyệt đối, đồng thời bảo đảm tính nhất quán với các mẫu định dạng LaTeX và Typst đã được thẩm định bởi Hội đồng Khoa học.',
  'Các thực nghiệm đối sánh với các công cụ chế bản truyền thống chứng minh rằng phương pháp này giảm thiểu đến 85% các thao tác căn chỉnh thủ công của biên tập viên.',
  'Hơn nữa, định dạng đầu ra hoàn toàn tương thích với các tiêu chuẩn lưu trữ số dài hạn như PDF/A-1a và JATS XML, hỗ trợ tối ưu cho các công cụ lập chỉ mục tự động.',
  'Tóm lại, sự kết hợp giữa mô hình phân vùng lưới trực quan và giải thuật dòng chảy văn bản thông minh mang lại một giải pháp toàn diện cho xuất bản học thuật hiện đại.',
  'Công trình mở ra hướng phát triển mới trong việc tự động hóa toàn bộ chu trình xuất bản từ khâu nộp bài đến xuất bản trực tuyến.',
  'Hệ thống tiếp tục được mở rộng để hỗ trợ đa ngôn ngữ và các chuẩn trích dẫn đặc thù của từng chuyên ngành nghiên cứu khác nhau.',
  'Phương pháp tiếp cận dựa trên đồ thị phân cấp cho phép biểu diễn tường minh mối quan hệ phụ thuộc giữa các khối nội dung độc lập trong cùng một tài liệu.',
  'Mỗi vùng văn bản được gán các thuộc tính hình học xác định bao gồm tọa độ bắt đầu, số hàng, số cột và hành vi ứng xử khi xảy ra hiện tượng tràn dòng.',
  'Khi người dùng tương tác kéo thả để thay đổi kích thước của một phân vùng bất kỳ trên giao diện trực quan, hệ thống sẽ tự động tính toán lại dung lượng ký tự khả dụng trong thời gian thực.',
  'Quá trình phân bổ này được thực hiện tức thì nhằm duy trì sự cân đối hoàn hảo giữa phần đầu văn bản tại khối nguồn và phần tiếp nối tại khối đích.',
  'Mọi khoảng trống dư thừa ở cuối khối phân vùng thứ nhất đều được triệt tiêu hoàn toàn nhờ cơ chế lấp đầy tối đa trước khi dòng chảy được chuyển tiếp.',
  'Đồng thời, phần văn bản chuyển tiếp tại khối phân vùng thứ hai sẽ bắt đầu ngay tại dòng đầu tiên của khung chứa mà không bị đẩy lùi bởi các khoảng đệm không cần thiết.',
  'Sự liền mạch tuyệt đối này đem lại cảm giác trực quan tự nhiên như khi biên tập trên các phần mềm chế bản chuyên nghiệp hàng đầu thế giới.',
  'Ngoài ra, hệ thống còn hỗ trợ linh hoạt các chế độ xử lý tràn nội dung bao gồm cắt gọn cố định theo khung hoặc tự động đẩy dồn các hàng phía dưới.',
  'Tùy thuộc vào yêu cầu cụ thể của từng chuyên trang tạp chí, tác giả có thể dễ dàng thiết lập quy tắc bố cục tối ưu nhất cho bài báo của mình.',
].join(' ');

const EXTENDED_SCHOLARLY_ABSTRACT_TEXT = [
  'Bài báo này đề xuất giải pháp bóc tách cấu trúc tài liệu DOCX bán cấu trúc và tự động chuyển đổi sang khuôn mẫu xuất bản khoa học 2 cột chuẩn VNUHCM.',
  'Hệ thống kết hợp phân tích cú pháp OpenXML nội bộ với mô hình ngôn ngữ lớn để bảo toàn hoàn chỉnh ảnh đồ họa vector, công thức toán học MathML và mạng lưới trích dẫn tài liệu tham khảo.',
  'Cơ chế phân vùng thông minh cho phép tự động điều phối dòng chảy nội dung giữa các khối độc lập trên trang giấy, đảm bảo các phần văn bản tràn được tiếp nối chính xác theo thứ tự đọc mà không làm sai lệch quy chuẩn thẩm mỹ.',
  'Kết quả đánh giá trên hệ thống mẫu biểu cho thấy phương pháp đạt độ ổn định cao, đáp ứng toàn diện yêu cầu chế bản tự động cho các ấn phẩm định kỳ thuộc Đại học Quốc gia TP.HCM.',
  'Quy trình xuất bản được rút ngắn đáng kể trong khi chất lượng dàn trang tuân thủ tuyệt đối các tiêu chí nghiêm ngặt của tạp chí chuyên ngành.',
  'Nghiên cứu khẳng định tính khả thi của việc ứng dụng công nghệ trí tuệ nhân tạo trong tự động hóa quy trình chế bản tài liệu học thuật số.',
  'Mô hình đề xuất có khả năng mở rộng linh hoạt cho nhiều thể loại bài báo khoa học từ tổng quan, nghiên cứu gốc đến báo cáo kỹ thuật chuyên sâu.',
].join(' ');

// Helper to strictly bind zones to specific pages in multi-page document templates
export function isZoneOnPage(zone: LayoutZoneConfig, pageNum: number): boolean {
  if (typeof zone.page === 'number') {
    return zone.page === pageNum;
  }
  if (zone.pageScope === 'first-page') {
    return pageNum === 1;
  }
  if (zone.pageScope === 'subsequent-pages') {
    return pageNum === 2;
  }
  // Default legacy fallback: strict Page 1 so zones never bleed onto Page 2+
  return pageNum === 1;
}

function getBlockWordCapacity(colSpan: number, rowSpan: number, hasHeading = false): number {
  const wordsPerLine = colSpan * 4.57;
  const totalLines = Math.floor(rowSpan * 10);
  const headingLines = hasHeading ? 3 : 0;
  const availableLines = Math.max(2, totalLines - headingLines);
  return Math.round(wordsPerLine * availableLines);
}

function splitZoneElementsForFlow(
  zoneElements: SemanticElement[],
  zone: LayoutZoneConfig
): { primaryElements: SemanticElement[]; secondaryElements: SemanticElement[] } {
  if (!zone.secondaryGridArea || zoneElements.length === 0) {
    return { primaryElements: zoneElements, secondaryElements: [] };
  }

  const g1 = zone.gridArea || { colSpan: 1, rowSpan: 1 };
  const colSpan1 = g1.colSpan || 1;
  const rowSpan1 = g1.rowSpan || 1;

  const splitTextElement = (
    el: SemanticElement,
    wordsToFillBlock1: number
  ): [SemanticElement, SemanticElement] => {
    const isBody = el.type === 'body-text';
    const isAbstract = el.type === 'abstract-box';

    let defaultText = '';
    if (isBody) {
      defaultText = EXTENDED_SCHOLARLY_BODY_TEXT;
    } else if (isAbstract) {
      defaultText = EXTENDED_SCHOLARLY_ABSTRACT_TEXT;
    } else {
      defaultText = el.specialProps?.customContentSample || '';
    }

    const fullText = el.specialProps?.customContentSample || defaultText;
    const words = fullText.split(' ');

    const splitPoint = Math.min(words.length - 4, Math.max(8, wordsToFillBlock1));

    const part1Text = words.slice(0, splitPoint).join(' ');
    const part2Text = words.slice(splitPoint).join(' ');

    const el1: SemanticElement = {
      ...el,
      id: `${el.id}_flow_p1`,
      specialProps: {
        ...el.specialProps,
        customContentSample: part1Text,
        isContinuation: false,
        isFlowSource: true,
        originalBaseId: el.id,
        flowPart: 1,
        siblingPartText: part2Text,
      },
    };

    const el2: SemanticElement = {
      ...el,
      id: `${el.id}_flow_p2`,
      styling: {
        ...el.styling,
        dropCap: false,
        firstLineIndent: 0,
      },
      specialProps: {
        ...el.specialProps,
        customContentSample: part2Text,
        isContinuation: true,
        originalBaseId: el.id,
        flowPart: 2,
        siblingPartText: part1Text,
      },
    };

    return [el1, el2];
  };

  if (zoneElements.length === 1) {
    const el = zoneElements[0];
    if (el.type === 'body-text' || el.type === 'abstract-box') {
      const wordsNeeded = getBlockWordCapacity(colSpan1, rowSpan1, false);
      const [el1, el2] = splitTextElement(el, wordsNeeded);
      return { primaryElements: [el1], secondaryElements: [el2] };
    }
    return { primaryElements: [el], secondaryElements: [] };
  }

  if (
    zoneElements.length === 2 &&
    (zoneElements[1].type === 'body-text' || zoneElements[1].type === 'abstract-box')
  ) {
    const wordsNeeded = getBlockWordCapacity(colSpan1, rowSpan1, true);
    if (wordsNeeded > 12) {
      const [body1, body2] = splitTextElement(zoneElements[1], wordsNeeded);
      return {
        primaryElements: [zoneElements[0], body1],
        secondaryElements: [body2],
      };
    } else {
      return {
        primaryElements: [zoneElements[0]],
        secondaryElements: [zoneElements[1]],
      };
    }
  }

  const totalArea = colSpan1 * rowSpan1 + (zone.secondaryGridArea.colSpan || 1) * (zone.secondaryGridArea.rowSpan || 1);
  const ratio1 = Math.min(0.85, Math.max(0.15, (colSpan1 * rowSpan1) / totalArea));
  const splitIndex = Math.max(
    1,
    Math.min(zoneElements.length - 1, Math.round(zoneElements.length * ratio1))
  );

  return {
    primaryElements: zoneElements.slice(0, splitIndex),
    secondaryElements: zoneElements.slice(splitIndex),
  };
}

/**
 * Maps semantic elements for a zone on a given page.
 * For the VNUHCM Health Sciences template on pages 2-13, synthesizes elements from authentic
 * ID630 content blocks using the active template's styles, so edits made in the studio
 * (colors, fonts, headings, figures, tables) update the preview reactively.
 */
function getElementsForPageZone(
  zone: LayoutZoneConfig,
  page: number,
  schema: UniversalTemplateSchema,
  activeElements: SemanticElement[],
  demoContentOverrides: Record<string, string> = {}
): SemanticElement[] {
  // 1. Always prioritize real semantic elements bound directly to this zone in activeElements
  const bound = activeElements
    .filter((e) => e.zoneId === zone.id && e.visible)
    .sort((a, b) => a.order - b.order);

  if (bound.length > 0) {
    return bound;
  }

  // 2. Newly created user zones (or empty zones without bound elements) remain empty.
  // Never inject fake synthetic demo elements into user-created zones!
  if (!zone.id.startsWith('zone_p')) {
    return [];
  }

  // 3. Built-in template demo fallback for ID630 demo zones only:
  if (schema.id !== 'vnuhcm_health_sciences_id630' || page === 1) {
    return [];
  }

  const pageData = ID630_DEMO_PAGES.find((p) => p.pageNumber === page);
  if (!pageData) {
    return [];
  }

  const baseHeading =
    schema.elements.find((e) => e.id === 'elem_h1' || e.type === 'heading') ||
    activeElements.find((e) => e.type === 'heading');
  const baseBody =
    schema.elements.find((e) => e.id === 'elem_body_p' || e.type === 'body-text') ||
    activeElements.find((e) => e.type === 'body-text');
  const baseFigure =
    schema.elements.find((e) => e.id === 'elem_figure' || e.type === 'figure-box') ||
    activeElements.find((e) => e.type === 'figure-box');
  const baseTable =
    schema.elements.find((e) => e.id === 'elem_table' || e.type === 'table-box') ||
    activeElements.find((e) => e.type === 'table-box');
  const baseRef =
    schema.elements.find((e) => e.id === 'elem_references' || e.type === 'references-block') ||
    activeElements.find((e) => e.type === 'references-block');
  const baseGrant =
    schema.elements.find((e) => e.id === 'elem_funding_grant') ||
    activeElements.find((e) => e.type === 'custom-field');

  const pageElements: SemanticElement[] = [];

  // 1. Figure on this page
  if (pageData.hasFigure && pageData.figureData) {
    const figId = `elem_demo_p${page}_fig`;
    pageElements.push({
      id: figId,
      type: 'figure-box',
      name: `Hình ${pageData.figureData.number}: ${pageData.figureData.title.slice(0, 35)}...`,
      zoneId: zone.id,
      order: 1,
      spanColumns: true,
      visible: true,
      styling: baseFigure?.styling || {
        fontFamily: 'Arial',
        fontSize: 8.2,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textColor: schema.primaryColor,
        textAlign: 'left',
        lineHeight: 1.2,
        textTransform: 'none',
        backgroundColor: '#E7ECF7',
        borderStyle: 'none',
        borderColor: '#E2E8F0',
        borderWidth: 0,
        borderRadius: 0,
        padding: { top: 2, right: 2, bottom: 2, left: 2 },
        margin: { top: 2, bottom: 4 },
      },
      specialProps: {
        figureNumber: pageData.figureData.number,
        captionPrefix: `Hình ${pageData.figureData.number}`,
        captionText: pageData.figureData.title,
        figureSource: pageData.figureData.source,
        figureImageSrc: pageData.figureData.imageSrc,
      },
    });
  }

  // 2. Table on this page
  if (pageData.hasTable && pageData.tableData) {
    const tblId = `elem_demo_p${page}_tbl`;
    pageElements.push({
      id: tblId,
      type: 'table-box',
      name: `Bảng ${pageData.tableData.number}: ${pageData.tableData.title.slice(0, 35)}...`,
      zoneId: zone.id,
      order: 2,
      spanColumns: true,
      visible: true,
      styling: baseTable?.styling || {
        fontFamily: 'Arial',
        fontSize: 8.2,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textColor: schema.primaryColor,
        textAlign: 'left',
        lineHeight: 1.2,
        textTransform: 'none',
        backgroundColor: 'transparent',
        borderStyle: 'none',
        borderColor: '#0F172A',
        borderWidth: 0,
        borderRadius: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 2, bottom: 4 },
      },
      specialProps: {
        tableNumber: pageData.tableData.number,
        captionPrefix: `Bảng ${pageData.tableData.number}`,
        captionText: pageData.tableData.title,
        tableHeaders: pageData.tableData.headers,
        tableRows: pageData.tableData.rows,
        tableSource: pageData.tableData.source,
        zebraStriping: true,
        tableHeaderBackground: '#E5E5E5',
        tableBorderMode: 'booktabs',
      },
    });
  }

  // 3. Blocks (Headings, Subheadings, Paragraphs, References, Abbreviations)
  const rawBlocks =
    pageData.blocks && pageData.blocks.length > 0
      ? pageData.blocks
      : [...(pageData.column1 || []), ...(pageData.column2 || [])];

  rawBlocks.forEach((block, idx) => {
    // Reference entry (e.g. "1. Pilotto AF...")
    if (/^\d+\.\s/.test(block.content)) {
      const refId = `elem_demo_p${page}_ref_${idx}`;
      pageElements.push({
        id: refId,
        type: 'references-block',
        name: `Tài liệu tham khảo`,
        zoneId: zone.id,
        order: 10 + idx,
        spanColumns: false,
        visible: true,
        styling: baseRef?.styling || {
          fontFamily: 'Arial',
          fontSize: 7.4,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textColor: '#1E293B',
          textAlign: 'left',
          lineHeight: 1.22,
          textTransform: 'none',
          backgroundColor: 'transparent',
          borderStyle: 'none',
          borderColor: '#CBD5E1',
          borderWidth: 0,
          borderRadius: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          margin: { top: 0, bottom: 2 },
        },
        specialProps: {
          customContentSample: block.content,
        },
      });
      return;
    }

    // Abbreviation or Grant entry
    if (
      block.content.includes('DANH MỤC CÁC TỪ VIẾT TẮT') ||
      block.content.includes('LỜI CẢM ƠN') ||
      /^[A-Za-z0-9\-\/]{2,10}:\s/.test(block.content)
    ) {
      const grantId = `elem_demo_p${page}_grant_${idx}`;
      pageElements.push({
        id: grantId,
        type: 'custom-field',
        name: block.content.slice(0, 30),
        zoneId: zone.id,
        order: 10 + idx,
        spanColumns: false,
        visible: true,
        styling: baseGrant?.styling || {
          fontFamily: 'Arial',
          fontSize: 7.5,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textColor: '#334155',
          textAlign: 'justify',
          lineHeight: 1.25,
          textTransform: 'none',
          backgroundColor: 'transparent',
          borderStyle: 'none',
          borderColor: '#CBD5E1',
          borderWidth: 0,
          borderRadius: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          margin: { top: 1, bottom: 1 },
        },
        specialProps: {
          customContentSample: block.content,
        },
      });
      return;
    }

    // Heading
    if (block.type === 'heading') {
      const hId = `elem_demo_p${page}_h_${idx}`;
      pageElements.push({
        id: hId,
        type: 'heading',
        name: `Tiêu đề: ${block.content.slice(0, 25)}...`,
        zoneId: zone.id,
        order: 10 + idx,
        spanColumns: false,
        visible: true,
        styling: baseHeading?.styling || {
          fontFamily: 'Arial',
          fontSize: 9.5,
          fontWeight: 'bold',
          fontStyle: 'normal',
          textColor: schema.primaryColor,
          textAlign: 'left',
          lineHeight: 1.25,
          textTransform: 'uppercase',
          backgroundColor: 'transparent',
          borderStyle: 'none',
          borderColor: schema.primaryColor,
          borderWidth: 0,
          borderRadius: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          margin: { top: 4, bottom: 2 },
          accentBar: false,
        },
        specialProps: {
          headingLevel: 1,
          customContentSample: demoContentOverrides[hId] ?? block.content,
          originalBaseId: baseHeading?.id || 'elem_h1',
        },
      });
      return;
    }

    // Subheading
    if (block.type === 'subheading') {
      const subhId = `elem_demo_p${page}_subh_${idx}`;
      pageElements.push({
        id: subhId,
        type: 'heading',
        name: `Tiêu đề phụ: ${block.content.slice(0, 25)}...`,
        zoneId: zone.id,
        order: 10 + idx,
        spanColumns: false,
        visible: true,
        styling: {
          fontFamily: baseBody?.styling?.fontFamily || 'Minion Pro',
          fontSize: baseBody?.styling?.fontSize || 8.55,
          fontWeight: 'bold',
          fontStyle: 'normal',
          textColor: '#1A1A1A',
          textAlign: 'left',
          lineHeight: 1.25,
          textTransform: 'none',
          backgroundColor: 'transparent',
          borderStyle: 'none',
          borderColor: '#CBD5E1',
          borderWidth: 0,
          borderRadius: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          margin: { top: 3, bottom: 1 },
          accentBar: false,
        },
        specialProps: {
          headingLevel: 2,
          customContentSample: demoContentOverrides[subhId] ?? block.content,
          originalBaseId: baseHeading?.id || 'elem_h1',
        },
      });
      return;
    }

    // Standard body paragraph
    const bodyId = `elem_demo_p${page}_body_${idx}`;
    pageElements.push({
      id: bodyId,
      type: 'body-text',
      name: `Đoạn văn (${idx + 1})`,
      zoneId: zone.id,
      order: 10 + idx,
      spanColumns: false,
      visible: true,
      styling: baseBody?.styling || {
        fontFamily: 'Minion Pro',
        fontSize: 8.55,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textColor: '#1A1A1A',
        textAlign: 'justify',
        lineHeight: 1.22,
        textTransform: 'none',
        backgroundColor: 'transparent',
        borderStyle: 'none',
        borderColor: '#CBD5E1',
        borderWidth: 0,
        borderRadius: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 0, bottom: 2 },
        firstLineIndent: 0,
        dropCap: false,
      },
      specialProps: {
        customContentSample: demoContentOverrides[bodyId] ?? block.content,
        originalBaseId: baseBody?.id || 'elem_body_p',
      },
    });
  });

  return pageElements;
}

/**
 * Universal Live A4 Preview
 * Interactive WYSIWYG paper preview with real-time zone grids, headers, footers, 13-page navigation, and PDF comparison
 */
export const UniversalLiveA4Preview: React.FC<UniversalLiveA4PreviewProps> = ({
  initialPage = 1,
  schema,
  selectedElementId: _selectedElementId,
  onSelectElement,
  onSelectZone,
  onSelectHeader,
  onOpenGridBuilder: _onOpenGridBuilder,
  showGridOverlay = false,
  onToggleGridOverlay,
  onAddZoneWithArea,
  onUpdateZoneArea,
  onUpdateZoneSecondaryArea,
  onDeleteZone,
  onUpdateZoneName,
  onDrillDownZone,
  selectedZoneId = null,
  focusedZoneId = null,
  onFocusZone,
  onAddSubZoneWithArea,
  onUpdateSubZone,
  onDeleteSubZone,
  selectedSubZoneId = null,
  onSelectSubZone,
  onAssignElementToZone,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElement,
  onNavigateToStep,
  className = '',
  isStep4 = false,
  demoSpecialElements = false,
  onToggleDemoSpecialElements,
  isExpanded = false,
  onToggleExpand,
}) => {
  const [showPdfCompare, setShowPdfCompare] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(50);
  const [dragOverZoneId, setDragOverZoneId] = useState<string | null>(null);

  // Direct Inline Text Editing on Preview (Double-Click)
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editingFlowMeta, setEditingFlowMeta] = useState<{
    baseId: string;
    flowPart?: number;
    siblingPartText?: string;
  } | null>(null);
  const [demoContentOverrides, setDemoContentOverrides] = useState<Record<string, string>>({});

  // Right-Click Floating Style Context Menu (Word / Excel Style)
  const [contextMenu, setContextMenu] = useState<{
    element: SemanticElement;
    position: { x: number; y: number };
  } | null>(null);

  const handleStartInlineEdit = (el: SemanticElement) => {
    const sp = el.specialProps as any;
    const baseId = sp?.originalBaseId || el.id.replace(/_flow_p[12]$/, '');

    setEditingFlowMeta({
      baseId,
      flowPart: sp?.flowPart,
      siblingPartText: sp?.siblingPartText,
    });

    const initialText =
      el.specialProps?.customContentSample ??
      ((el.specialProps as any)?.authorNames || el.name || '');
    setEditText(initialText);
    setEditingElementId(el.id);
  };

  const handleSaveInlineEdit = (elementId: string, newText: string) => {
    // Merge multi-column flow parts cleanly so text in the other column is preserved
    let finalContent = newText;
    if (editingFlowMeta?.flowPart === 1 && editingFlowMeta.siblingPartText) {
      finalContent = `${newText.trim()} ${editingFlowMeta.siblingPartText.trim()}`;
    } else if (editingFlowMeta?.flowPart === 2 && editingFlowMeta.siblingPartText) {
      finalContent = `${editingFlowMeta.siblingPartText.trim()} ${newText.trim()}`;
    }

    // If it's a demo block on pages 2-13, isolate and store in demoContentOverrides
    if (elementId.startsWith('elem_demo_')) {
      const demoId = elementId.replace(/_flow_p[12]$/, '');
      setDemoContentOverrides((prev) => ({
        ...prev,
        [demoId]: finalContent,
      }));
      setEditingElementId(null);
      setEditingFlowMeta(null);
      toast.success('Đã lưu nội dung', 'Đã cập nhật văn bản');
      return;
    }

    const baseId = editingFlowMeta?.baseId || elementId.replace(/_flow_p[12]$/, '');
    const el = schema.elements.find((e) => e.id === baseId);

    if (el) {
      const isTitleOrHeading = el.type === 'heading' || el.type === 'article-title';
      const isAuthor = el.type === 'author-block';

      onUpdateElement?.(baseId, {
        specialProps: {
          ...el.specialProps,
          customContentSample: finalContent,
          ...(isAuthor ? ({ authorNames: finalContent } as any) : {}),
        },
        ...(isTitleOrHeading ? { name: finalContent.slice(0, 60) } : {}),
      });
      toast.success('Đã lưu nội dung', `Đã cập nhật văn bản cho "${el.name}"`);
    } else {
      toast.info('Đã cập nhật hiển thị', 'Nội dung xem trước đã được làm mới');
    }

    setEditingElementId(null);
    setEditingFlowMeta(null);
  };

  const handleCancelInlineEdit = () => {
    setEditingElementId(null);
    setEditingFlowMeta(null);
  };

  const handleContextMenuElement = (el: SemanticElement, e: React.MouseEvent) => {
    setContextMenu({
      element: el,
      position: { x: e.clientX, y: e.clientY },
    });
  };
  // Dynamically calculate all contiguous pages covered by this template's zones
  const computeTemplatePages = (schemaZones: LayoutZoneConfig[], initPage = 1): number[] => {
    const pageSet = new Set<number>([1]);
    if (initPage && initPage >= 1) pageSet.add(initPage);
    schemaZones.forEach((z) => {
      const p = z.page || (z.pageScope === 'subsequent-pages' ? 2 : 1);
      if (typeof p === 'number' && p >= 1) {
        pageSet.add(p);
      }
    });
    const maxPage = Math.max(1, ...Array.from(pageSet));
    const pages: number[] = [];
    for (let p = 1; p <= maxPage; p++) {
      pages.push(p);
    }
    return pages;
  };

  const [currentPage, setCurrentPage] = useState<number>(initialPage || 1);
  const [visiblePages, setVisiblePages] = useState<number[]>(() =>
    computeTemplatePages(schema.zones, initialPage || 1)
  );

  // Sync visible pages when template changes so all existing template pages are shown immediately
  useEffect(() => {
    const allPages = computeTemplatePages(schema.zones, initialPage || 1);
    setVisiblePages((prev) => {
      const merged = Array.from(new Set([...prev, ...allPages])).sort((a, b) => a - b);
      return merged;
    });
  }, [schema.id]);

  const handleAddVisiblePage = () => {
    const lastPage = visiblePages[visiblePages.length - 1] || 1;
    if (lastPage < 13) {
      setVisiblePages((prev) => [...prev, lastPage + 1]);
    }
  };

  const handleRemoveVisiblePage = (pageNum: number) => {
    if (visiblePages.length > 1) {
      setVisiblePages((prev) => prev.filter((p) => p !== pageNum));
    }
  };

  // Sync initial page when initialPage prop changes
  useEffect(() => {
    if (initialPage && initialPage >= 1 && initialPage <= 13) {
      setCurrentPage(initialPage);
    }
  }, [initialPage]);

  // Enable keyboard left/right arrow and PageUp/PageDown navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setCurrentPage((prev) => Math.min(13, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentPage((prev) => Math.max(1, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (showPdfCompare) {
      setZoomLevel(isExpanded ? 64 : 56);
    }
  }, [isExpanded]);

  const isDemoID630 = schema.id === 'vnuhcm_health_sciences_id630';

  const { pageArchitecture, zones, elements, primaryColor, gridConfig, floatingRules } = schema;
  const { margins, headers, pageNumbering } = pageArchitecture;

  // 1. Dynamic Paper Dimensions (Portrait vs Landscape, Presets vs Custom)
  const baseDim = isDemoID630
    ? { width: 216.15, height: 279.4, name: 'VNUHCM (8.51" x 11")' }
    : pageArchitecture.size === 'Custom' && pageArchitecture.customDimensions
      ? {
          width: pageArchitecture.customDimensions.width || 210,
          height: pageArchitecture.customDimensions.height || 297,
          name: 'Tùy chỉnh',
        }
      : STANDARD_PAPER_SIZES[pageArchitecture.size] || STANDARD_PAPER_SIZES['A4'];

  const isLandscape = pageArchitecture.orientation === 'landscape';
  const widthMm = isLandscape ? baseDim.height : baseDim.width;
  const heightMm = isLandscape ? baseDim.width : baseDim.height;

  const pageWidthPx = Math.round(widthMm * MM_TO_PX);
  const pageHeightPx = Math.round(heightMm * MM_TO_PX);

  // Scaled margin paddings in pixels
  const padTopPx = Math.max(12, Math.round(margins.top * MM_TO_PX));
  const padBottomPx = Math.max(14, Math.round(margins.bottom * MM_TO_PX));
  const padLeftPx = Math.max(14, Math.round(margins.left * MM_TO_PX));
  const padRightPx = Math.max(14, Math.round(margins.right * MM_TO_PX));

  const contentWidthPx = Math.max(100, pageWidthPx - padLeftPx - padRightPx);
  const headerHeightPx = 36;
  const contentTopPx = padTopPx + headerHeightPx + 8;
  const footerHeightPx = pageNumbering.position !== 'none' ? 24 : 0;
  const contentBottomMarginPx = padBottomPx + footerHeightPx + 8;
  const contentHeightPx = Math.max(300, pageHeightPx - contentTopPx - contentBottomMarginPx);

  const effectiveGridConfig = gridConfig || {
    enabled: true,
    columns: 4,
    rows: 5,
    rowGap: 8,
    colGap: 8,
    gapSync: true,
    unit: 'px',
  };

  const unitMultiplier = effectiveGridConfig.unit === 'mm' ? 3.78 : 1;
  const colGapPx = (effectiveGridConfig.colGap || 8) * unitMultiplier;
  const rowGapPx = (effectiveGridConfig.rowGap || 8) * unitMultiplier;

  const activeElements = demoSpecialElements
    ? getSpecialElementsDemoList(zones, primaryColor, floatingRules)
    : elements;

  // The Live A4 Paper Canvas JSX
  const renderLiveA4Canvas = (
    pageNum: number = currentPage,
    origin: 'top center' | 'top left' = 'top center'
  ) => (
    <div
      style={{
        width: `${pageWidthPx}px`,
        minHeight: `${pageHeightPx}px`,
        height: `${pageHeightPx}px`,
        transform: `scale(${zoomLevel / 100})`,
        transformOrigin: origin,
        transition:
          'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s ease-out',
      }}
      className="bg-white shadow-2xl rounded-sm border border-slate-300 relative text-[#1A1A1A] select-text flex-shrink-0 overflow-hidden"
    >
      {/* Dynamic Template Preview (Page 1 Frontmatter + Pages 2-13 Multi-Page Continuous Grid Flow) */}
      <PreviewHeader
        headers={headers}
        topPx={padTopPx}
        leftPx={padLeftPx}
        widthPx={contentWidthPx}
        heightPx={headerHeightPx}
        onSelectHeader={onSelectHeader}
        pageNumber={pageNum}
        primaryColor={primaryColor}
      />

      <div
        style={{
          position: 'absolute',
          top: `${contentTopPx}px`,
          left: `${padLeftPx}px`,
          width: `${contentWidthPx}px`,
          height: `${contentHeightPx}px`,
          display: 'grid',
          gridTemplateColumns: `repeat(${effectiveGridConfig.columns || 4}, minmax(0, 1fr))`,
          gridTemplateRows: showGridOverlay
            ? `repeat(${effectiveGridConfig.rows || 5}, minmax(0, 1fr))`
            : (() => {
                const totalRows = effectiveGridConfig.rows || 5;
                const autoRowIndices = new Set<number>();
                zones
                  .filter((zone) => isZoneOnPage(zone, pageNum))
                  .forEach((zone) => {
                    const isAutoFit =
                      zone.overflowBehavior === 'auto-fit' ||
                      zone.autoFitHeight ||
                      zone.heightMode === 'auto';
                    if (isAutoFit) {
                      const start = zone.gridArea?.rowStart || 1;
                      const span = zone.gridArea?.rowSpan || 1;
                      for (let r = start; r < start + span && r <= totalRows; r++) {
                        autoRowIndices.add(r);
                      }
                    }
                  });
                if (autoRowIndices.size === 0 || autoRowIndices.size >= totalRows) {
                  return `repeat(${totalRows}, minmax(0, 1fr))`;
                }
                return Array.from({ length: totalRows }, (_, i) =>
                  autoRowIndices.has(i + 1) ? 'auto' : 'minmax(0, 1fr)'
                ).join(' ');
              })(),
          columnGap: `${colGapPx}px`,
          rowGap: `${rowGapPx}px`,
        }}
        className="relative pointer-events-auto z-10"
      >
        {zones
          .filter((zone) => isZoneOnPage(zone, pageNum))
          .sort((a, b) => a.order - b.order)
          .map((zone) => {
            const zoneElements = getElementsForPageZone(
              zone,
              pageNum,
              schema,
              activeElements,
              demoContentOverrides
            );

            const gridArea = zone.gridArea || {
              rowStart: 1,
              colStart: 1,
              rowSpan: 1,
              colSpan: effectiveGridConfig.columns || 4,
            };

            const hasSecondary = Boolean(zone.secondaryGridArea);
            const isClip = zone.overflowBehavior === 'clip';
            const isOverflowUp = zone.overflowBehavior === 'overflow-up';

            const { primaryElements, secondaryElements } = splitZoneElementsForFlow(
              zoneElements,
              zone
            );

            const primaryClass = hasSecondary
              ? 'h-full overflow-hidden'
              : isClip
                ? 'h-full overflow-hidden'
                : isOverflowUp
                  ? 'h-auto overflow-visible z-20'
                  : 'h-auto overflow-visible';

            const secondaryClass = hasSecondary || isClip
              ? 'h-full overflow-hidden'
              : isOverflowUp
                ? 'min-h-full h-auto overflow-visible z-20'
                : 'min-h-full h-auto overflow-visible';

            const isDropTarget = dragOverZoneId === zone.id;

            return (
              <React.Fragment key={zone.id}>
                <div
                  id={`preview-zone-${zone.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectZone?.(zone.id);
                  }}
                  onDragOver={(e) => {
                    if (
                      e.dataTransfer.types.includes('application/structpaper-element-id') ||
                      e.dataTransfer.types.includes('text/plain')
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'copy';
                      if (dragOverZoneId !== zone.id) setDragOverZoneId(zone.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (dragOverZoneId === zone.id) setDragOverZoneId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverZoneId(null);
                    const elemId =
                      e.dataTransfer.getData('application/structpaper-element-id') ||
                      e.dataTransfer.getData('text/plain');
                    if (elemId && onAssignElementToZone) {
                      onAssignElementToZone(elemId, zone.id);
                    }
                  }}
                  style={{
                    gridRow: `${gridArea.rowStart} / span ${gridArea.rowSpan}`,
                    gridColumn: `${gridArea.colStart} / span ${gridArea.colSpan}`,
                    alignSelf: !hasSecondary && isOverflowUp ? 'end' : undefined,
                  }}
                  className={`relative w-full min-h-0 min-w-0 px-1 pt-1 pb-0 ${primaryClass} transition-colors ${
                    isDropTarget ? 'ring-2 ring-[#78C841] bg-[#78C841]/15 rounded-xl shadow-lg' : ''
                  }`}
                >
                  {isDropTarget && (
                    <div className="absolute inset-0 bg-[#78C841]/25 border-2 border-dashed border-[#78C841] rounded-xl z-50 flex items-center justify-center p-2 text-center pointer-events-none animate-fadeIn backdrop-blur-2xs shadow-xl">
                      <div className="bg-white/95 text-[#14532D] text-xs font-black px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 border border-[#78C841]/50">
                        <span className="text-sm">📥</span>
                        <span>Thả vào {zone.name}</span>
                      </div>
                    </div>
                  )}

                  <PreviewZoneContent
                    zone={zone}
                    zoneElements={primaryElements}
                    allElements={schema.elements}
                    primaryColor={primaryColor}
                    floatingRules={floatingRules}
                    unitMultiplier={unitMultiplier}
                    onSelectElement={onSelectElement}
                    onUpdateElement={onUpdateElement}
                    onDuplicateElement={onDuplicateElement}
                    onDeleteElement={onDeleteElement}
                    onNavigateToStep={onNavigateToStep}
                    showGridOverlay={showGridOverlay}
                    editingElementId={editingElementId}
                    editText={editText}
                    setEditText={setEditText}
                    onStartInlineEdit={handleStartInlineEdit}
                    onSaveInlineEdit={handleSaveInlineEdit}
                    onCancelInlineEdit={handleCancelInlineEdit}
                    onContextMenuElement={handleContextMenuElement}
                  />
                </div>

                {zone.secondaryGridArea && (
                  <div
                    id={`preview-zone-${zone.id}-secondary`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectZone?.(zone.id);
                    }}
                    onDragOver={(e) => {
                      if (
                        e.dataTransfer.types.includes('application/structpaper-element-id') ||
                        e.dataTransfer.types.includes('text/plain')
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'copy';
                        if (dragOverZoneId !== zone.id) setDragOverZoneId(zone.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      if (dragOverZoneId === zone.id) setDragOverZoneId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverZoneId(null);
                      const elemId =
                        e.dataTransfer.getData('application/structpaper-element-id') ||
                        e.dataTransfer.getData('text/plain');
                      if (elemId && onAssignElementToZone) {
                        onAssignElementToZone(elemId, zone.id);
                      }
                    }}
                    style={{
                      gridRow: `${zone.secondaryGridArea.rowStart} / span ${zone.secondaryGridArea.rowSpan}`,
                      gridColumn: `${zone.secondaryGridArea.colStart} / span ${zone.secondaryGridArea.colSpan}`,
                      alignSelf: isOverflowUp ? 'end' : undefined,
                    }}
                    className={`relative w-full min-h-0 min-w-0 px-1 pt-0 pb-1 ${secondaryClass} transition-colors ${
                      isDropTarget ? 'ring-2 ring-[#78C841] bg-[#78C841]/15 rounded-xl shadow-lg' : ''
                    }`}
                  >
                    {isDropTarget && (
                      <div className="absolute inset-0 bg-[#78C841]/25 border-2 border-dashed border-[#78C841] rounded-xl z-50 flex items-center justify-center p-2 text-center pointer-events-none animate-fadeIn backdrop-blur-2xs shadow-xl">
                        <div className="bg-white/95 text-[#14532D] text-xs font-black px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 border border-[#78C841]/50">
                          <span className="text-sm">📥</span>
                          <span>Thả vào {zone.name}</span>
                        </div>
                      </div>
                    )}
                    <PreviewZoneContent
                      zone={zone}
                      zoneElements={secondaryElements}
                      allElements={schema.elements}
                      primaryColor={primaryColor}
                      floatingRules={floatingRules}
                      unitMultiplier={unitMultiplier}
                      onSelectElement={onSelectElement}
                      onUpdateElement={onUpdateElement}
                      onDuplicateElement={onDuplicateElement}
                      onDeleteElement={onDeleteElement}
                      onNavigateToStep={onNavigateToStep}
                      showGridOverlay={showGridOverlay}
                      editingElementId={editingElementId}
                      editText={editText}
                      setEditText={setEditText}
                      onStartInlineEdit={handleStartInlineEdit}
                      onSaveInlineEdit={handleSaveInlineEdit}
                      onCancelInlineEdit={handleCancelInlineEdit}
                      onContextMenuElement={handleContextMenuElement}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
      </div>

      <PreviewFooter
        pageNumbering={pageNumbering}
        floatingRules={floatingRules}
        demoSpecialElements={demoSpecialElements}
        padLeftPx={padLeftPx}
        contentWidthPx={contentWidthPx}
        footerHeightPx={footerHeightPx}
        marginBottomMm={margins.bottom}
        mmToPx={MM_TO_PX}
        onSelectHeader={onSelectHeader}
        footers={pageArchitecture.footers}
        pageNumber={pageNum}
        primaryColor={primaryColor}
      />


      {/* Interactive Paper Grid Overlay - Active when toggled ON or when focused on a zone */}
      {(showGridOverlay || Boolean(focusedZoneId)) && onAddZoneWithArea && onUpdateZoneArea && onDeleteZone && (
        <PaperGridOverlay
          gridConfig={effectiveGridConfig}
          zones={zones.filter((zone) => isZoneOnPage(zone, pageNum))}
          allZones={zones}
          selectedZoneId={selectedZoneId}
          focusedZoneId={focusedZoneId}
          onSelectZone={onSelectZone || (() => {})}
          onAddZoneWithArea={(area) => onAddZoneWithArea(area, pageNum)}
          onUpdateZoneArea={onUpdateZoneArea}
          onUpdateZoneSecondaryArea={onUpdateZoneSecondaryArea}
          onDeleteZone={onDeleteZone}
          onUpdateZoneName={onUpdateZoneName}
          onDrillDownZone={(zoneId) => {
            onFocusZone?.(zoneId);
            onDrillDownZone?.(zoneId);
          }}
          onAddSubZoneWithArea={onAddSubZoneWithArea}
          onUpdateSubZone={onUpdateSubZone}
          onDeleteSubZone={onDeleteSubZone}
          selectedSubZoneId={selectedSubZoneId}
          onSelectSubZone={onSelectSubZone}
          onAssignElementToZone={onAssignElementToZone}
          bounds={{
            top: contentTopPx,
            left: padLeftPx,
            width: contentWidthPx,
            height: contentHeightPx,
          }}
        />
      )}

    </div>
  );

  return (
    <div
      className={`flex flex-col h-full bg-slate-200/50 rounded-2xl sm:rounded-3xl border border-black/5 overflow-hidden shadow-xs ${className}`}
    >
      {/* Top Preview Control Bar */}
      <PreviewControlBar
        showGridOverlay={showGridOverlay}
        onToggleGridOverlay={onToggleGridOverlay}
        isStep4={isStep4}
        demoSpecialElements={demoSpecialElements}
        onToggleDemoSpecialElements={onToggleDemoSpecialElements}
        zoomLevel={zoomLevel}
        onZoomIn={() => setZoomLevel((prev) => Math.min(130, prev + 10))}
        onZoomOut={() => setZoomLevel((prev) => Math.max(45, prev - 10))}
        onResetZoom={() => setZoomLevel(75)}
        showPdfCompare={showPdfCompare}
        onTogglePdfCompare={() => {
          setShowPdfCompare((prev) => {
            const next = !prev;
            setZoomLevel(next ? (isExpanded ? 64 : 56) : 75);
            return next;
          });
        }}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />

      {/* Main Document Canvas Viewport (Always Multi-Page Studio Flow) */}
      <div className="flex-1 overflow-auto p-3 sm:p-5 flex flex-wrap items-start justify-center gap-6 min-w-0">
          {visiblePages.map((pageNum) => (
            <div key={`multi-page-col-${pageNum}`} className="flex flex-col items-center flex-shrink-0">
              {/* Page Indicator Top Pill */}
              <div className="mb-2 text-xs font-bold text-slate-800 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-300 shadow-2xs flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#78C841] animate-pulse" />
                <span>
                  Trang {pageNum}: {pageNum === 1 ? 'Trang đầu / Bìa' : 'Thân bài & Cột nội dung'}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {pageNum === 1 ? 'first-page / all' : 'subsequent-pages'}
                </span>
                {visiblePages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveVisiblePage(pageNum)}
                    className="ml-1 text-slate-400 hover:text-red-500 cursor-pointer font-extrabold text-[12px] px-1 hover:bg-red-50 rounded"
                    title={`Ẩn Trang ${pageNum} khỏi bản vẽ`}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Page Canvas (Single or Side-by-side with PDF) */}
              {showPdfCompare ? (
                <div className="flex flex-row items-start gap-2.5 flex-shrink-0">
                  <div
                    style={{
                      width: `${Math.round(pageWidthPx * (zoomLevel / 100))}px`,
                      height: `${Math.round(pageHeightPx * (zoomLevel / 100))}px`,
                    }}
                    className="relative overflow-visible flex-shrink-0"
                  >
                    {renderLiveA4Canvas(pageNum, 'top left')}
                  </div>

                  <div
                    style={{
                      width: `${Math.round(pageWidthPx * (zoomLevel / 100))}px`,
                      height: `${Math.round(pageHeightPx * (zoomLevel / 100))}px`,
                    }}
                    className="relative overflow-visible flex-shrink-0"
                  >
                    <div
                      style={{
                        width: `${pageWidthPx}px`,
                        minHeight: `${pageHeightPx}px`,
                        height: `${pageHeightPx}px`,
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: 'top left',
                        transition: 'transform 0.15s ease-out',
                      }}
                      className="bg-white shadow-2xl rounded-sm border border-slate-300 relative overflow-hidden flex-shrink-0"
                    >
                      <img
                        key={`pdf-multi-page-${pageNum}`}
                        src={`/demo-assets/id630/pages/page-${pageNum}.png`}
                        alt={`Bản PDF Gốc Nhà Xuất Bản ID630 - Trang ${pageNum}`}
                        className="w-full h-full object-fill select-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    width: `${Math.round(pageWidthPx * (zoomLevel / 100))}px`,
                    height: `${Math.round(pageHeightPx * (zoomLevel / 100))}px`,
                  }}
                  className="relative overflow-visible flex-shrink-0"
                >
                  {renderLiveA4Canvas(pageNum, 'top left')}
                </div>
              )}
            </div>
          ))}

          {/* "+ Thêm Trang Tiếp Theo" Action Card (App Lime Theme) */}
          {visiblePages.length < 13 && (
            <div
              onClick={handleAddVisiblePage}
              style={{
                width: `${Math.round(pageWidthPx * (zoomLevel / 100))}px`,
                minHeight: `${Math.round(pageHeightPx * (zoomLevel / 100))}px`,
              }}
              className="border-2 border-dashed border-zinc-300 hover:border-[#78C841] bg-white/60 hover:bg-[#78C841]/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all hover:scale-[1.01] shadow-2xs group flex-shrink-0 mt-8"
              title="Thêm trang tiếp theo để quan sát và dàn trang"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#78C841]/20 group-hover:bg-[#78C841]/30 text-[#14532D] flex items-center justify-center mb-3 shadow-xs transition-colors">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="font-bold text-sm text-zinc-800 group-hover:text-[#14532D]">
                + Thêm Trang {visiblePages[visiblePages.length - 1] + 1}
              </span>
              <span className="text-[11px] text-zinc-500 mt-1 max-w-[200px]">
                Xem & dàn trang tiếp theo trực tiếp trên giấy
              </span>
            </div>
          )}
        </div>

      {/* Floating Style Context Menu (Word / Excel Toolbar style) */}
      {contextMenu && (
        <ElementStyleContextMenu
          element={contextMenu.element}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onUpdateElement={(id, updated) => {
            onUpdateElement?.(id, updated);
            setContextMenu((prev) =>
              prev && prev.element.id === id
                ? { ...prev, element: { ...prev.element, ...updated } }
                : prev
            );
          }}
          onStartInlineEdit={(el) => {
            handleStartInlineEdit(el);
            setContextMenu(null);
          }}
          onDuplicateElement={onDuplicateElement}
          onDeleteElement={onDeleteElement}
          onNavigateToStep={onNavigateToStep}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
};
export default UniversalLiveA4Preview;

