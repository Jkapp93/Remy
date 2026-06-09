import { ErrorBoundary } from '../../components/ErrorBoundary';
import { InstallPrompt } from '../../components/InstallPrompt';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
      <InstallPrompt />
    </ErrorBoundary>
  );
}
