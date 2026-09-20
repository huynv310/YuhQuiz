// Supabase giả cho test BFF: ghi lại các lệnh gọi, hành vi điều khiển qua globalThis.__sb
export function createClient() {
  const st = globalThis.__sb;
  return {
    rpc: async (fn, a) => {
      st.calls.push(['rpc', fn]);
      if (st.rpcDown) throw new Error('network');
      const rl = (st.rl ||= new Map());
      if (fn === 'auth_rl_check') return { data: (rl.get(a.p_key) || 0) >= a.p_max ? 600 : 0, error: null };
      if (fn === 'auth_rl_fail') { rl.set(a.p_key, (rl.get(a.p_key) || 0) + 1); return { data: null, error: null }; }
      if (fn === 'auth_rl_reset') { rl.delete(a.p_key); return { data: null, error: null }; }
      return { data: null, error: { message: 'unknown rpc' } };
    },
    auth: {
      signInWithPassword: async ({ email, password }) => {
        st.calls.push(['signIn', email]);
        return password === 'good'
          ? { data: { session: { access_token: 'AT1', refresh_token: 'RT1', expires_at: 999, expires_in: 3600 }, user: { id: 'u1', email } }, error: null }
          : { data: { session: null }, error: { message: 'Invalid login credentials' } };
      },
      refreshSession: async ({ refresh_token }) => {
        st.calls.push(['refresh', refresh_token]);
        return refresh_token === 'RT1' || refresh_token === 'OAUTH'
          ? { data: { session: { access_token: 'AT2', refresh_token: 'RT2', expires_at: 1999, expires_in: 3600 }, user: { id: 'u1' } }, error: null }
          : { data: { session: null, user: null }, error: { message: 'bad token' } };
      },
      signOut: async (o) => { st.calls.push(['signOut', o?.scope]); return { error: null }; },
    },
  };
}
