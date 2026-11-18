import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';

/** Main application pages: persistent dock (desktop) / bottom navigation (mobile). */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-var(--titlebar-height,0px))] flex flex-col sm:flex-row bg-[#F8F9FA]">
      <Sidebar />

      <div className="w-full flex-1 flex flex-col min-w-0 min-h-[calc(100vh-var(--titlebar-height,0px))]">
        <main className="w-full flex-1 px-3 sm:px-4 lg:px-6 py-3 pb-24 sm:pb-6 flex flex-col min-w-0 min-h-0">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
