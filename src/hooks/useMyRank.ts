import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface MyRank {
  role: 'student' | 'teacher';
  rank_tier: string;
  position: number | null;
  exams_completed?: number;
  avg_score?: number;
  rank_score?: number;
  exams_count?: number;
}

/** Hạng của chính người đang đăng nhập (RPC get_my_rank, không lộ toàn bảng xếp hạng). */
export function useMyRank(userId: string | undefined | null) {
  const [rank, setRank] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    supabase.rpc('get_my_rank').then(({ data }) => {
      if (alive) { setRank(data as MyRank | null); setLoading(false); }
    });
    return () => { alive = false; };
  }, [userId]);

  return { rank, loading };
}
