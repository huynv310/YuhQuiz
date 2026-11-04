// tests/test_matrix_boundary.mjs
// Boundary tests & Glass-box tests for matrix random selection algorithm
import { build } from 'esbuild';
import assert from 'node:assert/strict';

const out = await build({
  entryPoints: ['src/utils/autoGen.ts'],
  bundle: true,
  format: 'esm',
  write: false,
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

console.log('--- BẮT ĐẦU KIỂM THỬ MA TRẬN & BOUNDARY CASES ---');

// Test 1: Giải quyết bế tắc tham lam (Most-Constrained-First)
console.log('Test 1: Kiểm thử Most-Constrained-First tránh deadlock giữa tag rỗng và tag cụ thể...');
const bankConstrained = [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `dh_${i}`, part: 1, topic_tags: ['dao-ham'], difficulty: 1 })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `hh_${i}`, part: 1, topic_tags: ['hinh-hoc'], difficulty: 1 })),
];

// Row 0 đòi "Mọi tag" 5 câu, Row 1 đòi "dao-ham" 5 câu
const res = mod.pickRandomByMatrix(bankConstrained, [
  { part: 1, tag: '', difficulty: 1, count: 5 },
  { part: 1, tag: 'dao-ham', difficulty: 1, count: 5 },
]);

assert.ok(res.questions, 'Phải thành công chọn đủ 10 câu nhờ Most-Constrained-First');
assert.equal(res.questions.length, 10);
assert.equal(new Set(res.questions.map(q => q.id)).size, 10, 'Không được trùng câu');
// Kiểm tra đúng 5 câu dao-ham và 5 câu hinh-hoc
assert.equal(res.questions.filter(q => q.topic_tags[0] === 'dao-ham').length, 5);
assert.equal(res.questions.filter(q => q.topic_tags[0] === 'hinh-hoc').length, 5);
// Kiểm tra bảo toàn thứ tự dòng ma trận: Row 0 (5 câu) xong mới đến Row 1 (5 câu)
const first5 = res.questions.slice(0, 5);
const last5 = res.questions.slice(5, 10);
assert.equal(last5.filter(q => q.topic_tags[0] === 'dao-ham').length, 5, 'Dòng dao-ham ở vị trí thứ 2 trong kết quả');
console.log('✓ Test 1 Passed!');

// Test 2: Boundary test: Vừa khít số lượng trong kho (pool.length === count)
console.log('Test 2: Kiểm thử cận biên pool.length === count...');
const exactRes = mod.pickRandomByMatrix(bankConstrained, [
  { part: 1, tag: 'dao-ham', difficulty: 1, count: 5 },
]);
assert.ok(exactRes.questions);
assert.equal(exactRes.questions.length, 5);
console.log('✓ Test 2 Passed!');

// Test 3: Boundary test: Vượt quá số lượng đúng 1 câu (pool.length + 1)
console.log('Test 3: Kiểm thử cận biên vượt quá số lượng (5 câu nhưng đòi 6 câu)...');
const overflowRes = mod.pickRandomByMatrix(bankConstrained, [
  { part: 1, tag: 'dao-ham', difficulty: 1, count: 6 },
]);
assert.ok(overflowRes.error, 'Phải báo lỗi thiếu câu');
assert.match(overflowRes.error, /chỉ còn 5\/6 câu/);
console.log('✓ Test 3 Passed!');

// Test 4: Boundary test: Kho trống 0 câu
console.log('Test 4: Kiểm thử kho rỗng...');
const emptyRes = mod.pickRandomByMatrix([], [
  { part: 1, tag: 'dao-ham', difficulty: 1, count: 1 },
]);
assert.ok(emptyRes.error, 'Kho rỗng phải báo lỗi');
console.log('✓ Test 4 Passed!');

// Test 5: Boundary test: 100 câu (giới hạn tối đa của hệ thống)
console.log('Test 5: Kiểm thử tải 100 câu...');
const bank100 = Array.from({ length: 100 }, (_, i) => ({ id: `q_${i}`, part: 1, topic_tags: ['toan'], difficulty: 2 }));
const res100 = mod.pickRandomByMatrix(bank100, [
  { part: 1, tag: 'toan', difficulty: 2, count: 100 },
]);
assert.ok(res100.questions);
assert.equal(res100.questions.length, 100);
assert.equal(new Set(res100.questions.map(q => q.id)).size, 100);
console.log('✓ Test 5 Passed!');

console.log('======================================================');
console.log('TẤT CẢ BOUNDARY & GLASS-BOX TESTS CHO MA TRẬN ĐÃ PASS 100%!');
console.log('======================================================');
