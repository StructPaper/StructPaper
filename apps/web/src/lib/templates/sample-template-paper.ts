import { CompletePaper, LayoutSettings } from '@/types/paper';
import { JournalProfile } from '@structpaper/journal-profiles';
import { layoutFromProfile, type LayoutProfile } from '@/lib/layout/profile-layout';

/**
 * Generates a realistic mock academic research paper tailored to the given Journal Profile.
 * Used for live split-screen preview and live compilation in the Template Editor.
 */
export function generateSamplePaperForJournal(
  profile: JournalProfile,
  overrides?: Partial<JournalProfile>
): CompletePaper {
  const merged = { ...profile, ...overrides };
  const shortCode = merged.names?.short || merged.id?.toUpperCase() || 'JOURNAL';
  const nameVi = merged.names?.vi || 'Tạp chí Phát triển Khoa học và Công nghệ';
  const nameEn = merged.names?.en || 'Science and Technology Development Journal';

  // the preview is typeset with the layout the journal's rules ask for (columns, paper, type size, spacing)
  const layoutSettings: LayoutSettings & { color?: string } = { ...layoutFromProfile(merged as LayoutProfile), color: merged.color || '#000099' };

  // Select article type
  const firstArticleType =
    merged.articleTypes?.[0]?.label?.vi ||
    merged.articleTypes?.[0]?.label?.en ||
    'Bài báo nghiên cứu';

  const now = new Date();
  const year = String(now.getFullYear());

  return {
    id: `sample_${merged.id || 'preview'}`,
    metadata: {
      title: `Nghiên cứu ứng dụng công nghệ trí tuệ nhân tạo và xử lý ngôn ngữ tự nhiên trong xuất bản ấn phẩm khoa học chuẩn quốc tế tại ${shortCode}`,
      titleEn: `Research on the application of artificial intelligence and natural language processing in international academic publishing standards at ${shortCode}`,
      articleType: firstArticleType,
      journalId: merged.id?.toUpperCase() || 'VNUHCM-STD',
      journalName: nameVi,
      journalAbbv: shortCode,
      authors: [
        {
          id: 'auth_1',
          name: 'Nguyễn Văn An',
          affiliationIds: [1],
          isCorresponding: true,
          email: 'nvan@vnuhcm.edu.vn',
        },
        {
          id: 'auth_2',
          name: 'Trần Thị Bích Ngọc',
          affiliationIds: [1, 2],
          isCorresponding: false,
        },
        {
          id: 'auth_3',
          name: 'Lê Hoàng Minh',
          affiliationIds: [2],
          isCorresponding: false,
        },
      ],
      affiliations: [
        {
          id: 1,
          name: 'Trường Đại học Bách Khoa, Đại học Quốc gia Thành phố Hồ Chí Minh',
        },
        {
          id: 2,
          name: 'Viện Công nghệ Tiên tiến, Đại học Quốc gia Thành phố Hồ Chí Minh',
        },
      ],
      corresponding: {
        name: 'Nguyễn Văn An',
        email: 'nvan@vnuhcm.edu.vn',
        affiliation: 'Trường Đại học Bách Khoa, Đại học Quốc gia Thành phố Hồ Chí Minh',
      },
      abstract:
        'Xuất bản khoa học theo các tiêu chuẩn quốc tế (như Scopus, Web of Science) đòi hỏi sự chuẩn xác cao về mặt cấu trúc tài liệu, dàn trang và siêu dữ liệu học thuật. Bài báo này nghiên cứu việc tích hợp mô hình phân tích cấu trúc sâu và các công cụ dàn trang tự động dựa trên XeLaTeX nhằm tối ưu hóa quy trình biên tập và xuất bản bài báo khoa học. Chúng tôi xây dựng mô hình thực nghiệm dựa trên tập dữ liệu gồm hơn 2.000 bản thảo đa lĩnh vực từ các tạp chí thành viên của Đại học Quốc gia TP.HCM. Kết quả cho thấy giải pháp tự động hóa giúp giảm 78,5% thời gian biên tập kỹ thuật, đồng thời đảm bảo độ chính xác tuyệt đối trong việc trích xuất các thành phần siêu dữ liệu như bảng biểu, công thức toán và danh mục tài liệu tham khảo theo chuẩn Vancouver.',
      abstractEn:
        'Publishing in accordance with international academic indexing standards requires rigorous precision regarding document architecture, typesetting, and academic metadata. This paper investigates the integration of deep structural parsing and automated XeLaTeX-based typesetting pipelines to streamline the scientific editorial and publication lifecycle. Our empirical evaluation on a corpus of over 2,000 multi-disciplinary manuscripts demonstrates a 78.5% reduction in technical copyediting duration while maintaining strict conformance to Vancouver citation standards and structural layout fidelity.',
      keywords: [
        'Dàn trang tự động',
        'Xuất bản học thuật',
        'Trí tuệ nhân tạo',
        'Cấu trúc bài báo',
        shortCode,
      ],
      keywordsEn: [
        'Automated typesetting',
        'Academic publishing',
        'Artificial intelligence',
        'Document structure',
      ],
      dates: {
        received: '15-08-2025',
        revised: '12-11-2025',
        accepted: '20-01-2026',
        published: '10-03-2026',
      },
      doi: merged.publication?.doiPrefix
        ? `https://doi.org/${merged.publication.doiPrefix}.v8i1.1018`
        : `https://doi.org/10.32508/${(merged.id || 'std').toLowerCase()}.${year}.1018`,
      volume: '8',
      issue: '1',
      year,
      firstPage: 101,
      lastPage: 112,
    },
    sections: [
      {
        id: 'sec_1',
        type: 'h1',
        title: '1. GIỚI THIỆU',
        content: '',
      },
      {
        id: 'sec_2',
        type: 'paragraph',
        content:
          'Trong kỷ nguyên chuyển đổi số học thuật, việc nâng cao chất lượng biên tập và chuẩn hóa hình thức các tạp chí khoa học đóng vai trò quyết định trong việc hội nhập các cơ sở dữ liệu thư mục quốc tế [1]. Quá trình chế bản truyền thống thường đòi hỏi nhiều thao tác thủ công, từ việc định dạng lại kiểu chữ, căn chỉnh lề đến chuẩn hóa bảng biểu và danh mục tài liệu tham khảo [2]. Những thao tác này tiêu tốn thời gian và dễ phát sinh lỗi sai lệch giữa bản thảo gửi và bản in cuối cùng.',
      },
      {
        id: 'sec_3',
        type: 'h1',
        title: '2. PHƯƠNG PHÁP NGHIÊN CỨU',
        content: '',
      },
      {
        id: 'sec_4',
        type: 'paragraph',
        content:
          'Nghiên cứu áp dụng quy trình trích xuất cấu trúc văn bản hai pha (two-phase structural extraction) kết hợp cùng động cơ biên dịch XeLaTeX phân tán [3]. Hệ thống phân rã tệp văn bản đầu vào thành cây cú pháp học thuật (Academic Syntax Tree), xác định chính xác các trường tác giả, đơn vị công tác, tóm tắt và tài liệu trích dẫn theo chuẩn Vancouver.',
      },
      {
        id: 'sec_5',
        type: 'h1',
        title: '3. KẾT QUẢ VÀ THẢO LUẬN',
        content: '',
      },
      {
        id: 'sec_6',
        type: 'paragraph',
        content:
          'Kết quả kiểm thử trên 500 bài báo thuộc các lĩnh vực Khoa học Tự nhiên, Kỹ thuật và Khoa học Sức khỏe cho thấy tốc độ biên dịch trung bình đạt dưới 2,4 giây cho mỗi bài báo dài 10 trang, độ chính xác nhận diện cấu trúc đạt 98,7% [4]. Bảng 1 tóm tắt hiệu năng so sánh giữa phương pháp thủ công và giải pháp tự động hóa.',
      },
      {
        id: 'sec_7',
        type: 'table',
        content: '',
        table: {
          id: 'tbl_1',
          num: 1,
          caption: 'So sánh hiệu năng quy trình biên tập và chế bản ấn phẩm khoa học',
          headers: ['Chỉ số đánh giá', 'Quy trình thủ công', 'Quy trình tự động', 'Mức cải thiện'],
          rows: [
            ['Thời gian biên tập (phút/bài)', '145 ± 25', '12 ± 3', 'Giảm 91.7%'],
            ['Sai sót định dạng tham khảo (%)', '14.2%', '0.1%', 'Giảm 99.3%'],
            ['Tốc độ tạo bản in PDF (giây)', '1800', '2.4', 'Nhanh hơn 750 lần'],
            ['Tỷ lệ chuẩn hóa cấu trúc (%)', '82.5%', '99.4%', 'Tăng 16.9%'],
          ],
        },
      },
      {
        id: 'sec_8',
        type: 'h1',
        title: '4. KẾT LUẬN',
        content: '',
      },
      {
        id: 'sec_9',
        type: 'paragraph',
        content:
          'Mô hình chuẩn hóa và dàn trang tự động đã chứng minh hiệu quả vượt trội trong việc tiết kiệm nhân lực biên tập và bảo đảm tính nhất quán của các tạp chí khoa học. Hướng phát triển tiếp theo là mở rộng cơ chế kiểm duyệt chất lượng hình ảnh đồ thị độ phân giải cao và tự động phát hiện trích dẫn chéo.',
      },
    ],
    references: [
      {
        id: 1,
        raw: 'Nguyen VA, Tran H. Modern workflows for academic publishing and indexing standards. J Sci Comput. 2024;42(1):15-28.',
        authors: 'Nguyen VA, Tran H',
        title: 'Modern workflows for academic publishing and indexing standards',
        journal: 'J Sci Comput',
        year: '2024',
        isCited: true,
        citationCount: 1,
      },
      {
        id: 2,
        raw: 'Smith RK, Johnson LE. Automated structural typesetting for academic journals using XeLaTeX. Int J Doc Anal. 2023;19(4):302-316.',
        authors: 'Smith RK, Johnson LE',
        title: 'Automated structural typesetting for academic journals using XeLaTeX',
        journal: 'Int J Doc Anal',
        year: '2023',
        isCited: true,
        citationCount: 1,
      },
      {
        id: 3,
        raw: 'Le HM, Pham TH, Vo DT. High-performance distributed typesetting pipelines for scientific communications. VNUHCM J Sci Tech Dev. 2025;28(2):45-56.',
        authors: 'Le HM, Pham TH, Vo DT',
        title: 'High-performance distributed typesetting pipelines for scientific communications',
        journal: 'VNUHCM J Sci Tech Dev',
        year: '2025',
        isCited: true,
        citationCount: 1,
      },
      {
        id: 4,
        raw: 'Williams CT, Brown MB. Vancouver citation style automation and cross-reference validation. Comput Lang. 2025;88:102-115.',
        authors: 'Williams CT, Brown MB',
        title: 'Vancouver citation style automation and cross-reference validation',
        journal: 'Comput Lang',
        year: '2025',
        isCited: true,
        citationCount: 1,
      },
    ],
    layoutSettings,
  };
}
