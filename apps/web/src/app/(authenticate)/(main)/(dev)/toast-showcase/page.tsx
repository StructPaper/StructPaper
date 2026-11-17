'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Loader2,
  ArrowLeft,
  Trash2,
  Play,
  RotateCcw,
  Zap,
  Layers,
} from 'lucide-react';
import { toast, sileo } from '@/components/toast';

const THEME_DEMOS = [
  {
    type: 'success' as const,
    title: 'Theme Xanh Lime (Success)',
    badge: 'Lime #78C841',
    badgeStyle: 'bg-lime-100 text-lime-800',
    iconBg: 'bg-[#78C841] text-white',
    icon: <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.8]" />,
    btnStyle: 'bg-[#78C841] text-zinc-950 hover:bg-[#6cb43a]',
    inlineBtnStyle: 'bg-lime-100 text-lime-900 hover:bg-lime-200',
    single: 'Đã lưu bản thảo',
    inlineTitle: 'Đã lưu bài báo',
    inlineDesc: 'Bản thảo đã cập nhật thành công vào hệ thống.',
    twoLineTitle: 'Đã khởi tạo bài báo mới',
    twoLineDesc: 'Bản thảo đã được thiết lập theo mẫu chuẩn VNUHCM-STD.',
  },
  {
    type: 'error' as const,
    title: 'Theme Đỏ (Error)',
    badge: '#FB4141',
    badgeStyle: 'bg-rose-100 text-rose-800',
    iconBg: 'bg-[#FB4141] text-white',
    icon: <AlertCircle className="w-3.5 h-3.5 stroke-[2.8]" />,
    btnStyle: 'bg-[#FB4141] text-white hover:bg-rose-600',
    inlineBtnStyle: 'bg-rose-100 text-rose-900 hover:bg-rose-200',
    single: 'Không thể xuất file',
    inlineTitle: 'Lỗi định dạng',
    inlineDesc: 'File DOCX bị lỗi cấu trúc bảng hoặc hình ảnh.',
    twoLineTitle: 'Lỗi đồng bộ cơ sở dữ liệu',
    twoLineDesc: 'Không thể lưu trạng thái vào IndexedDB do lỗi quota.',
  },
  {
    type: 'warning' as const,
    title: 'Theme Vàng (Warning)',
    badge: '#FF9B2F',
    badgeStyle: 'bg-amber-100 text-amber-800',
    iconBg: 'bg-[#FF9B2F] text-white',
    icon: <AlertTriangle className="w-3.5 h-3.5 stroke-[2.8]" />,
    btnStyle: 'bg-[#FF9B2F] text-zinc-950 hover:bg-amber-500',
    inlineBtnStyle: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
    single: 'Bản thảo chưa lưu',
    inlineTitle: 'Cảnh báo tác giả',
    inlineDesc: 'Vui lòng bổ sung email tác giả liên hệ.',
    twoLineTitle: 'Thiếu tác giả liên hệ',
    twoLineDesc: 'Vui lòng bổ sung email tác giả trước khi gửi xét duyệt.',
  },
  {
    type: 'info' as const,
    title: 'Theme Trắng Xám (bg-gray-200/70)',
    badge: 'Trắng Xám',
    badgeStyle: 'bg-zinc-200 text-zinc-800',
    iconBg: 'bg-zinc-900 text-white',
    icon: <Sparkles className="w-3.5 h-3.5 stroke-[2.4]" />,
    btnStyle: 'bg-zinc-900 text-white hover:bg-zinc-800',
    inlineBtnStyle: 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300',
    single: 'Đã nạp mẫu mới',
    inlineTitle: 'Chuẩn Vancouver',
    inlineDesc: 'Áp dụng trích dẫn số thứ tự theo định dạng Vancouver.',
    twoLineTitle: 'Quy định trích dẫn Vancouver',
    twoLineDesc: 'Tất cả 7 tạp chí ĐHQG-HCM áp dụng trích dẫn số thứ tự.',
  },
];

