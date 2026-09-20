// Kiểm thử ma trận sinh đề ngẫu nhiên (biên dịch TS bằng esbuild có sẵn của Vite)
import { build } from 'esbuild';
import assert from 'node:assert/strict';

const out = await build({
  entryPoints: ['src/utils/autoGen.ts'],
  bundle: true,
  format: 'esm',
  write: false,
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const bank = [];
for (let i = 0; i < 6; i++) bank.push({ id: `a${i}`, topic_tags: ['tích-phân'], difficulty: 1 });
for (let i = 0; i < 3; i++) bank.push({ id: `b${i}`, topic_tags: ['đa-diện'], difficulty: 4 });

const ok = mod.pickRandomByMatrix(bank, [
  { part: 1, tag: 'tích-phân', difficulty: 1, count: 4 },
  { part: 1, tag: 'đa-diện', difficulty: 4, count: 2 },
]);
assert.ok(ok.questions, 'phải chọn được');
assert.equal(ok.questions.length, 6);
assert.equal(new Set(ok.questions.map(q => q.id)).size, 6, 'không trùng câu');
assert.equal(ok.questions.filter(q => q.topic_tags[0] === 'tích-phân').length, 4);
assert.equal(ok.questions.filter(q => q.difficulty === 4).length, 2);

const bad = mod.pickRandomByMatrix(bank, [{ part: 1, tag: 'đa-diện', difficulty: 4, count: 5 }]);
assert.ok(bad.error, 'thiếu câu phải báo lỗi');

const same = mod.pickRandomByMatrix(bank, [
  { part: 1, tag: 'tích-phân', difficulty: 1, count: 4 },
  { part: 1, tag: 'tích-phân', difficulty: 1, count: 4 },
]);
assert.ok(same.error, 'hai dòng cùng nhóm không được dùng lại câu đã chọn (6 < 8)');

// ---- Phần 2 và 3 ----
const bank2 = [
  ...Array.from({ length: 3 }, (_, i) => ({ id: `p1_${i}`, part: 1, topic_tags: ['hàm-số'], difficulty: 1, correct_key: 'ABCD'[i], solution_text: `s1_${i}` })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: `p2_${i}`, part: 2, topic_tags: ['hàm-số'], difficulty: 2, correct_key: i ? 'FFFF' : 'TFFT' })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: `p3_${i}`, part: 3, topic_tags: ['hàm-số'], difficulty: 3, correct_key: i ? '-1,5' : '12' })),
];
// dòng phần 2 không được lấy câu của phần 1 dù cùng chương
const wrongPart = mod.pickRandomByMatrix(bank2, [{ part: 2, tag: 'hàm-số', difficulty: 1, count: 1 }]);
assert.ok(wrongPart.error, 'phần 2 mức 1 không có câu nào');

// dòng ma trận cố tình xếp lộn thứ tự phần → đề vẫn ra I, II, III
const mixed = mod.pickRandomByMatrix(bank2, [
  { part: 3, tag: 'hàm-số', difficulty: 3, count: 2 },
  { part: 2, tag: 'hàm-số', difficulty: 2, count: 2 },
  { part: 1, tag: 'hàm-số', difficulty: 1, count: 3 },
]);
const asm = mod.assembleExam(mixed.questions);
assert.deepEqual(asm.sections.map(s => s.question_count), [3, 2, 2]);
assert.equal(asm.sections.reduce((a, s) => a + s.total_score, 0), 10, 'tổng điểm = 10');
assert.deepEqual(asm.ordered.map(q => q.part), [1, 1, 1, 2, 2, 3, 3], 'sắp theo phần');
assert.deepEqual(Object.keys(asm.keys.part_1_keys), ['1', '2', '3']);
assert.equal(Object.keys(asm.keys.part_2_keys).length, 2);
assert.equal(Object.keys(asm.keys.part_3_keys).length, 2);
assert.equal(asm.solutions[1].text.startsWith('s1_'), true);
// đáp án phần 2/3 chuyển đúng định dạng server chấm
const p2 = Object.values(asm.keys.part_2_keys);
assert.ok(p2.some(k => k.a === true && k.b === false && k.c === false && k.d === true), 'TFFT → a,d đúng');
assert.ok(Object.values(asm.keys.part_3_keys).includes('-1.5'), 'dấu phẩy thập phân → dấu chấm');

// chỉ có phần 1 → dồn đủ 10 điểm; thiếu phần 2 → chia 3:3 = 5:5
assert.equal(mod.assembleExam(bank2.filter(q => q.part === 1)).sections[0].total_score, 10);
const p13 = mod.assembleExam(bank2.filter(q => q.part !== 2)).sections;
assert.deepEqual([p13[0].total_score, p13[1].total_score, p13[2].total_score], [5, 0, 5]);

console.log('✓ test_autogen: tất cả case đạt');
