import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, FileText, X, ChevronLeft, ChevronRight, Scissors, Layers, Save, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadQuestionImage, uploadSolutionFile, getQuestionImageUrl, MAX_SOLUTION_FILES, SolutionFile } from '../lib/imageUpload';
import { cropCanvas, stitchVertical } from '../lib/stitch';
import { DIFFICULTY_LABELS } from '../constants/chapters';
import { SUBJECT_PRESETS, GRADES } from '../constants/subjectPresets';
import { parseHashtags } from '../utils/hashtags';

interface Props {
  userId: string;
  tagHints?: string[];
  onClose: () => void;
  onSaved: () => void;
}

const RENDER_SCALE = 1.8;

export const SnipperModal: React.FC<Props> = ({ userId, tagHints = [], onClose, onSaved }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stitchMode, setStitchMode] = useState(false);
  const [pieces, setPieces] = useState<HTMLCanvasElement[]>([]);
  const [finalCanvas, setFinalCanvas] = useState<HTMLCanvasElement | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState<number | ''>('');
  const [difficulty, setDifficulty] = useState(1);
  const [part, setPart] = useState<1 | 2 | 3>(1);
  const [correctKey, setCorrectKey] = useState('A');
  const [p2Key, setP2Key] = useState('TTTT');
  const [p3Key, setP3Key] = useState('');
  const [solution, setSolution] = useState('');
  const [solFiles, setSolFiles] = useState<SolutionFile[]>([]);
  const [solBusy, setSolBusy] = useState(false);
  const [practice, setPractice] = useState(true);

  const addSolutionFiles = async (files: File[]) => {
    if (!files.length) return;
    setError(null);
    if (solFiles.length + files.length > MAX_SOLUTION_FILES) return setError(`Tối đa ${MAX_SOLUTION_FILES} tệp lời giải.`);
    setSolBusy(true);
    try {
      const up: SolutionFile[] = [];
      for (const f of files) up.push(await uploadSolutionFile(userId, f));
      setSolFiles(prev => [...prev, ...up.filter(u => !prev.some(p => p.path === u.path))]);
    } catch (e: any) {
      setError(e?.message || 'Không tải được tệp lời giải');
    } finally {
      setSolBusy(false);
    }
  };
  const [tags, setTags] = useState('');

  const renderPage = async (n: number) => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
  };

  // Tải pdf.js theo yêu cầu để không làm nặng bundle chính
  const loadFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const pdfjs: any = await import('pdfjs-dist');
      const worker: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      pdfRef.current = doc;
      setPageCount(doc.numPages);
      setPieces([]);
      setFinalCanvas(null);
      setPageNum(1);
      await renderPage(1);
    } catch (e: any) {
      setError('Không đọc được PDF: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pdfRef.current) renderPage(pageNum);
  }, [pageNum]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(e.clientY - rect.top, 0), rect.height),
    };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!pdfRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = pos(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pos(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };
  const onUp = () => {
    if (!drag || !canvasRef.current) return setDrag(null);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const k = canvas.width / rect.width;
    const x = Math.min(drag.x0, drag.x1) * k;
    const y = Math.min(drag.y0, drag.y1) * k;
    const w = Math.abs(drag.x1 - drag.x0) * k;
    const h = Math.abs(drag.y1 - drag.y0) * k;
    setDrag(null);
    if (w < 20 || h < 20) return; // bỏ qua click lỡ tay
    const piece = cropCanvas(canvas, x, y, w, h);
    if (stitchMode) setPieces(prev => [...prev, piece]);
    else setFinalCanvas(piece);
  };

  const finishStitch = () => {
    if (pieces.length === 0) return;
    setFinalCanvas(stitchVertical(pieces));
    setPieces([]);
    setStitchMode(false);
  };

  const save = async () => {
    setError(null);
    if (!finalCanvas) return setError('Hãy cắt (hoặc ghép) một vùng câu hỏi trước.');
    if (grade === '') return setError('Vui lòng chọn khối lớp (1 – 12).');
    const finalKey = part === 1 ? correctKey : part === 2 ? p2Key : p3Key.trim().replace(',', '.');
    if (part === 3 && !/^-?[0-9]+(\.[0-9]+)?$/.test(finalKey)) return setError('Đáp án phần III phải là số (vd 12 hoặc -1,5).');
    setSaving(true);
    try {
      const path = await uploadQuestionImage(userId, finalCanvas);
      const { error: dbErr } = await supabase.from('question_bank').insert({
        author_id: userId,
        subject,
        grade,
        topic_tags: parseHashtags(tags),
        difficulty,
        part,
        content_image_url: path,
        correct_key: finalKey,
        solution_text: solution.trim() || null,
        solution_files: solFiles,
        practice_enabled: practice,
      });
      if (dbErr) throw dbErr;
      setFinalCanvas(null);
      setSolution('');
      setSolFiles([]);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Lỗi lưu câu hỏi');
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = finalCanvas ? finalCanvas.toDataURL('image/webp', 0.6) : null;
  const parsedTags = parseHashtags(tags);
  const addTag = (t: string) => setTags(prev => (parseHashtags(prev).includes(t) ? prev : `${prev.trim()} #${t}`.trim()));

  return (
    <div className="fixed inset-0 z-50 yq-overlay flex items-center justify-center p-2 md:p-4">
      <div className="glass-panel rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-bold flex items-center gap-2"><Scissors className="w-4 h-4" /> Cắt câu hỏi từ PDF</h2>
          <button onClick={onClose} aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_340px]">
          {/* Vùng PDF */}
          <div className="min-h-0 flex flex-col border-r">
            <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-slate-50 text-sm">
              <label className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer flex items-center gap-1">
                <Upload className="w-4 h-4" /> Chọn PDF
                <input type="file" accept="application/pdf" className="hidden"
                  onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
              </label>
              {pageCount > 0 && (
                <>
                  <button disabled={pageNum <= 1} onClick={() => setPageNum(p => p - 1)} className="p-1.5 border rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                  <span>Trang {pageNum}/{pageCount}</span>
                  <button disabled={pageNum >= pageCount} onClick={() => setPageNum(p => p + 1)} className="p-1.5 border rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                  <button
                    onClick={() => setStitchMode(s => !s)}
                    className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 ${stitchMode ? 'bg-amber-100 border-amber-400' : ''}`}
                  >
                    <Layers className="w-4 h-4" /> Stitch {stitchMode ? 'BẬT' : 'tắt'}
                  </button>
                  {stitchMode && (
                    <button onClick={finishStitch} disabled={pieces.length === 0} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white disabled:opacity-40">
                      Ghép {pieces.length} vùng
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-slate-200 p-2">
              {loading && <p className="p-4 text-sm">Đang đọc PDF…</p>}
              {!pageCount && !loading && (
                <p className="p-4 text-sm text-slate-500">
                  Chọn file PDF, sau đó kéo chuột (hoặc ngón tay) để khoanh vùng một câu hỏi. Câu bị đứt trang: bật
                  Stitch, khoanh vùng cuối trang trước, sang trang sau khoanh tiếp rồi bấm "Ghép".
                </p>
              )}
              <div className="relative touch-none select-none" style={{ display: pageCount ? 'inline-block' : 'none' }}>
                <canvas ref={canvasRef} className="max-w-full h-auto block" />
                <div className="absolute inset-0 cursor-crosshair" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
                  {drag && (
                    <div
                      className="absolute border-2 border-emerald-500 bg-emerald-400/20"
                      style={{
                        left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1),
                        width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0),
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="overflow-auto p-4 space-y-3 text-sm">
            {stitchMode && pieces.length > 0 && (
              <p className="text-amber-700 bg-amber-50 rounded-lg p-2">Đã có {pieces.length} vùng chờ ghép.</p>
            )}
            {previewUrl ? (
              <img src={previewUrl} alt="Xem trước câu hỏi" className="w-full border rounded-lg" />
            ) : (
              <div className="h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-slate-400">Chưa có vùng cắt</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">Môn
                <select value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 w-full border rounded-lg px-2 py-2">
                  {Object.keys(SUBJECT_PRESETS).map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">Khối lớp *
                <select value={grade} onChange={e => setGrade(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full border rounded-lg px-2 py-2">
                  <option value="">— Chọn khối —</option>
                  {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">Mức độ
                <select value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} className="mt-1 w-full border rounded-lg px-2 py-2">
                  {[1, 2, 3, 4].map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                </select>
              </label>
              <label className="block">Dạng câu
                <select value={part} onChange={e => setPart(Number(e.target.value) as 1 | 2 | 3)} className="mt-1 w-full border rounded-lg px-2 py-2">
                  <option value={1}>Phần I · 4 lựa chọn</option>
                  <option value={2}>Phần II · Đúng/Sai</option>
                  <option value={3}>Phần III · Trả lời ngắn</option>
                </select>
              </label>
            </div>
            <div className="block">
              <span>Đáp án đúng</span>
              {part === 1 && (
                <select value={correctKey} onChange={e => setCorrectKey(e.target.value)} className="mt-1 w-full border rounded-lg px-2 py-2">
                  {['A', 'B', 'C', 'D'].map(k => <option key={k}>{k}</option>)}
                </select>
              )}
              {part === 2 && (
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {['a', 'b', 'c', 'd'].map((sub, i) => (
                    <label key={sub} className="text-xs text-slate-500">Ý {sub}
                      <select value={p2Key[i]} onChange={e => setP2Key(p2Key.slice(0, i) + e.target.value + p2Key.slice(i + 1))} className="w-full border rounded-lg px-1 py-2 text-sm text-slate-900">
                        <option value="T">Đúng</option>
                        <option value="F">Sai</option>
                      </select>
                    </label>
                  ))}
                </div>
              )}
              {part === 3 && (
                <input value={p3Key} onChange={e => setP3Key(e.target.value)} inputMode="decimal" placeholder="vd: 12 hoặc -1,5" className="mt-1 w-full border rounded-lg px-3 py-2" />
              )}
            </div>
            <div className="block">
              <label htmlFor="sn-tags">Hashtag chủ đề (vd: #tích-phân #diện-tích)</label>
              <input id="sn-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="#đạo-hàm #cực-trị" className="mt-1 w-full border rounded-lg px-3 py-2" />
              {parsedTags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{parsedTags.map(t => <span key={t} className="chip chip-primary">#{t}</span>)}</div>}
              {tagHints.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 items-center text-xs text-slate-500">
                  Đã dùng:
                  {tagHints.slice(0, 12).map(t => <button type="button" key={t} onClick={() => addTag(t)} className="chip chip-muted hover:bg-primary-light">#{t}</button>)}
                </div>
              )}
            </div>
            <div className="block">
              <label htmlFor="sn-sol">Lời giải chi tiết</label>
              <textarea id="sn-sol" value={solution} rows={4}
                        onChange={e => setSolution(e.target.value)}
                        onPaste={e => {
                          const imgs = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
                          if (imgs.length) { e.preventDefault(); addSolutionFiles(imgs); }
                        }}
                        placeholder="Gõ lời giải, hoặc dán (Ctrl+V) ảnh chụp lời giải vào đây"
                        className="mt-1 w-full border rounded-lg px-3 py-2" />
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <label className={`btn btn-secondary !py-1.5 ${solBusy || solFiles.length >= MAX_SOLUTION_FILES ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Paperclip className="w-4 h-4" /> {solBusy ? 'Đang tải…' : 'Đính kèm ảnh / PDF'}
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden"
                         onChange={e => { addSolutionFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
                </label>
                <span className="text-xs text-slate-500">Tối đa {MAX_SOLUTION_FILES} tệp · ảnh tự nén WebP · PDF ≤ 2 MB</span>
              </div>
              {solFiles.length > 0 && (
                <ul className="mt-2 grid grid-cols-2 gap-2">
                  {solFiles.map(f => (
                    <li key={f.path} className="border rounded-lg p-1.5 bg-white/70 flex items-center gap-2 text-xs">
                      {f.type === 'image'
                        ? <img src={getQuestionImageUrl(f.path)} alt="" className="w-10 h-10 object-cover rounded" />
                        : <FileText className="w-10 h-10 text-rose-500 shrink-0" />}
                      <span className="truncate flex-1" title={f.name}>{f.name}</span>
                      <button type="button" aria-label="Bỏ tệp" onClick={() => setSolFiles(prev => prev.filter(x => x.path !== f.path))} className="text-slate-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)} />
              Cho phép học sinh luyện tập câu này (kèm đáp án và lời giải sau khi kiểm tra)
            </label>
            {error && <p className="text-rose-600">{error}</p>}
            <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Đang lưu…' : 'Lưu vào Kho bài tập'}
            </button>
            <p className="text-xs text-slate-400">Ảnh được nén WebP (≤1000px) trước khi upload để tiết kiệm dung lượng.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
