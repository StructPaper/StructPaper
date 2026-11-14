'use client';

import React from 'react';
import { ID630_DEMO_PAGES, ID630DemoPage, ID630PageBlock } from '@/lib/template-builder/id630-demo-pages';

interface ID630AuthenticPageRendererProps {
  pageNumber: number;
  primaryColor?: string;
}

// Function to style citations and superscripts in primaryColor (LaTeX citecolor=titlecolor)
const renderTextWithCitations = (text: string, primaryColor: string): React.ReactNode => {
  if (!text) return null;
  // Matches superscript citations (¹, ², ³, ⁴, ⁵, ⁶, ⁷, ⁸, ⁹, ⁰, ⁻, *, °, and commas/spaces between them)
  // as well as bracketed citations like [1], [11], [12,13], [1-3]
  const citationRegex = /([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾*°]+(?:[,\s]*[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾*°]+)*|\[\d+(?:[–\-,]\s*\d+)*\])/g;

  const parts = text.split(citationRegex);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <span
          key={i}
          style={{ color: primaryColor }}
          className="font-medium select-text"
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

// Function to render an individual block with LaTeX-accurate indentation and styling
const renderBlock = (
  block: ID630PageBlock,
  idx: number,
  blocks: ID630PageBlock[],
  primaryColor: string
) => {
  // True \section* heading in LaTeX: Sans-serif, Bold, Uppercase, Primary Blue
  if (block.type === 'heading') {
    return (
      <h2
        key={idx}
        style={{ color: primaryColor }}
        className="font-sans font-bold text-[9.5pt] uppercase leading-[1.25] tracking-tight first:mt-0 mt-2 mb-1 break-inside-avoid"
      >
        {block.content}
      </h2>
    );
  }

  // True \textbf{...} subheading in LaTeX: Serif, Bold, #1A1A1A (Black), Normal Case, 8.8pt body size
  if (block.type === 'subheading') {
    return (
      <h3
        key={idx}
        className="font-serif font-bold text-[8.55pt] leading-[1.25] text-[#1A1A1A] first:mt-0 mt-2 mb-0.5 break-inside-avoid"
      >
        {renderTextWithCitations(block.content, primaryColor)}
      </h3>
    );
  }

  // Vancouver references format (e.g. "1. Pilotto AF...")
  if (/^\d+\.\s/.test(block.content)) {
    const match = block.content.match(/^(\d+\.)\s+(.*)$/);
    if (match) {
      const num = match[1];
      const text = match[2];
      const doiIndex = text.indexOf('http');
      const textPart = doiIndex !== -1 ? text.slice(0, doiIndex) : text;
      const urlPart = doiIndex !== -1 ? text.slice(doiIndex) : '';

      return (
        <div key={idx} className="flex items-start gap-1 text-[7.4pt] leading-[1.22] mb-1.5 text-left font-sans text-slate-800">
          <span style={{ color: primaryColor }} className="font-bold flex-shrink-0 font-sans w-3.5 text-right">
            {num}
          </span>
          <div className="flex-1">
            <span>{textPart}</span>
            {urlPart && (
              <span style={{ color: primaryColor }} className="underline break-all font-sans font-semibold">
                {urlPart}
              </span>
            )}
          </div>
        </div>
      );
    }
  }

  // Abbreviations format (e.g. "ASA: Acetylsalicylic acid (aspirin)")
  if (/^[A-Za-z0-9\-\/]{2,10}:\s/.test(block.content)) {
    const colonIdx = block.content.indexOf(':');
    const abbr = block.content.slice(0, colonIdx);
    const desc = block.content.slice(colonIdx + 1);
    return (
      <div key={idx} className="text-[7.5pt] leading-[1.22] mb-0.5 font-sans text-slate-800">
        <strong className="font-bold text-slate-950">{abbr}:</strong>
        {desc}
      </div>
    );
  }

  // Markdown-like bold prefix (e.g. "**Tác giả Hà Vũ:** ...")
  if (block.content.startsWith('**') && block.content.includes(':**')) {
    const parts = block.content.split(':**');
    const boldPrefix = parts[0].replace('**', '');
    const rest = parts.slice(1).join(':**');
    return (
      <p key={idx} className="text-justify leading-[1.22] mb-1 font-serif text-[8.35pt] indent-0 text-[#1A1A1A]">
        <strong className="font-sans font-bold text-slate-900">{boldPrefix}:</strong>
        {renderTextWithCitations(rest, primaryColor)}
      </p>
    );
  }

  // LaTeX standard indentation rule: \setlength{\parindent}{0pt}
  // Authentic publisher template has 0pt indentation across all paragraphs!
  return (
    <p key={idx} className="text-justify leading-[1.22] mb-[1.5px] font-serif text-[8.5pt] indent-0 text-[#1A1A1A]">
      {renderTextWithCitations(block.content, primaryColor)}
    </p>
  );
};

function getPageBlocks(pageData: ID630DemoPage): ID630PageBlock[] {
  if (pageData.blocks && pageData.blocks.length > 0) {
    return pageData.blocks;
  }
  const raw = [...(pageData.column1 || []), ...(pageData.column2 || [])];
  const merged: ID630PageBlock[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    const prev = merged[merged.length - 1];
    // If previous was a paragraph that ended without sentence terminator, stitch them back together
    if (
      prev &&
      prev.type === 'paragraph' &&
      cur.type === 'paragraph' &&
      !/[.!?:]\s*$/.test(prev.content.trim()) &&
      !cur.content.startsWith('**') &&
      !/^\d+\.\s/.test(cur.content)
    ) {
      prev.content = `${prev.content.trim()} ${cur.content.trim()}`;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export const ID630AuthenticPageRenderer: React.FC<ID630AuthenticPageRendererProps> = ({
  pageNumber,
  primaryColor = '#2B74B7',
}) => {
  const pageData: ID630DemoPage =
    ID630_DEMO_PAGES.find((p) => p.pageNumber === pageNumber) || ID630_DEMO_PAGES[0];
  const pageBlocks = getPageBlocks(pageData);

  const isOdd = pageNumber % 2 !== 0;

  // --- TRANG 1: Frontmatter & Bìa bài báo chuẩn 100% LaTeX / PDF ---
  if (pageNumber === 1) {
    return (
      <div className="w-full h-full flex flex-col justify-between text-[#1A1A1A] select-text box-border pt-[14.7mm] pb-[12.5mm] pl-[16.9mm] pr-[13.1mm]">
        {/* Top Header Region (Spans Full Width 16.9mm to 203.1mm = 186.2mm, Top y=14.7mm to 20.5mm, NO bottom rule on Page 1) */}
        <div className="flex-shrink-0 flex items-start justify-between pb-0 mb-[3.5mm]">
          <div className="space-y-0.5">
            <div className="font-sans font-bold italic text-[8.5pt] text-slate-800 leading-tight">
              Tạp chí Phát triển Khoa học và Công nghệ – Health Sciences 2026, 7(2):804-816
            </div>
            <div className="flex items-center gap-1.5">
              <img
                src="/demo-assets/id630/open-access.png"
                alt="Open Access"
                className="w-3.5 h-3.5 object-contain"
              />
              <span className="font-sans font-bold text-[7.5pt] text-slate-500">
                Open Access Full Text Article
              </span>
            </div>
          </div>
          <div className="font-serif font-bold italic underline text-[11.5pt] text-slate-900">
            Bài tổng quan
          </div>
        </div>

        {/* Title & Authors (Spans Full Width 186.2mm, Title baseline y=32.0mm, Authors baseline y=52.8mm) */}
        <div className="flex-shrink-0 mb-[3.5mm]">
          <h1
            style={{ color: primaryColor }}
            className="font-sans font-bold text-[18pt] leading-[1.14] tracking-tight w-full max-w-[173mm]"
          >
            Tổng quan về loét dạ dày tá tràng ở người cao tuổi và cập nhật trong điều trị
          </h1>
          <div
            style={{ color: primaryColor }}
            className="font-sans font-bold text-[11pt] tracking-normal mt-[2mm]"
          >
            Hà Vũ<sup>*</sup>, Viên Vinh Phú
          </div>
        </div>

        {/* Content Row: Starts at y=62.0mm */}
        {/* Left Sidebar (44.2mm wide) + Gap (3.8mm) + Right Main Area (138.1mm wide) */}
        <div className="flex-1 min-h-0 flex items-stretch gap-[3.8mm]">
          {/* Left Sidebar (Width: 44.2mm, from x=16.9mm to 61.1mm) */}
          <div className="w-[44.2mm] flex-shrink-0 flex flex-col justify-between font-sans text-[7pt] leading-tight">
            {/* 1. Top Section: QR Code Box (Aligned horizontally with Abstract Box at y=62mm) */}
            <div className="flex flex-col items-center justify-start text-center pt-1">
              <div className="w-[66px] h-[66px] relative mb-1.5 border border-slate-300 rounded-none bg-white p-1">
                <img
                  src="/demo-assets/id630/qr-code.png"
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[6.2pt] text-slate-500 leading-tight font-sans text-center max-w-[125px]">
                Use your smartphone to scan this QR code and download this article
              </p>
            </div>

            {/* 2. Lower Metadata Section (Starts at y=144mm, thin rule at y=144mm, affiliation at y=146.5mm) */}
            <div className="border-t border-slate-300 pt-1 space-y-1 mt-auto">
              {/* Affiliation (y=146.5mm) */}
              <div className="font-serif italic text-[7pt] text-slate-700 leading-snug">
                Bộ môn Nội - Khoa Y – Trường Đại học Khoa học Sức khỏe - Đại học Quốc Gia Thành phố Hồ Chí Minh
              </div>

              {/* Correspondence (y=159.3mm) */}
              <div>
                <div style={{ color: primaryColor }} className="font-bold text-[6.8pt]">
                  Liên hệ
                </div>
                <div className="text-slate-800 text-[6.3pt] leading-tight">
                  <span className="font-bold">Hà Vũ</span>, Bộ môn Nội - Khoa Y – Trường Đại học Khoa học Sức khỏe - Đại học Quốc Gia Thành phố Hồ Chí Minh
                </div>
                <div className="text-slate-600 text-[6pt] mt-0.5">Email: hvu@uhsvnu.edu.vn.</div>
              </div>

              {/* History (y=180.7mm) */}
              <div>
                <div style={{ color: primaryColor }} className="font-bold text-[6.8pt] mb-0.5">
                  Lịch sử
                </div>
                <div className="space-y-0.5 text-slate-700 text-[6.3pt]">
                  <div>
                    <span style={{ color: primaryColor }}>•</span> Ngày nhận: 14-06-2025
                  </div>
                  <div>
                    <span style={{ color: primaryColor }}>•</span> Ngày sửa đổi: 10-02-2026
                  </div>
                  <div>
                    <span style={{ color: primaryColor }}>•</span> Ngày chấp nhận: 14-04-2026
                  </div>
                  <div>
                    <span style={{ color: primaryColor }}>•</span> Ngày đăng: 07-05-2026
                  </div>
                </div>
              </div>

              {/* DOI (y=200.2mm) */}
              <div>
                <span style={{ color: primaryColor }} className="font-bold text-[6.8pt]">
                  DOI :{' '}
                </span>
                <span className="font-bold text-slate-800 break-all text-[6.1pt]">
                  https://doi.org/10.32508/vnuhcmj-hs.v7i1.630
                </span>
              </div>

              {/* Check for updates badge (y=208mm) */}
              <div className="pt-0.5">
                <img
                  src="/demo-assets/id630/check-update.jpeg"
                  alt="Check for updates"
                  className="w-full max-w-[86px] h-auto object-contain"
                />
              </div>

              {/* Copyright (y=221.9mm) */}
              <div>
                <div style={{ color: primaryColor }} className="font-bold text-[6.8pt]">
                  Bản quyền
                </div>
                <p className="text-[5.6pt] text-slate-600 leading-tight">
                  © ĐHQG Tp.HCM. Đây là bài báo công bố mở được phát hành theo các điều khoản của the Creative Commons Attribution 4.0 International license.
                </p>
              </div>

              {/* VNU-HCM Press Logo (y=240mm to 260mm) */}
              <div className="pt-0.5 flex justify-start">
                <img
                  src="/demo-assets/id630/logo-vnuhcmpress-color.png"
                  alt="VNUHCM PRESS"
                  className="w-[74px] h-auto object-contain"
                />
              </div>
            </div>
          </div>

          {/* Right Main Area (Width: 138.1mm, from x=65.0mm to 203.1mm) */}
          <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
            {/* Abstract Container (y=62.0mm to 147.0mm, Solid #E7ECF7, no borders) */}
            <div className="bg-[#E7ECF7] rounded-none px-[4.2mm] py-[3.2mm] mb-[4.5mm] flex-shrink-0">
              <div
                style={{ color: primaryColor }}
                className="font-sans font-bold text-[9pt] mb-1 uppercase tracking-wider"
              >
                TÓM TẮT
              </div>
              <p className="font-sans font-normal text-[7.8pt] leading-[1.17] text-justify text-[#1A1A1A] mb-1.5 indent-0">
                Bệnh loét dạ dày tá tràng hiện nay là một thách thức y tế lớn đối với người cao tuổi (từ 65 tuổi trở lên). Mặc dù tỷ lệ mắc bệnh chung có xu hướng giảm, nhưng tần suất biến chứng và tỷ lệ tử vong ở nhóm dân số già lại gia tăng rõ rệt, do sự suy giảm chức năng sinh lý dạ dày và tình trạng đa bệnh lý. Hai yếu tố gây bệnh hàng đầu là nhiễm vi khuẩn Helicobacter pylori (H.pylori) (chiếm khoảng 70% trường hợp) và việc sử dụng các thuốc gây tổn thương niêm mạc như thuốc kháng viêm non-steroide (NSAID) hoặc aspirin. Quá trình lão hóa gây ra những thay đổi sâu sắc như lão hóa miễn dịch, rối loạn vi tuần hoàn và tình trạng teo niêm mạc dẫn đến giảm tiết acid. Những thay đổi này làm suy yếu hàng rào bảo vệ tự nhiên, khiến niêm mạc dạ dày dễ bị tấn công bởi các yếu tố ăn mòn, gây ra các vết loét &quot;vô căn&quot; hoặc do thuốc. Ở người cao tuổi, các triệu chứng thường không điển hình và dễ bị che lấp bởi các bệnh lý đi kèm. Chỉ có khoảng 1/3 bệnh nhân xuất hiện cơn đau thượng vị điển hình; số còn lại thường biểu hiện mơ hồ như chán ăn, sụt cân hoặc thậm chí khởi phát bằng biến chứng nặng như xuất huyết, thủng dạ dày. Nội soi tiêu hóa trên kèm sinh thiết theo hệ thống Sydney cải tiến được coi là tiêu chuẩn vàng để xác định vị trí loét, loại trừ ung thư và đánh giá tình trạng nhiễm H. pylori. Chiến lược điều trị cần được cá thể hóa một cách chặt chẽ. Đối với loét do H. pylori, các phác đồ mới như liệu pháp bốn thuốc có Bismuth hoặc liệu pháp sử dụng thuốc ức chế kênh Kali (P-CAB) như Vonoprazan đang cho thấy hiệu quả vượt trội. Với loét liên quan đến thuốc, việc ngừng NSAID là ưu tiên hàng đầu; nếu bắt buộc phải dùng, cần phối hợp với thuốc ức chế bơm proton (PPI) để bảo vệ niêm mạc. Công tác phòng ngừa đóng vai trò then chốt thông qua việc phân tầng nguy cơ, sử dụng PPI dự phòng thường quy và tầm soát diệt trừ H. pylori trước khi bắt đầu liệu pháp NSAID hoặc aspirin dài hạn.
              </p>
              <div className="text-[7.4pt] font-sans">
                <span className="font-bold text-slate-950">Từ khoá: </span>
                <span className="text-slate-800">
                  Bệnh loét dạ dày tá tràng, bệnh nhân cao tuổi, Helicobacter pylori, thuốc chống viêm không steroid, thuốc ức chế bơm proton.
                </span>
              </div>
            </div>

            {/* Two-Column Body Text on Page 1 (Continuous flow across 2 columns with authentic 84.7mm height matching LaTeX y=336 to y=96) */}
            <div
              style={{
                columnCount: 2,
                columnGap: '4.23mm',
                columnFill: 'auto',
                height: '84.7mm',
              }}
              className="w-full text-justify font-serif text-[8.55pt] leading-[1.22] text-[#1A1A1A] overflow-hidden"
            >
              {pageBlocks.map((b, i, arr) =>
                renderBlock(b, i, arr, primaryColor)
              )}
            </div>

            {/* Bottom Citation Strip & Page Number 1 - FIRMLY PINNED AT BOTTOM, CANNOT OVERFLOW */}
            <div className="flex-shrink-0 mt-auto pt-2 space-y-0.5">
              <div className="bg-[#E7ECF7] rounded-none px-2.5 py-1 text-[7pt] font-sans text-slate-800 leading-snug">
                <span className="font-medium">
                  <span className="font-bold text-slate-900">Trích dẫn bài báo này: </span>
                  Vũ H, Phú V V. Tổng quan về loét dạ dày tá tràng ở người cao tuổi và cập nhật trong điều trị.{' '}
                  <span className="italic">Sci. Tech. Dev. J. - Health Sci.</span> 2026; 7(2):804-816.
                </span>
              </div>
              {/* Page Number 1 right-aligned at x=201.3mm */}
              <div className="flex justify-end pr-0.5">
                <span
                  style={{ color: primaryColor }}
                  className="font-bold text-[9pt] font-sans"
                >
                  1
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- CÁC TRANG 2 ĐẾN 13: Bố cục Asymmetric (Lề trái 65mm, Nội dung 138mm) ---
  return (
    <div className="w-full h-full flex flex-col justify-between text-[#1A1A1A] select-text box-border pt-[14.7mm] pb-[12.5mm] pl-[16.9mm] pr-[13.1mm]">
      {/* Top Running Header (Spans Full Width 16.9mm to 203.1mm = 186.2mm, Rule at y=23.5mm) */}
      <div className="flex-shrink-0 pb-1 mb-[2.5mm] border-b border-slate-400 flex items-center justify-between">
        <div className="font-sans font-bold italic text-[8.5pt] text-slate-800">
          Tạp chí Phát triển Khoa học và Công nghệ – Health Sciences 2026, 7(2):804-816
        </div>
      </div>

      {/* Main Content Area: Shifted right by 48.1mm to achieve exact 65.0mm Left Margin (16.9mm + 48.1mm = 65.0mm) */}
      <div className="flex-1 min-h-0 flex flex-col pl-[48.1mm]">
        {/* Floating Figure Box (Spans 138mm width, Solid #E7ECF7, Image expands to FULL width) */}
        {pageData.hasFigure && pageData.figureData && (
          <div
            className="w-full bg-[#E7ECF7] rounded-none p-2 mb-2 flex flex-col items-center flex-shrink-0"
            style={{ height: pageNumber === 2 ? '118mm' : undefined }}
          >
            <div className="w-full flex-1 flex items-center justify-center bg-white p-1 overflow-hidden">
              <img
                src={pageData.figureData.imageSrc}
                alt={pageData.figureData.title}
                className="w-full h-full object-contain rounded-none block"
              />
            </div>
            <div className="w-full mt-1.5 font-sans text-left space-y-0.5 flex-shrink-0">
              <div style={{ color: primaryColor }} className="font-bold text-[8.2pt] leading-tight">
                Hình {pageData.figureData.number}:{' '}
                <span className="text-slate-900 font-bold">{pageData.figureData.title}</span>
              </div>
              <div className="text-[7pt] italic text-slate-600 leading-tight">
                (Nguồn: {pageData.figureData.source})
              </div>
            </div>
          </div>
        )}

        {/* Floating Table Box (Spans 138mm width) */}
        {pageData.hasTable && pageData.tableData && (
          <div className="w-full my-1 font-sans flex-shrink-0 flex flex-col">
            <div style={{ color: primaryColor }} className="font-bold text-[8.2pt] mb-1">
              Bảng {pageData.tableData.number}:{' '}
              <span className="text-slate-900 font-bold">{pageData.tableData.title}</span>
            </div>
            <div className="overflow-x-auto border-t-2 border-b-2 border-slate-900">
              <table className="w-full text-left text-[7.5pt] border-collapse">
                <thead>
                  <tr className="bg-[#E5E5E5] border-b border-slate-400">
                    {pageData.tableData.headers.map((h, i) => (
                      <th key={i} className="py-1 px-1.5 font-bold text-slate-900">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageData.tableData.rows.map((row, idx) => {
                    if (row.isSubheader) {
                      return (
                        <tr key={idx} className="bg-[#E7ECF7] font-bold border-b border-slate-300">
                          <td colSpan={pageData.tableData?.headers.length || 3} className="py-1 px-1.5 text-[#2B74B7]">
                            {row.subheaderText}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-slate-200/80 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#E7ECF7]/30'
                        }`}
                      >
                        {row.cols?.map((c, colIdx) => (
                          <td key={colIdx} className="py-1 px-1.5 align-top whitespace-pre-line text-slate-800 leading-snug">
                            {c}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[6.8pt] italic text-slate-500 mt-1">
              (Nguồn: {pageData.tableData.source})
            </div>
          </div>
        )}

        {/* Two-Column Body Text (Continuous flow across 2 columns with 4.23mm gap = 1pc) */}
        {pageBlocks.length > 0 && (
          <div
            style={{
              columnCount: 2,
              columnGap: '4.23mm',
              columnFill: 'auto',
              height: pageNumber === 2 ? '107mm' : '100%',
            }}
            className="flex-1 min-h-0 w-full text-justify font-serif text-[8.55pt] leading-[1.22] text-[#1A1A1A] overflow-hidden"
          >
            {pageBlocks.map((b, i, arr) =>
              renderBlock(b, i, arr, primaryColor)
            )}
          </div>
        )}
      </div>

      {/* Footer Page Numbering: Placed with pl-[48.1mm] to align with 65mm Left Edge (Even) and 203.1mm Right Edge (Odd) */}
      <div className="flex-shrink-0 pt-1.5 flex items-center justify-between text-[9.5pt] font-sans font-bold pl-[48.1mm]">
        {!isOdd ? (
          <span style={{ color: primaryColor }}>{pageNumber}</span>
        ) : (
          <span />
        )}
        {isOdd && (
          <span style={{ color: primaryColor }}>{pageNumber}</span>
        )}
      </div>
    </div>
  );
};

