import { AuthShell } from '@/components/auth/AuthShell';

/**
 * Public pages (login, account activation / invitation): reachable without a session, no dock,
 * and no session check. They share one split-screen shell (AuthShell); the area scrolls on its
 * own so tall forms stay usable on small screens.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full overflow-x-hidden overflow-y-auto flex flex-col bg-[#F1F3F5]">
      <AuthShell>{children}</AuthShell>
    </div>
  );
}
