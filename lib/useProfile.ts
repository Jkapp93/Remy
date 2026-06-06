import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { supabase } from '../lib/supabase';

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
    const { data } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('clerk_id', user!.id)
      .single();
    setProfile(data as Profile | null);
    setLoading(false);
  };

  const refresh = () => loadProfile();

  return { profile, loading, refresh };
}
