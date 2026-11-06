// Unit Test Suite for THPTQG 2025 Scoring Engine
import assert from 'assert';

// Ported scoring logic for standalone Node testing
const TF_PROGRESSIVE_POINTS = {
  0: 0.0,
  1: 0.1,
  2: 0.25,
  3: 0.5,
  4: 1.0,
};

function normalizeShortAnswer(input) {
  if (!input) return '';
  return String(input)
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/^\+/, '');
}

function matchShortAnswer(studentInput, correctKey) {
  if (!studentInput || !correctKey) return false;
  const cleanInput = normalizeShortAnswer(studentInput);
  const cleanKey = normalizeShortAnswer(correctKey);

  if (cleanInput === cleanKey) return true;

  const numInput = Number(cleanInput);
  const numKey = Number(cleanKey);

  if (!isNaN(numInput) && !isNaN(numKey)) {
    return Math.abs(numInput - numKey) < 1e-6;
  }
  return false;
}

function calculateExamScore(answers, keys, config) {
  let totalScore = 0;
  let maxScore = 0;
  const scoreDetails = { part_1: {}, part_2: {}, part_3: {} };

  const p1Count = config?.p1Count || 12;
  const p2Count = config?.p2Count || 4;
  const p3Count = config?.p3Count || 6;

  // 1. Part 1
  for (let i = 1; i <= p1Count; i++) {
    const studentAns = (answers.part_1?.[i] || '').trim().toUpperCase();
    const correctAns = (keys.part_1?.[i] || '').trim().toUpperCase();
    const isCorrect = Boolean(studentAns && studentAns === correctAns);
    const score = isCorrect ? 0.25 : 0;

    scoreDetails.part_1[i] = { is_correct: isCorrect, score, student_ans: studentAns, key: correctAns };
    if (isCorrect) totalScore += score;
    maxScore += 0.25;
  }

  // 2. Part 2
  for (let i = 1; i <= p2Count; i++) {
    const studentGroup = answers.part_2?.[i] || {};
    const keyGroup = keys.part_2?.[i] || {};
    const subItems = ['a', 'b', 'c', 'd'];

    let correctCount = 0;
    const subDetails = {};

    for (const sub of subItems) {
      const studentVal = studentGroup[sub];
      const keyVal = keyGroup[sub];
      const isCorrect = studentVal !== undefined && Boolean(studentVal) === Boolean(keyVal);
      subDetails[sub] = isCorrect;
      if (isCorrect) correctCount++;
    }

    const scoreEarned = TF_PROGRESSIVE_POINTS[correctCount] || 0;
    scoreDetails.part_2[i] = { correct_count: correctCount, score: scoreEarned, details: subDetails };
    totalScore += scoreEarned;
    maxScore += 1.0;
  }

  // 3. Part 3
  for (let i = 1; i <= p3Count; i++) {
    const studentAns = answers.part_3?.[i] || '';
    const correctAns = keys.part_3?.[i] || '';
    const isCorrect = matchShortAnswer(studentAns, correctAns);
    const score = isCorrect ? 0.5 : 0;

    scoreDetails.part_3[i] = { is_correct: isCorrect, score, student_ans: studentAns, key: correctAns };
    if (isCorrect) totalScore += score;
    maxScore += 0.5;
  }

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    maxScore: Math.round(maxScore * 100) / 100,
    scoreDetails,
  };
}

// ====================== TEST SUITE ======================
console.log('--- BẮT ĐẦU KIỂM THỬ BỘ THUẬT TOÁN CHẤM ĐIỂM THPTQG 2025 ---');

// Test 1: Chuẩn hóa đáp án Part 3
console.log('Test 1: Kiểm thử chuẩn hóa đáp số Phần III...');
assert.strictEqual(matchShortAnswer('1,5', '1.5'), true, 'Phải nhận diện 1,5 khớp 1.5');
assert.strictEqual(matchShortAnswer(' 1.50 ', '1.5'), true, 'Phải nhận diện khoảng trắng và số 0 thừa');
assert.strictEqual(matchShortAnswer('+253', '253'), true, 'Phải nhận diện dấu cộng thừa');
assert.strictEqual(matchShortAnswer('-0.5', '-.5'), true, 'Phải nhận diện số âm dạng -.5');
assert.strictEqual(matchShortAnswer('0.9', '0.9'), true, 'Khớp chính xác số thập phân');
assert.strictEqual(matchShortAnswer('1.499', '1.5'), false, 'Không được nhận diện sai số lớn');
assert.strictEqual(matchShortAnswer('', '1.5'), false, 'Chuỗi rỗng không được chấm đúng');
console.log('✓ Test 1 Passed!');

// Test 2: Chấm điểm lũy tiến Part 2
console.log('Test 2: Kiểm thử thang điểm lũy tiến Phần II (0.1, 0.25, 0.5, 1.0)...');
const sampleKeysP2 = {
  part_2: {
    1: { a: true, b: false, c: false, d: true },
    2: { a: true, b: false, c: false, d: true },
    3: { a: true, b: false, c: false, d: true },
    4: { a: true, b: false, c: false, d: true },
  }
};

