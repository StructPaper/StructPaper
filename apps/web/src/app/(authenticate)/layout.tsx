import { AuthGuard } from '@/components/layout/AuthGuard';
import { NavigationTracker } from '@/components/layout/NavigationTracker';

/** Everything in this group needs a logged-in user (see AuthGuard). */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <NavigationTracker />
      {children}
    </AuthGuard>
  );
}
