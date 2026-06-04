import { SignIn } from '@clerk/nextjs';

export default function AuthPage() {
  return (
    <div style={{
      background: '#0b0f14',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <SignIn afterSignInUrl="/dashboard" signUpUrl="/auth" />
    </div>
  );
}
