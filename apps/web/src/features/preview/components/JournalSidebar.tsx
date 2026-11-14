import React from 'react';
import { JournalSidebarProps } from './types';

function formatJournalDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  // Normalize DD/MM/YYYY, DD.MM.YYYY, or DD-MM-YYYY
  const parts = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (parts) {
    const dd = parts[1].padStart(2, '0');
    const mm = parts[2].padStart(2, '0');
    const yyyy = parts[3];
    return `${dd}-${mm}-${yyyy}`;
  }
  // Normalize YYYY-MM-DD
  const isoParts = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (isoParts) {
    const yyyy = isoParts[1];
    const mm = isoParts[2].padStart(2, '0');
    const dd = isoParts[3].padStart(2, '0');
    return `${dd}-${mm}-${yyyy}`;
  }
  return trimmed;
}

export const JournalSidebar: React.FC<JournalSidebarProps> = ({ paper }) => {
  const { metadata } = paper;

  return (
    <div className="w-[28%] flex-shrink-0 text-left text-gray-800 leading-tight space-y-2.5">
      {/* QR Code */}
      <div className="text-center">
        <img
          src="/demo-images/article-qr.png"
          alt="QR Code"
          className="w-[88px] h-[88px] mx-auto object-contain"
        />
        <p
          className="text-[6.8pt] text-gray-500 italic mt-1 leading-snug"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          Use your smartphone to scan this QR code and download this article
        </p>
      </div>

      <hr className="border-t border-gray-300 my-1" />

      {/* Affiliations List - Exact LaTeX: \fontsize{8pt}{8pt}\selectfont\itshape */}
      <div className="space-y-1">
        {metadata.affiliations.map((aff) => (
          <p
            key={aff.id}
            className="text-[8pt] italic text-gray-800 leading-snug"
            style={{ fontFamily: "'Source Serif 4', 'Times New Roman', 'Palatino Linotype', Georgia, serif" }}
          >
            <sup>{aff.id}</sup> {aff.name}
          </p>
        ))}
      </div>

      {/* Correspondence (Liên hệ) - Exact: \Correspondence = Title case, #2B74B7 */}
      {metadata.corresponding && (
        <div>
          <p
            className="font-bold text-[7pt] text-[#2B74B7]"
            style={{ fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif" }}
          >
            Liên hệ
          </p>
          <p
            className="text-[7pt] text-gray-700 leading-tight mt-0.5"
            style={{ fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif" }}
          >
            <strong>{metadata.corresponding.name}</strong>, {metadata.corresponding.affiliation}
            <br />
            Email: {metadata.corresponding.email}
          </p>
        </div>
      )}

      {/* History (Lịch sử) - Exact: \History = Title case, #2B74B7, Dates DD-MM-YYYY */}
      {metadata.dates && (
        <div>
          <p
            className="font-bold text-[7pt] text-[#2B74B7]"
            style={{ fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif" }}
          >
            Lịch sử
          </p>
          <ul
            className="text-[7.5pt] text-gray-700 leading-snug space-y-0.5 mt-0.5"
            style={{ fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif" }}
          >
            {metadata.dates.received && (
              <li>
                <span className="text-[#2B74B7] font-bold mr-1">•</span>
                <span style={{ fontFamily: "'Source Serif 4', 'Times New Roman', serif" }}>Ngày nhận: </span>
                <span className="font-light">{formatJournalDate(metadata.dates.received)}</span>
              </li>
            )}
            {metadata.dates.revised && (
              <li>
                <span className="text-[#2B74B7] font-bold mr-1">•</span>
                <span style={{ fontFamily: "'Source Serif 4', 'Times New Roman', serif" }}>Ngày sửa đổi: </span>
                <span className="font-light">{formatJournalDate(metadata.dates.revised)}</span>
              </li>
            )}
            {metadata.dates.accepted && (
              <li>
                <span className="text-[#2B74B7] font-bold mr-1">•</span>
                <span style={{ fontFamily: "'Source Serif 4', 'Times New Roman', serif" }}>Ngày chấp nhận: </span>
                <span className="font-light">{formatJournalDate(metadata.dates.accepted)}</span>
              </li>
            )}
            {metadata.dates.published && (
              <li>
                <span className="text-[#2B74B7] font-bold mr-1">•</span>
                <span style={{ fontFamily: "'Source Serif 4', 'Times New Roman', serif" }}>Ngày đăng: </span>
                <span className="font-light">{formatJournalDate(metadata.dates.published)}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* DOI - Exact: DOI : [bold, #2B74B7], Value [bold 7pt] */}
      {metadata.doi && (
        <div>
          <p
            className="text-[7pt] text-[#2B74B7] leading-tight"
            style={{ fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif" }}
          >
            <span className="font-bold">DOI : </span>
            <span className="font-bold text-gray-900 break-all">{metadata.doi}</span>
          </p>
        </div>
      )}

      {/* Check for updates CrossMark Badge */}
      <div>
        <img
          src="/demo-images/check-update.jpg"
          alt="Check for updates"
          className="w-[115px] object-contain my-1"
        />
      </div>

      {/* Copyright - Exact: \Copyright = Title case, #2B74B7, text: © ĐHQG Tp.HCM. Đây là bài báo công bố mở được phát hành... */}
      <div>
        <p
          className="font-bold text-[7pt] text-[#2B74B7]"
          style={{ fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif" }}
        >
          Bản quyền
        </p>
        <p
          className="text-[7pt] text-gray-700 leading-tight mt-0.5 font-light"
          style={{ fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif" }}
        >
          © ĐHQG Tp.HCM. Đây là bài báo công bố mở được phát hành theo các điều khoản của the Creative Commons Attribution 4.0 International license.
        </p>
      </div>

      {/* VNUHCM PRESS Logo */}
      <div className="pt-1">
        <img
          src="/demo-images/logo-vnuhcmpress-color.png"
          alt="VNUHCM PRESS"
          className="w-[80px] object-contain"
        />
      </div>
    </div>
  );
};
