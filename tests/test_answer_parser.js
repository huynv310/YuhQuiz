function normalizeBool(val) {
  const v = val.trim().toLowerCase();
  if (v === 'đ' || v === 'd' || v === 't' || v === 'true' || v === 'đúng' || v === 'dung' || v === '1') return true;
  if (v === 's' || v === 'f' || v === 'false' || v === 'sai' || v === '0') return false;
  return null;
}

function parsePart1Line(line, target) {
  const regex = /(?:câu\s*)?(\d+)[\s.:\-_=)]*([ABCDabcd])\b/gi;
  let match;
  let hasMatch = false;

  while ((match = regex.exec(line)) !== null) {
    hasMatch = true;
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase();
    target[qNum] = ans;
  }

  if (!hasMatch) {
    const letters = line.trim().split(/[\s,;]+/);
    const allABCD = letters.every(l => /^[ABCDabcd]$/.test(l));
    if (allABCD && letters.length > 0) {
      let startIdx = Object.keys(target).length + 1;
      letters.forEach((l, idx) => {
        target[startIdx + idx] = l.toUpperCase();
      });
    }
  }
}

function parsePart2Line(line, target) {
  const groupRegex = /(?:câu\s*)?(\d+)[\s.:\-_=)]+([ĐDTSFđdtsf][\s\-_/]*[ĐDTSFđdtsf][\s\-_/]*[ĐDTSFđdtsf][\s\-_/]*[ĐDTSFđdtsf])/gi;
  let match;
  let matchedGroup = false;

  while ((match = groupRegex.exec(line)) !== null) {
    matchedGroup = true;
    const qNum = parseInt(match[1], 10);
    const letters = match[2].replace(/[\s\-_/]+/g, '').toLowerCase().split('');
    if (letters.length >= 4) {
      target[qNum] = {
        a: normalizeBool(letters[0]) ?? true,
        b: normalizeBool(letters[1]) ?? false,
        c: normalizeBool(letters[2]) ?? true,
        d: normalizeBool(letters[3]) ?? false,
      };
    }
  }

  if (!matchedGroup) {
    const qHeaderMatch = line.match(/(?:câu\s*)?(\d+)/i);
    const qNum = qHeaderMatch ? parseInt(qHeaderMatch[1], 10) : Object.keys(target).length + 1;
    
    const singleSubRegex = /([abcd])[\s.:\-_=)]+(đúng|dung|sai|true|false|[đdsftFĐDS])/gi;
    let subMatch;

    while ((subMatch = singleSubRegex.exec(line)) !== null) {
      const subKey = subMatch[1].toLowerCase();
      const bVal = normalizeBool(subMatch[2]);
      if (bVal !== null) {
        if (!target[qNum]) target[qNum] = {};
        target[qNum][subKey] = bVal;
      }
    }
  }
}

function parsePart3Line(line, target) {
  const regex = /(?:câu\s*)?(\d+)[\s.:\-_=)]+([+-]?[0-9]+(?:[.,][0-9]+)?)/gi;
  let match;

  while ((match = regex.exec(line)) !== null) {
    const qNum = parseInt(match[1], 10);
    const val = match[2].replace(',', '.').trim();
    target[qNum] = val;
  }
}

