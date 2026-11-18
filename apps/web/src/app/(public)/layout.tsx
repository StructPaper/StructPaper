/**
 * Public pages (login, account activation / invitation): reachable without a session, no dock,
 * and no session check. The area scrolls on its own so tall forms stay usable on small screens.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full bg-[#F8F9FA] overflow-x-hidden overflow-y-auto flex flex-col">
      {children}
    </div>
  );
}
