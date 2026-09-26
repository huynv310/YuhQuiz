import { supabaseServer } from './_lib/bff';

export default async function handler(_req: unknown, res: { status(c: number): { json(b: unknown): void } }) {
  try {
    await supabaseServer().rpc('ping');
    res.status(200).json({ message: 'Pong! Database is awake.', timestamp: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ message: 'Ping Supabase thất bại', error: e?.message || 'Lỗi máy chủ' });
  }
}
