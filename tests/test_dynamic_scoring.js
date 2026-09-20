import assert from 'assert';

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

function calculateDynamicExamScore(answers, keys, config) {
  let totalScore = 0;
  let maxScore = 0;
  const scoreDetails = { part_1: {}, part_2: {}, part_3: {} };

  const p1Section = config.sections?.find(s => s.id === 'part_1');
  const p2Section = config.sections?.find(s => s.id === 'part_2');
  const p3Section = config.sections?.find(s => s.id === 'part_3');

  const p1Count = p1Section?.question_count ?? 12;
  const p1TotalScore = p1Section?.total_score ?? 3.0;

  const p2Count = p2Section?.question_count ?? 4;
  const p2TotalScore = p2Section?.total_score ?? 4.0;

  const p3Count = p3Section?.question_count ?? 6;
  const p3TotalScore = p3Section?.total_score ?? 3.0;

  // 1. Part 1
  const p1Unit = p1Count > 0 ? p1TotalScore / p1Count : 0;
  for (let i = 1; i <= p1Count; i++) {
    const studentAns = (answers.part_1?.[i] || '').trim().toUpperCase();
    const correctAns = (keys.part_1?.[i] || '').trim().toUpperCase();
    const isCorrect = Boolean(studentAns && studentAns === correctAns);
    const score = isCorrect ? p1Unit : 0;

    scoreDetails.part_1[i] = {
      is_correct: isCorrect,
      score: Math.round(score * 1000) / 1000,
      student_ans: studentAns,
      key: correctAns,
    };

    if (isCorrect) totalScore += score;
    maxScore += p1Unit;
  }

  // 2. Part 2
  const p2BasePerQuestion = p2Count > 0 ? p2TotalScore / p2Count : 0;
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

    let ratio = 0;
    if (correctCount === 1) ratio = 0.10;
    else if (correctCount === 2) ratio = 0.25;
    else if (correctCount === 3) ratio = 0.50;
    else if (correctCount === 4) ratio = 1.00;

    const scoreEarned = Math.round(ratio * p2BasePerQuestion * 1000) / 1000;
    scoreDetails.part_2[i] = {
      correct_count: correctCount,
      score: scoreEarned,
      details: subDetails,
    };

    totalScore += scoreEarned;
    maxScore += p2BasePerQuestion;
  }

  // 3. Part 3
  const p3Unit = p3Count > 0 ? p3TotalScore / p3Count : 0;
  for (let i = 1; i <= p3Count; i++) {
    const studentAns = answers.part_3?.[i] || '';
    const correctAns = keys.part_3?.[i] || '';
    const isCorrect = matchShortAnswer(studentAns, correctAns);
    const score = isCorrect ? p3Unit : 0;

    scoreDetails.part_3[i] = {
      is_correct: isCorrect,
      score: Math.round(score * 1000) / 1000,
      student_ans: studentAns,
      key: correctAns,
    };

    if (isCorrect) totalScore += score;
    maxScore += p3Unit;
  }

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    maxScore: Math.round(maxScore * 100) / 100,
    scoreDetails,
  };
}

// TEST 1: Môn Vật lí (18 câu P1 = 4.5đ, 4 câu P2 = 4.0đ, 6 câu P3 = 1.5đ)
console.log('Test 1: Kiểm thử preset môn Vật lí (Tổng 28 câu, 10 điểm)...');
const physicsConfig = {
  sections: [
    { id: 'part_1', question_count: 18, total_score: 4.5 },
    { id: 'part_2', question_count: 4, total_score: 4.0 },
    { id: 'part_3', question_count: 6, total_score: 1.5 },
  ]
};
const pAnswers = {
  part_1: { 1: 'A', 2: 'B', 3: 'C' }, // Đúng 3 câu: 3 * (4.5/18) = 0.75đ
  part_2: {
    1: { a: true, b: true, c: true, d: true }, // Đúng 4 ý: 1.0 * (4.0/4) = 1.0đ
    2: { a: true, b: true, c: true, d: false }, // Đúng 3 ý: 0.5 * 1.0 = 0.5đ
  },
  part_3: { 1: '1.5' } // Đúng 1 câu: 1 * (1.5/6) = 0.25đ
};
const pKeys = {
  part_1: { 1: 'A', 2: 'B', 3: 'C' },
  part_2: {
    1: { a: true, b: true, c: true, d: true },
    2: { a: true, b: true, c: true, d: true },
  },
  part_3: { 1: '1,5' }
};
const res1 = calculateDynamicExamScore(pAnswers, pKeys, physicsConfig);
// Dự kiến: P1: 0.75đ, P2: 1.0 + 0.5 = 1.5đ, P3: 0.25đ -> Tổng = 2.5đ
assert.strictEqual(res1.totalScore, 2.5, 'Điểm Vật lí phải là 2.5đ');
assert.strictEqual(res1.maxScore, 10.0, 'Thang điểm tối đa phải là 10.0đ');
console.log('✓ Test 1 Passed! (Điểm Vật lí:', res1.totalScore, '/', res1.maxScore, ')');

// TEST 2: Thang đo tùy biến (Ví dụ bài kiểm tra 15 phút: P1 = 4 câu (2đ), P2 = 2 câu (4đ), P3 = 4 câu (4đ))
console.log('Test 2: Kiểm thử thang đo tùy biến của giáo viên...');
const customConfig = {
  sections: [
    { id: 'part_1', question_count: 4, total_score: 2.0 }, // 0.5đ / câu
    { id: 'part_2', question_count: 2, total_score: 4.0 }, // 2.0đ / câu (lũy tiến: 0.2, 0.5, 1.0, 2.0)
    { id: 'part_3', question_count: 4, total_score: 4.0 }, // 1.0đ / câu
  ]
};
const cAnswers = {
  part_1: { 1: 'A', 2: 'A' }, // Đúng 2 câu: 2 * 0.5 = 1.0đ
  part_2: {
    1: { a: true, b: true, c: false, d: false }, // Đúng 2 ý: 25% * 2.0đ = 0.5đ
  },
  part_3: { 1: '10' } // Đúng 1 câu: 1.0đ
};
const cKeys = {
  part_1: { 1: 'A', 2: 'A' },
  part_2: {
    1: { a: true, b: true, c: true, d: true },
  },
  part_3: { 1: '10' }
};
const res2 = calculateDynamicExamScore(cAnswers, cKeys, customConfig);
// Dự kiến: P1: 1.0đ + P2: 0.5đ + P3: 1.0đ = 2.5đ
assert.strictEqual(res2.totalScore, 2.5, 'Điểm thang tùy biến phải là 2.5đ');
console.log('✓ Test 2 Passed! (Điểm tùy biến:', res2.totalScore, '/', res2.maxScore, ')');

console.log('\n======================================================');
console.log('TẤT CẢ TEST CASES THUẬT TOÁN ĐỘNG ĐÃ PASS 100%!');
console.log('======================================================');
