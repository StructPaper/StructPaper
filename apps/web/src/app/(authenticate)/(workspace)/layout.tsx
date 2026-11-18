/**
 * Focused workspaces (paper editor, template builder, journal template editor):
 * logged-in pages that take the whole window, so there is no dock.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full bg-[#F8F9FA] overflow-hidden p-2 sm:p-0 flex flex-col">
      {children}
    </div>
  );
}
