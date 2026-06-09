import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function BossLayout({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
