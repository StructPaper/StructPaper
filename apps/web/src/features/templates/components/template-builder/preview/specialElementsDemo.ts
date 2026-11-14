import {
  SemanticElement,
  FloatingElementsDesignRules,
  LayoutZoneConfig,
} from '@/types/template-builder';

/**
 * Generate full academic demonstration elements for floating and special elements showcase (Step 4 Demo Mode)
 * Focuses strictly on core academic components: Table, Figure, Equation, Citations & References, DOI/QR Code.
 */
export function getSpecialElementsDemoList(
  zones: LayoutZoneConfig[],
  _primaryColor: string,
  floatingRules?: FloatingElementsDesignRules
): SemanticElement[] {
  const sortedZones = [...zones].sort((a, b) => a.order - b.order);
  const titleZone = sortedZones[0] || { id: 'zone-header' };
  const primaryContentZone = sortedZones.find((z) => z.id !== titleZone.id) || titleZone;
  const secondaryContentZone =
    sortedZones.find((z) => z.id !== titleZone.id && z.id !== primaryContentZone.id) ||
    primaryContentZone;

  const isApa =
    floatingRules?.citation?.citationStyle === 'apa' ||
    floatingRules?.citation?.citationStyle === 'harvard';
  const isSuper = floatingRules?.citation?.inTextFormat === 'superscript';
  const inTextCite = isApa ? ' (Nguyen & Tran, 2025)' : isSuper ? '¹' : ' [1]';
  const inTextCite2 = isApa ? ' (VNUHCM Press, 2024)' : isSuper ? '²' : ' [2]';

  return [
    {
      id: 'demo-title',
      name: 'Tiêu đề & Chuyên đề bài báo',
      type: 'article-title',
      zoneId: titleZone.id,
      order: 1,
      spanColumns: true,
      visible: true,
      styling: {
        fontFamily: 'Arial',
        fontSize: 14.5,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textColor: '#0F172A',
        textAlign: 'center',
        lineHeight: 1.25,
        textTransform: 'uppercase',
        backgroundColor: 'transparent',
        borderStyle: 'none',
        borderWidth: 0,
        borderColor: 'transparent',
        padding: { top: 3, bottom: 3, left: 0, right: 0 },
        margin: { top: 0, bottom: 6 },
        borderRadius: 0,
      },
      specialProps: {
        supportBilingual: true,
        bilingualLabel: 'Showcase of Master Academic Floating Elements in Journal Layout',
        bilingualFontSize: 9,
      },
    },
    {
      id: 'demo-body',
      name: 'Đoạn văn trích dẫn (Body Text with Citations)',
      type: 'body-text',
      zoneId: primaryContentZone.id,
      order: 2,
      spanColumns: false,
      visible: true,
      styling: {
        fontFamily: 'Times New Roman',
        fontSize: 8.5,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textColor: '#1E293B',
        textAlign: 'justify',
        lineHeight: 1.35,
        textTransform: 'none',
        backgroundColor: 'transparent',
        borderStyle: 'none',
        borderWidth: 0,
        borderColor: 'transparent',
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        margin: { top: 2, bottom: 4 },
        borderRadius: 0,
        firstLineIndent: 4,
      },
      specialProps: {
        customContentSample: `Các nghiên cứu bóc tách cấu trúc tài liệu khoa học gần đây${inTextCite} đã chứng minh việc kết hợp phân tích cú pháp OpenXML nội bộ với mô hình ngôn ngữ lớn cho phép bảo toàn trọn vẹn đối tượng đồ họa vector và công thức toán học${inTextCite2}.`,
      },
    },
    {
      id: 'demo-table',
      name: 'Bảng biểu thực nghiệm (Table)',
      type: 'table-box',
      zoneId: primaryContentZone.id,
      order: 3,
      spanColumns: false,
      visible: true,
      styling: {
        fontFamily: floatingRules?.table?.captionFontFamily || 'Times New Roman',
        fontSize: 7.5,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textColor: '#0F172A',
        textAlign: 'left',
        lineHeight: 1.25,
        textTransform: 'none',
        backgroundColor: 'transparent',
        borderStyle: 'none',
        borderWidth: 0,
        borderColor: 'transparent',
        padding: { top: 1, bottom: 1, left: 0, right: 0 },
        margin: { top: 3, bottom: 5 },
        borderRadius: 0,
      },
      specialProps: {
        tableBorderMode: floatingRules?.table?.borderMode,
        zebraStriping: floatingRules?.table?.zebraStriping,
        captionPosition: floatingRules?.table?.captionPosition,
        captionPrefix: floatingRules?.table?.captionPrefix || 'Bảng 1',
        captionText: 'Độ chính xác phân vùng và thời gian xử lý qua các tập mẫu thử nghiệm',
        tableHeaderBackground: floatingRules?.table?.headerBackground,
        tableFootnote: 'Ghi chú: p < 0.01 theo phân tích thống kê so sánh đa biến.',
      },
    },
    {
      id: 'demo-equation',
      name: 'Công thức Toán học (Equation)',
      type: 'equation-box',
      zoneId: primaryContentZone.id,
      order: 4,
      spanColumns: false,
      visible: true,
      styling: {
        fontFamily: floatingRules?.equation?.fontFamily || 'Times New Roman',
        fontSize: floatingRules?.equation?.fontSize || 9,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textColor: '#0F172A',
        textAlign: floatingRules?.equation?.alignment || 'center',
        lineHeight: 1.3,
        textTransform: 'none',
        backgroundColor: '#F8FAFC',
        borderStyle: 'none',
        borderWidth: 0,
        borderColor: 'transparent',
        padding: { top: 2, bottom: 2, left: 3, right: 3 },
        margin: { top: 3, bottom: 5 },
        borderRadius: 4,
      },
      specialProps: {
        equationNumber:
          floatingRules?.equation?.numberingFormat === 'none'
            ? ''
            : floatingRules?.equation?.numberingFormat || '(1)',
        equationLatex:
          '\\mathcal{L}_{total} = \\alpha \\mathcal{L}_{struct} + \\beta \\mathcal{L}_{sem} + \\gamma \\|\\mathbf{W}\\|_2^2',
      },
    },
    {
      id: 'demo-figure',
      name: 'Hình ảnh sơ đồ (Figure)',
      type: 'figure-box',
      zoneId: secondaryContentZone.id,
      order: 5,
      spanColumns: false,
      visible: true,
      styling: {
        fontFamily: floatingRules?.figure?.captionFontFamily || 'Arial',
        fontSize: 7.5,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textColor: '#0F172A',
        textAlign: floatingRules?.figure?.figureAlignment || 'center',
        lineHeight: 1.25,
        textTransform: 'none',
        backgroundColor: 'transparent',
        borderStyle: 'none',
        borderWidth: 0,
        borderColor: 'transparent',
        padding: { top: 1, bottom: 1, left: 0, right: 0 },
        margin: { top: 3, bottom: 5 },
        borderRadius: 0,
      },
      specialProps: {
        captionPosition: floatingRules?.figure?.captionPosition,
        captionPrefix: floatingRules?.figure?.captionPrefix || 'Hình 1',
        captionText: 'Sơ đồ luồng xử lý và trích xuất cấu trúc văn bản học thuật',
        figureSubfigures: floatingRules?.figure?.showSubfiguresSupport,
        figureSource: 'Nguồn: Nhóm tác giả thực hiện (2025)',
      },
    },
    {
      id: 'demo-link',
      name: 'Liên kết DOI & QR Code',
      type: 'link-box',
      zoneId: secondaryContentZone.id,
      order: 6,
      spanColumns: false,
      visible: true,
      styling: {
        fontFamily: 'Arial',
        fontSize: 7.5,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textColor: '#0F172A',
        textAlign: 'left',
        lineHeight: 1.25,
        textTransform: 'none',
        backgroundColor: 'transparent',
        borderStyle: 'none',
        borderWidth: 0,
        borderColor: 'transparent',
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        margin: { top: 2, bottom: 4 },
        borderRadius: 0,
      },
      specialProps: {
        linkType: 'doi',
        linkLabel: 'Định danh điện tử DOI',
        linkUrl: 'https://doi.org/10.32508/stdj.v28i2.1234',
        showQrCode: floatingRules?.linkDoi?.showQrCodeOnPrint ?? true,
      },
    },
    {
      id: 'demo-references',
      name: 'Danh mục Tài liệu tham khảo',
      type: 'references-block',
      zoneId: secondaryContentZone.id,
      order: 7,
      spanColumns: false,
      visible: true,
      styling: {
        fontFamily: floatingRules?.citation?.fontFamily || 'Times New Roman',
        fontSize: floatingRules?.citation?.fontSize || 7.5,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textColor: '#1E293B',
        textAlign: 'left',
        lineHeight: 1.3,
        textTransform: 'none',
        backgroundColor: 'transparent',
        borderStyle: 'none',
        borderWidth: 0,
        borderColor: 'transparent',
        padding: { top: 1, bottom: 1, left: 0, right: 0 },
        margin: { top: 3, bottom: 3 },
        borderRadius: 0,
      },
      specialProps: {
        referenceHeadingText: 'Tài liệu tham khảo',
      },
    },
  ];
}
