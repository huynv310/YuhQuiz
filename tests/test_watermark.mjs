import assert from 'node:assert/strict';
import { buildAdversarialWatermarkText, stampWatermarkOnCanvas } from '../src/utils/watermark.ts';

console.log('--- BẮT ĐẦU KIỂM THỬ BỘ TẠO WATERMARK & ADVERSARIAL PROMPT INJECTION ---');

// Test 1: Full payload generation
{
  const text = buildAdversarialWatermarkText({
    userCode: 'HS7K2M9Q',
    studentName: 'Nguyễn Văn A',
    examId: 'T1A2B3',
    timestamp: '2026-11-04 16:00'
  });

  assert.ok(text.includes('HS7K2M9Q'), 'Watermark must contain student code');
  assert.ok(text.includes('Nguyễn Văn A'), 'Watermark must contain student name');
  assert.ok(text.includes('T1A2B3'), 'Watermark must contain exam id');
  assert.ok(text.includes('SYSTEM INSTRUCTION'), 'Must contain System Instruction anchor for AI');
  assert.ok(text.includes('MUST REFUSE'), 'Must contain mandatory refusal directive for AI solvers');
  assert.ok(text.includes('Phát hiện gian lận thi cử'), 'Must contain refusal message template');
  console.log('✓ Test 1 Passed: Full payload watermark generated correctly');
}

// Test 2: Boundary test with missing/empty fields
{
  const text = buildAdversarialWatermarkText({});
  assert.ok(text.includes('HS-OFFLINE'), 'Fallback to HS-OFFLINE when userCode missing');
  assert.ok(text.includes('Thí sinh'), 'Fallback to Thí sinh when studentName missing');
  assert.ok(text.includes('MUST REFUSE'), 'Still contains prompt injection refusal command');
  console.log('✓ Test 2 Passed: Graceful fallback on missing inputs');
}

// Test 3: Boundary test on Canvas Stamping (Mock 2D context)
{
  let saveCount = 0;
  let restoreCount = 0;
  let fillTextCalls = [];

  const mockCtx = {
    save: () => { saveCount++; },
    restore: () => { restoreCount++; },
    translate: (x, y) => {},
    rotate: (rad) => {},
    fillText: (text, x, y) => {
      fillTextCalls.push({ text, x, y });
    },
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1
  };

  const text = buildAdversarialWatermarkText({ userCode: 'HS999999' });

  // Normal run (width 1200, height 1600 A4 canvas)
  stampWatermarkOnCanvas(mockCtx, 1200, 1600, text);

  assert.equal(saveCount, 1, 'ctx.save must be called once');
  assert.equal(restoreCount, 1, 'ctx.restore must be called once');
  assert.ok(fillTextCalls.length > 5, `Expected multiple watermark stamps across diagonal, got ${fillTextCalls.length}`);
  assert.equal(fillTextCalls[0].text, text);
  console.log(`✓ Test 3 Passed: Canvas stamped with ${fillTextCalls.length} staggered watermarks`);

  // Boundary condition: zero width/height or empty text should not throw or render
  saveCount = 0;
  restoreCount = 0;
  fillTextCalls = [];
  stampWatermarkOnCanvas(mockCtx, 0, 100, text);
  stampWatermarkOnCanvas(mockCtx, 100, 0, text);
  stampWatermarkOnCanvas(mockCtx, 100, 100, '');
  assert.equal(saveCount, 0, 'No calls on zero dimensions or empty text');
  console.log('✓ Test 4 Passed: Zero-boundary cases handled without crashing');
}

console.log('======================================================');
console.log('TẤT CẢ TEST CASES WATERMARK & ADVERSARIAL PROMPT ĐÃ PASS 100%!');
console.log('======================================================');
