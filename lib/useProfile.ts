import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

export type Profile = {
  id: string;
  clerk_id: string;
  company_id: string | null;
  role: 'owner' | 'rep';
  voice_id: string;
  full_name: string;
  email: string;
  companies?: { id: string; name: string; plan: string } | null;
};

export function useProfile() {
  const { user, isLoaded } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !user) { setLoading(false); return; }
    loadProfile();
  }, [isLoaded, user]);

  const loadProfile = async () => {
    const res = await fetch(`/api/profile?clerkId=${user!.id}`);
    const data = await res.json();
    setProfile(data.profile as Profile | null);
    setLoading(false);
  };

  const refresh = () => loadProfile();

  return { profile, loading, refresh };
}