// Học sinh:
// Câu 1: đúng 4 ý -> 1.0đ
// Câu 2: đúng 3 ý -> 0.5đ
// Câu 3: đúng 2 ý -> 0.25đ
// Câu 4: đúng 1 ý -> 0.1đ
const sampleAnswersP2 = {
  part_2: {
    1: { a: true, b: false, c: false, d: true }, // 4 đúng -> 1.0
    2: { a: true, b: false, c: false, d: false }, // 3 đúng (a, b, c) -> 0.5
    3: { a: true, b: false, c: true, d: false },  // 2 đúng (a, b) -> 0.25
    4: { a: true, b: true, c: true, d: false },   // 1 đúng (a) -> 0.10
  }
};

const resP2 = calculateExamScore(sampleAnswersP2, sampleKeysP2, { p1Count: 0, p2Count: 4, p3Count: 0 });
assert.strictEqual(resP2.totalScore, 1.85, 'Tổng điểm Phần II phải là 1.0 + 0.5 + 0.25 + 0.10 = 1.85');
console.log(`✓ Test 2 Passed! (Điểm thực tế: ${resP2.totalScore})`);

// Test 3: Bài thi hoàn hảo (10.0 / 10.0 điểm)
console.log('Test 3: Kiểm thử bài thi đạt điểm tuyệt đối 10.0...');
const perfectKeys = {
  part_1: { 1: 'C', 2: 'C', 3: 'A', 4: 'A', 5: 'C', 6: 'B', 7: 'C', 8: 'A', 9: 'D', 10: 'A', 11: 'D', 12: 'D' },
  part_2: {
    1: { a: false, b: false, c: false, d: true },
    2: { a: true, b: false, c: true, d: false },
    3: { a: false, b: true, c: true, d: true },
    4: { a: false, b: false, c: true, d: true },
  },
  part_3: { 1: '1.5', 2: '1.5', 3: '253', 4: '102', 5: '5', 6: '0.9' }
};

const perfectAnswers = {
  part_1: { 1: 'c', 2: 'C', 3: 'a ', 4: 'A', 5: 'C', 6: 'B', 7: 'C', 8: 'A', 9: 'D', 10: 'A', 11: 'D', 12: 'D' },
  part_2: {
    1: { a: false, b: false, c: false, d: true },
    2: { a: true, b: false, c: true, d: false },
    3: { a: false, b: true, c: true, d: true },
    4: { a: false, b: false, c: true, d: true },
  },
  part_3: { 1: '1,5', 2: '1.50', 3: '+253', 4: '102', 5: ' 5 ', 6: '0.9' }
};

const perfectRes = calculateExamScore(perfectAnswers, perfectKeys);
assert.strictEqual(perfectRes.totalScore, 10.0, 'Bài làm hoàn hảo phải đạt 10.0 điểm');
assert.strictEqual(perfectRes.maxScore, 10.0, 'Điểm tối đa phải là 10.0');
console.log(`✓ Test 3 Passed! (Tổng điểm: ${perfectRes.totalScore} / ${perfectRes.maxScore})`);

// Test 4: Bài thi bỏ trắng hoàn toàn
console.log('Test 4: Kiểm thử bài thi bỏ trắng...');
const emptyRes = calculateExamScore({ part_1: {}, part_2: {}, part_3: {} }, perfectKeys);
assert.strictEqual(emptyRes.totalScore, 0.0, 'Bài bỏ trắng phải đạt 0.0 điểm');
console.log(`✓ Test 4 Passed! (Tổng điểm: ${emptyRes.totalScore})`);

// Test 5: Kiểm thử bộ lọc 4 ký tự Phần III & chống XSS/Formula Injection Excel
function sanitizeShortAnswerInput(raw) {
  if (!raw) return '';
  const cleaned = String(raw).replace(/\s+/g, '');
  let out = '';
  let hasDecimal = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '-' && out.length === 0) {
      out += '-';
    } else if ((ch === ',' || ch === '.') && !hasDecimal) {
      hasDecimal = true;
      out += ch;
    } else if (ch >= '0' && ch <= '9') {
      out += ch;
    }
    if (out.length >= 4) break;
  }
  return out;
}

function escapeExcelHtml(val) {
  const raw = String(val ?? '');
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return formulaSafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

console.log('Test 5: Kiểm thử giới hạn 4 ký tự Phần III & Escape XSS/Formula Excel...');
assert.strictEqual(sanitizeShortAnswerInput('12,345'), '12,3', 'Giới hạn cứng tối đa 4 ký tự');
assert.strictEqual(sanitizeShortAnswerInput('-0,59'), '-0,5', 'Giữ dấu âm đầu chuỗi và tối đa 4 ký tự');
assert.strictEqual(sanitizeShortAnswerInput('1--2..3'), '12.3', 'Loại bỏ dấu trừ giữa chuỗi và dấu thập phân lặp');
assert.strictEqual(escapeExcelHtml('=cmd|\'/C calc\'!A0'), "&#39;=cmd|&#39;/C calc&#39;!A0", 'Chặn Excel Formula Injection');
assert.strictEqual(escapeExcelHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;', 'Chặn Stored XSS trong Excel HTML');
console.log('✓ Test 5 Passed!');

console.log('\n======================================================');
console.log('TẤT CẢ 5 BỘ TEST CASES ĐÃ ĐẠT 100% ĐỘ CHÍNH XÁC!');
console.log('======================================================');
