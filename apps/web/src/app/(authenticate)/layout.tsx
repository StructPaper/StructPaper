import { AuthGuard } from '@/components/layout/AuthGuard';

/** Everything in this group needs a logged-in user (see AuthGuard). */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
