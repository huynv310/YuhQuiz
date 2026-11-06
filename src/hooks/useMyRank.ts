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
export function useMyRank(userId: string | undefined | null, forceRole?: 'student' | 'teacher') {
  const [rank, setRank] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    const args = forceRole ? { p_force_role: forceRole } : {};
    supabase.rpc('get_my_rank', args).then(
      ({ data, error }) => {
        if (!alive) return;
        if (error && forceRole) {
          // Fallback nếu DB chưa chạy migration p_force_role
          supabase.rpc('get_my_rank').then(({ data: d2 }) => {
            if (alive) {
              setRank(d2 && (!forceRole || d2.role === forceRole) ? (d2 as MyRank) : null);
              setLoading(false);
            }
          });
          return;
        }
        setRank(data as MyRank | null);
        setLoading(false);
      }
    );
    return () => { alive = false; };
  }, [userId, forceRole]);

  return { rank, loading };
}
