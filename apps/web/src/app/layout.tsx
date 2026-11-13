import type { Metadata } from 'next';
import './globals.css';
import { PaperProvider } from '@/context/PaperContext';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'StructPaper | Hệ Thống Trích Xuất & Dàn Trang Báo Cáo Khoa Học VNUHCM',
  description:
    'Chuyển đổi bản thảo DOCX thành định dạng PDF & Word bài báo khoa học chuẩn Tạp chí Đại học Quốc gia TP.HCM (VNUHCM-HS, STDJ, SSH...)',
};

import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/DynamicIslandToast';
import { PlatformProvider } from '@/platform/provider';
import { EditorSessionProvider } from '@/context/EditorSessionContext';
import { DesktopChromeShell } from '@/components/titlebar';
import { UpdateToastNotifier } from '@/components/platform/UpdateToastNotifier';
import { QueryProvider } from '@/lib/query-client';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" spellCheck={false}>
      <body className="antialiased bg-[#F8F9FA] text-[#1A1A1A] min-h-screen" spellCheck={false}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('focusin', function(e) {
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
                  e.target.setAttribute('spellcheck', 'false');
                }
              }, true);
            `,
          }}
        />
        <QueryProvider>
          <PlatformProvider>
            <EditorSessionProvider>
              <PaperProvider>
                <DesktopChromeShell>
                  <Toaster />
                  <UpdateToastNotifier />
                  <AppShell>
                    {children}
                  </AppShell>
                </DesktopChromeShell>
              </PaperProvider>
            </EditorSessionProvider>
          </PlatformProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