export default function ToastShowcasePage() {
  const [customTitle, setCustomTitle] = useState('Đã cập nhật dữ liệu');
  const [customDesc, setCustomDesc] = useState('Bản thảo đã được đồng bộ an toàn.');
  const [customTheme, setCustomTheme] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [customDuration, setCustomDuration] = useState(3500);
  const [customInline, setCustomInline] = useState(false);

  const handleSimulatePromise = (willSucceed: boolean) => {
    const mockAsync = () =>
      new Promise<string>((resolve, reject) => {
        setTimeout(() => {
          if (willSucceed) resolve('Bản thảo DOCX đã được bóc tách hoàn chỉnh.');
          else reject(new Error('File DOCX bị lỗi cấu trúc bảng hoặc hình ảnh.'));
        }, 2000);
      });

    toast.promise(mockAsync(), {
      loading: 'Đang trích xuất cấu trúc văn bản qua Rust Typst (Sky Blue)...',
      success: (data) => data,
      error: (err) => err?.message || 'Có lỗi xảy ra trong quá trình xử lý.',
    });
  };

  const handleTestStack = () => {
    toast.clear();
    toast.info('Thông báo 1 (Đầu stack)', 'Chỉ bo góc ở 2 cạnh đáy (Top Notch)', { duration: 10000 });
    setTimeout(() => {
      toast.success('Thông báo 2 (Tầng giữa)', 'Xếp chồng Sonner phía sau (peeking 12px)', { duration: 10000 });
    }, 200);
    setTimeout(() => {
      toast.warning('Thông báo 3 (Tầng đáy)', 'Xếp chồng Sonner phía sau (peeking 22px)', { duration: 10000 });
    }, 400);
  };

  const handleFireCustom = () => {
    if (!customTitle) return;
    const desc = customDesc.trim() ? customDesc.trim() : undefined;
    toast[customTheme](customTitle, desc, {
      duration: customDuration,
      inline: customInline,
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-7 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 pb-5">
        <div>
          <Link
            href="/papers"
            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Quản lý Bài báo</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-[#D9F99D] text-[#14532D] flex items-center justify-center shadow-xs">
              <Zap className="w-5 h-5 fill-[#14532D]" />
            </span>
            <span>Showcase Thông Báo Liquid Glass</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-medium">
            Test theme Xanh Lime, Đỏ, Vàng, Trắng Xám, Sky Blue Promise, 1 dòng Inline và bo góc stack thông minh.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleTestStack}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Test Stack (Top bo đáy / Dưới bo đều)</span>
          </button>
          <button
            onClick={() => toast.clear()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Section 1: 4 Main Themes */}
      <div className="space-y-3.5">
        <h2 className="text-sm sm:text-base font-extrabold text-zinc-950 tracking-tight">
          1. Bốn Theme Màu Chuẩn (1 dòng, 1 dòng Inline &amp; 2 dòng)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {THEME_DEMOS.map((item) => (
            <div key={item.type} className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full ${item.iconBg} flex items-center justify-center`}>
                    {item.icon}
                  </div>
                  <h3 className="font-extrabold text-sm text-zinc-950">{item.title}</h3>
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${item.badgeStyle}`}>
                  {item.badge}
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <button
                  onClick={() => toast[item.type](item.single)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold ${item.btnStyle} cursor-pointer`}
                >
                  1 Dòng gọn
                </button>
                <button
                  onClick={() => toast[item.type](item.inlineTitle, item.inlineDesc, { inline: true })}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold ${item.inlineBtnStyle} cursor-pointer`}
                >
                  1 Dòng Inline (Tiêu đề: Mô tả...)
                </button>
                <button
                  onClick={() => toast[item.type](item.twoLineTitle, item.twoLineDesc)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-800 hover:bg-zinc-200 cursor-pointer"
                >
                  2 Dòng
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Sky Blue Promise & Features */}
      <div className="space-y-3.5">
        <h2 className="text-sm sm:text-base font-extrabold text-zinc-950 tracking-tight">
          2. Theme Xanh Sky Promise, Action &amp; Hover Mở Rộng
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#0284C7]" />
              <h3 className="font-extrabold text-sm text-zinc-950">Promise (Xanh Sky)</h3>
            </div>
            <p className="text-xs text-zinc-500">Nền xanh Sky dịu mát (`bg-[#E0F2FE]/70`) khi loading.</p>
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                onClick={() => handleSimulatePromise(true)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500 text-white hover:bg-sky-600 cursor-pointer text-center"
              >
                Promise (Thành công 2s)
              </button>
              <button
                onClick={() => handleSimulatePromise(false)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 cursor-pointer text-center"
              >
                Promise (Thất bại 2s)
              </button>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-sm text-zinc-950">Hover Mở Rộng (...)</h3>
            </div>
            <p className="text-xs text-zinc-500">Toast bị cắt (...) khi hover bung to mượt mà, hết hover thu lại.</p>
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                onClick={() =>
                  toast.success(
                    'Đồng bộ hoàn tất',
                    'Đã lưu 14 bảng biểu, 26 hình ảnh phân giải cao và 48 trích dẫn Vancouver vào IndexedDB an toàn.',
                    { inline: true, duration: 9000 }
                  )
                }
                className="w-full px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 cursor-pointer text-center"
              >
                Inline Dài (Hover thử)
              </button>
              <button
                onClick={() =>
                  toast.warning(
                    'Cảnh báo kiểm tra cấu trúc bản thảo',
                    'Phát hiện 3 công thức chưa chuẩn Typst và tóm tắt vượt 500 từ theo quy định ban biên tập.',
                    { duration: 9000 }
                  )
                }
                className="w-full px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 cursor-pointer text-center"
              >
                2 Dòng Dài (Hover thử)
              </button>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-600" />
              <h3 className="font-extrabold text-sm text-zinc-950">Toast kèm nút Action</h3>
            </div>
            <p className="text-xs text-zinc-500">Tích hợp nút hành động trực tiếp ngay trên thanh thông báo.</p>
            <div className="pt-1">
              <button
                onClick={() =>
                  toast.success('Bản sao lưu đã sẵn sàng', 'Nhấn Tải về để lưu file về máy', {
                    action: { label: 'Tải về ngay', onClick: () => alert('Đang tải file...') },
                  })
                }
                className="w-full px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 cursor-pointer text-center"
              >
                Bắn Toast có nút Action
              </button>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-600" />
              <h3 className="font-extrabold text-sm text-zinc-950">Kiểm tra API sileo.*</h3>
            </div>
            <p className="text-xs text-zinc-500">Tương thích hoàn toàn ngược với hàm sileo.success cũ.</p>
            <div className="pt-1">
              <button
                onClick={() => sileo.success({ title: 'Sileo Compatible', description: 'Hàm sileo.success hoạt động trơn tru.' })}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 cursor-pointer text-center"
              >
                Gọi sileo.success(...)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Custom Playground */}
      <div className="p-5 rounded-3xl bg-white border border-zinc-200/80 shadow-xs space-y-3.5">
        <h2 className="text-sm sm:text-base font-extrabold text-zinc-950 tracking-tight">
          3. Bàn Thử Nghiệm Tùy Biến (Custom Playground)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="text-xs font-extrabold text-zinc-700 block">Tiêu đề (Title):</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-zinc-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-extrabold text-zinc-700 block">Mô tả (Description):</label>
            <input
              type="text"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-zinc-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-extrabold text-zinc-700 block">Theme màu:</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['success', 'error', 'warning', 'info'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCustomTheme(t)}
                  className={`py-1.5 text-xs font-bold rounded-xl capitalize transition-all cursor-pointer ${
                    customTheme === t ? 'bg-zinc-950 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {t === 'info' ? 'Trắng Xám' : t === 'success' ? 'Lime' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 flex flex-col justify-between">
            <label className="text-xs font-extrabold text-zinc-700 flex items-center justify-between">
              <span>Chế độ 1 dòng Inline:</span>
              <input
                type="checkbox"
                checked={customInline}
                onChange={(e) => setCustomInline(e.target.checked)}
                className="w-4 h-4 accent-[#78C841] cursor-pointer"
              />
            </label>
            <p className="text-[11px] text-zinc-400">
              {customInline ? 'Bật: Hiển thị dạng "Tiêu đề: Mô tả..." trên cùng 1 dòng' : 'Tắt: Hiển thị 2 dòng riêng biệt'}
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            onClick={handleFireCustom}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold bg-[#78C841] text-zinc-950 hover:bg-[#6cb43a] transition-all cursor-pointer shadow-xs"
          >
            <Zap className="w-4 h-4 fill-zinc-950" />
            <span>Kích hoạt Thông Báo Ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
}
