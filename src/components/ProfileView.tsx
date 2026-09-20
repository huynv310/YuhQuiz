import React, { useEffect, useRef, useState } from 'react';
import { Mail, Fingerprint, Phone, School, Cake, GraduationCap, User, Save, Lock, TriangleAlert, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GRADES } from '../constants/subjectPresets';
import { useReveal } from '../lib/motion';
import { signOutEverywhere } from '../lib/session';
import { listRescue, removeRescue } from '../lib/rescue';

interface Props {
  profile: any;
  onUpdated: (p: any) => void;
}

const PHONE_RE = /^(0[3|5|7|8|9])[0-9]{8}$/;

const Field: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode; hint?: string }> = ({ icon, label, children, hint }) => (
  <label className="block">
    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{icon}{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
  </label>
);


/** Xóa tài khoản: 3 lớp chặn nhầm — đọc hậu quả + tick, gõ đúng mã người dùng, nút cuối có đếm ngược. */
const DeleteAccountModal: React.FC<{ profile: any; isTeacher: boolean; onClose: () => void }> = ({ profile, isTeacher, onClose }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState('');
  const [wait, setWait] = useState(5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const code: string = profile?.user_code || '';

  useEffect(() => {
    if (step !== 2) return;
    setWait(5);
    const t = setInterval(() => setWait(w => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [step]);

  const matches = code !== '' && typed.trim().toUpperCase() === code;
  const items = isTeacher
    ? ['Toàn bộ kỳ thi bạn tạo, cùng bài nộp và kết quả của học sinh', 'Toàn bộ câu hỏi trong Kho bài tập, ảnh và tệp lời giải', 'Các lớp học bạn quản lý (học sinh bị gỡ khỏi lớp)']
    : ['Toàn bộ lịch sử làm bài và điểm số', 'Danh sách câu sai đã lưu và kết quả luyện tập', 'Việc tham gia các lớp học'];

  const doDelete = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('delete_my_account', { p_confirm: typed.trim() });
    if (error) { setBusy(false); return setErr(error.message || 'Không xóa được tài khoản.'); }
    try { listRescue().forEach(r => removeRescue(r.sessionToken)); } catch { /* noop */ }
    try { await signOutEverywhere(); } catch { /* tài khoản đã bị xóa, phiên sẽ tự hết hạn */ }
    window.location.replace('/');
  };

  return (
    <div className="fixed inset-0 z-50 yq-overlay flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="del-acc-title">
      <div className="glass-panel rounded-3xl w-full max-w-md p-5 space-y-4 text-sm border-2 border-rose-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-600">
            <TriangleAlert className="w-6 h-6" />
            <h3 id="del-acc-title" className="font-extrabold text-lg">Xóa tài khoản vĩnh viễn</h3>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>

        {step === 1 ? (
          <>
            <p className="text-slate-700">Hành động này <b>không thể hoàn tác</b>. Những thứ sau sẽ bị xóa ngay:</p>
            <ul className="rounded-2xl bg-rose-50 text-rose-700 p-3 space-y-1.5 list-disc pl-7">{items.map(i => <li key={i}>{i}</li>)}</ul>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={ack} onChange={e => setAck(e.target.checked)} />
              <span>Tôi hiểu dữ liệu sẽ mất hoàn toàn và không ai khôi phục được, kể cả quản trị viên.</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="btn btn-secondary">Giữ tài khoản</button>
              <button disabled={!ack} onClick={() => setStep(2)} className="btn btn-secondary !text-rose-600 disabled:opacity-40">Tiếp tục</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-slate-700">Để xác nhận, nhập mã người dùng của bạn: <span className="font-mono font-extrabold text-slate-900 select-all">{code}</span></p>
            <input className="field font-mono uppercase" value={typed} onChange={e => setTyped(e.target.value)} placeholder={code} autoFocus autoComplete="off" spellCheck={false} maxLength={8} />
            {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-600 px-3 py-2">{err}</div>}
            <div className="flex justify-between gap-2">
              <button onClick={() => { setStep(1); setTyped(''); }} disabled={busy} className="btn btn-ghost">Quay lại</button>
              <div className="flex gap-2">
                <button onClick={onClose} disabled={busy} className="btn btn-secondary">Hủy</button>
                <button onClick={doDelete} disabled={!matches || wait > 0 || busy}
                        className="btn !bg-rose-600 !text-white disabled:opacity-40">
                  <Trash2 className="w-4 h-4" /> {busy ? 'Đang xóa…' : wait > 0 ? `Xóa tài khoản (${wait})` : 'Xóa tài khoản'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/** Hồ sơ cá nhân dùng chung cho học sinh và giáo viên. Email, mã người dùng, vai trò: chỉ xem. */
export const ProfileView: React.FC<Props> = ({ profile, onUpdated }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);
  const isTeacher = profile?.role === 'teacher';
  const [fullName, setFullName] = useState<string>(profile?.full_name || '');
  const [phone, setPhone] = useState<string>(profile?.phone || '');
  const [school, setSchool] = useState<string>(profile?.school || '');
  const [dob, setDob] = useState<string>(profile?.dob || '');
  const [grade, setGrade] = useState<number>(profile?.grade || 12);
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty =
    fullName.trim() !== (profile?.full_name || '') || phone.trim() !== (profile?.phone || '') ||
    school.trim() !== (profile?.school || '') || dob !== (profile?.dob || '') || (!isTeacher && grade !== (profile?.grade || 12));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (fullName.trim().length < 2) return setMsg({ ok: false, text: 'Họ tên tối thiểu 2 ký tự.' });
    if (!PHONE_RE.test(phone.trim())) return setMsg({ ok: false, text: 'Số điện thoại không hợp lệ (10 số, bắt đầu 03/05/07/08/09).' });
    if (dob && new Date(dob) > new Date()) return setMsg({ ok: false, text: 'Ngày sinh không hợp lệ.' });
    setBusy(true);
    try {
      if (phone.trim() !== (profile?.phone || '')) {
        const { data: taken } = await supabase.rpc('phone_taken', { p_phone: phone.trim(), p_exclude: profile.id });
        if (taken) throw new Error('Số điện thoại này đã được tài khoản khác sử dụng.');
      }
      const patch: any = { full_name: fullName.trim(), phone: phone.trim(), school: school.trim() || null, dob: dob || null };
      if (!isTeacher) patch.grade = grade;
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', profile.id).select('*').single();
      if (error) throw error;
      onUpdated(data);
      setMsg({ ok: true, text: 'Đã lưu thông tin cá nhân.' });
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Không lưu được, vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  };

  const initial = (profile?.full_name || profile?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div data-reveal className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-500 text-white grid place-items-center text-2xl font-extrabold shadow-md shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-slate-900 truncate">{profile?.full_name || 'Chưa có tên'}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={`chip ${isTeacher ? 'chip-primary' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{isTeacher ? 'Giáo viên' : 'Học sinh'}</span>
            <span className="chip chip-muted font-mono">{profile?.user_code || '—'}</span>
          </div>
        </div>
      </div>

      <div data-reveal className="card p-5">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-slate-400" /> Thông tin tài khoản (không thể đổi)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field icon={<Mail className="w-3.5 h-3.5" />} label="Email">
            <input className="field !bg-slate-100/70 text-slate-500 cursor-not-allowed" value={profile?.email || ''} readOnly disabled />
          </Field>
          <Field icon={<Fingerprint className="w-3.5 h-3.5" />} label="Mã người dùng (ID)">
            <input className="field !bg-slate-100/70 text-slate-500 font-mono cursor-not-allowed" value={profile?.user_code || ''} readOnly disabled />
          </Field>
        </div>
      </div>

      <form data-reveal onSubmit={save} className="card p-5 space-y-4">
        <h2 className="font-bold text-slate-800">Thông tin cá nhân</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field icon={<User className="w-3.5 h-3.5" />} label="Họ và tên">
            <input className="field" value={fullName} onChange={e => setFullName(e.target.value)} maxLength={80} required />
          </Field>
          <Field icon={<Phone className="w-3.5 h-3.5" />} label="Số điện thoại">
            <input className="field" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={10} required />
          </Field>
          <Field icon={<School className="w-3.5 h-3.5" />} label={isTeacher ? 'Trường công tác' : 'Trường đang học'}>
            <input className="field" value={school} onChange={e => setSchool(e.target.value)} maxLength={120} placeholder="THPT ..." />
          </Field>
          <Field icon={<Cake className="w-3.5 h-3.5" />} label="Ngày sinh">
            <input className="field" type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setDob(e.target.value)} />
          </Field>
          {!isTeacher && (
            <Field icon={<GraduationCap className="w-3.5 h-3.5" />} label="Khối lớp">
              <select className="field" value={grade} onChange={e => setGrade(Number(e.target.value))}>
                {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
              </select>
            </Field>
          )}
        </div>

        {msg && (
          <div role={msg.ok ? 'status' : 'alert'} className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
            {msg.text}
          </div>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !dirty} className="btn btn-primary btn-lg disabled:opacity-50">
            <Save className="w-4 h-4" /> {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>

      <div data-reveal className="card p-5 border border-rose-200/80">
        <h2 className="font-bold text-rose-600 mb-1 flex items-center gap-2"><TriangleAlert className="w-4 h-4" /> Vùng nguy hiểm</h2>
        <p className="text-xs text-slate-500 mb-3">Xóa tài khoản sẽ xóa vĩnh viễn toàn bộ dữ liệu của bạn. Bạn sẽ được hỏi xác nhận nhiều bước.</p>
        <button type="button" onClick={() => setShowDelete(true)} className="btn btn-secondary !text-rose-600 !border-rose-200"><Trash2 className="w-4 h-4" /> Xóa tài khoản…</button>
      </div>
      {showDelete && <DeleteAccountModal profile={profile} isTeacher={isTeacher} onClose={() => setShowDelete(false)} />}
    </div>
  );
};