function parseBatchAnswerText(rawText) {
  const result = {
    part_1: {},
    part_2: {},
    part_3: {},
    summary: { p1Count: 0, p2Count: 0, p3Count: 0 },
    errors: [],
    warnings: [],
  };

  if (!rawText || !rawText.trim()) return result;

  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');

  let currentSection = 'auto';

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/ph[aầ]n\s*(?:iii|3)|part\s*(?:iii|3)/i.test(trimmed)) {
      currentSection = 'part_3';
      continue;
    }
    if (/ph[aầ]n\s*(?:ii|2)|part\s*(?:ii|2)/i.test(trimmed)) {
      currentSection = 'part_2';
      continue;
    }
    if (/ph[aầ]n\s*(?:i|1)|part\s*(?:i|1)/i.test(trimmed)) {
      currentSection = 'part_1';
      continue;
    }

    if (currentSection === 'part_1') {
      parsePart1Line(trimmed, result.part_1);
    } else if (currentSection === 'part_2') {
      parsePart2Line(trimmed, result.part_2);
    } else if (currentSection === 'part_3') {
      parsePart3Line(trimmed, result.part_3);
    } else {
      if (/(?:câu\s*)?\d+[\s.:\-_=)]+[ĐDTSFđdtsf][\s\-_/]*[ĐDTSFđdtsf][\s\-_/]*[ĐDTSFđdtsf][\s\-_/]*[ĐDTSFđdtsf]/i.test(trimmed)) {
        parsePart2Line(trimmed, result.part_2);
      } else if (/(?:câu\s*)?\d+[\s.:\-_=)]+[+-]?[0-9]+[.,][0-9]+/i.test(trimmed)) {
        parsePart3Line(trimmed, result.part_3);
      } else {
        parsePart1Line(trimmed, result.part_1);
      }
    }
  }

  if (Object.keys(result.part_1).length === 0 && Object.keys(result.part_2).length === 0 && Object.keys(result.part_3).length === 0) {
    const continuousMatch = rawText.trim().replace(/\s+/g, '').toUpperCase();
    if (/^[ABCD]+$/.test(continuousMatch)) {
      for (let i = 0; i < continuousMatch.length; i++) {
        result.part_1[i + 1] = continuousMatch[i];
      }
    }
  }

  result.summary.p1Count = Object.keys(result.part_1).length;
  result.summary.p2Count = Object.keys(result.part_2).length;
  result.summary.p3Count = Object.keys(result.part_3).length;

  return result;
}

console.log('--- BẮT ĐẦU KIỂM THỬ BỘ PHÂN TÍCH ĐÁP ÁN HÀNG LOẠT ---');

const sample1 = `
PHẦN I:
1A 2.B 3-C 4:D 5A 6B 7C 8D 9A 10B 11C 12D

PHẦN II:
1: ĐSĐS
2: D-S-D-S
3: TFTF
4: a: Đúng, b: Sai, c: Đúng, d: Sai

PHẦN III:
1: 1.5, 2: 253, 3: -4.2, 4: 0, 5: 12.05, 6: 100
`;

const res1 = parseBatchAnswerText(sample1);
console.log('Test 1 - Số câu: P1 =', res1.summary.p1Count, ', P2 =', res1.summary.p2Count, ', P3 =', res1.summary.p3Count);

if (res1.summary.p1Count === 12 && res1.summary.p2Count === 4 && res1.summary.p3Count === 6) {
  console.log('✓ Test 1 Passed: Nhận diện chuẩn 100% cả 3 phần!');
} else {
  console.error('✗ Test 1 Failed!', res1);
  process.exit(1);
}

// Test 2: Chuỗi liên tục ABCD
const sample2 = 'ABCDABCDABCD';
const res2 = parseBatchAnswerText(sample2);
if (res2.summary.p1Count === 12 && res2.part_1[1] === 'A' && res2.part_1[4] === 'D') {
  console.log('✓ Test 2 Passed: Nhận diện chuỗi liền 12 chữ cái Phần 1!');
} else {
  console.error('✗ Test 2 Failed!', res2);
  process.exit(1);
}

// Test 3: Đảo lộn số câu và số thập phân kiểu Việt Nam
const sample3 = `
PHẦN 1:
3C 1A 2B

PHẦN 3:
2: 250,5
1: 1,5
`;
const res3 = parseBatchAnswerText(sample3);
if (res3.part_1[1] === 'A' && res3.part_1[2] === 'B' && res3.part_1[3] === 'C' && res3.part_3[1] === '1.5' && res3.part_3[2] === '250.5') {
  console.log('✓ Test 3 Passed: Tự sắp xếp số câu và chuẩn hóa dấu phẩy thập phân thành công!');
} else {
  console.error('✗ Test 3 Failed!', res3);
  process.exit(1);
}

console.log('======================================================');
console.log('TẤT CẢ TEST CASES CỦA BỘ PARSER ĐÃ PASS 100%!');
console.log('======================================================');
