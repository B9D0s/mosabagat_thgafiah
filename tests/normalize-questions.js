/**
 * توحيد (Normalize) الداتابيس: type / difficulty / category + تقرير + (اختياري) كتابة للملف
 *
 * الاستخدام:
 *   # فحص فقط
 *   node tests/normalize-questions.js
 *
 *   # تطبيق التوحيد (يكتب على data/questions.json)
 *   node tests/normalize-questions.js --apply
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const mainPath = path.join(repoRoot, 'data', 'questions.json');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');

function normalizeString(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function normalizeType(type) {
  const t = normalizeString(type).toLowerCase();
  if (t === 'mcq' || t === 'multiple_choice' || t === 'multiple choice') return 'mcq';
  if (t === 'tf' || t === 'truefalse' || t === 'true_false' || t === 'true/false' || t === 'true-false') return 'tf';
  return '';
}

function normalizeDifficulty(diff) {
  const d = normalizeString(diff).toLowerCase();
  if (['easy', 'medium', 'hard', 'extreme'].includes(d)) return d;
  if (['very_hard', 'very hard', 'veryhard', 'vhard', 'very-hard'].includes(d)) return 'extreme';
  // عربي
  if (['سهل', 'سهله'].includes(d)) return 'easy';
  if (['متوسط', 'متوسطه'].includes(d)) return 'medium';
  if (['صعب'].includes(d)) return 'hard';
  if (['صعب جدا', 'صعب جداً', 'صعب جدًا'].includes(d)) return 'extreme';
  return '';
}

// خريطة توحيد التصنيفات (كل المفاتيح lower-case)
const CATEGORY_MAP = {
  // ثقافة عامة
  'general_culture': 'الثقافة العامة',
  'general culture': 'الثقافة العامة',
  'ثقافة عامة': 'الثقافة العامة',
  'الثقافة العامة': 'الثقافة العامة',

  // جغرافيا
  'جغرافيا': 'الجغرافيا',
  'الجغرافيا': 'الجغرافيا',

  // سيرة
  'السيرة النبوية': 'السيرة',
  'السيرة': 'السيرة',

  // إسلاميات عامة
  'إسلامية': 'معلومات إسلامية',
  'اسلامية': 'معلومات إسلامية',
  'معلومات إسلامية': 'معلومات إسلامية',

  // علوم/رياضيات
  'علوم': 'العلوم',
  'العلوم': 'العلوم',
  'رياضيات': 'الرياضيات',
  'الرياضيات': 'الرياضيات'
};

function normalizeCategory(cat) {
  const c = normalizeString(cat);
  const k1 = c.toLowerCase();
  const k2 = k1.replace(/_/g, ' ');
  return CATEGORY_MAP[k1] || CATEGORY_MAP[k2] || c;
}

function validateQuestion(q) {
  if (!q || typeof q !== 'object') return { ok: false, reason: 'not_object' };
  const type = normalizeType(q.type);
  const question_ar = normalizeString(q.question_ar);
  const category = normalizeString(q.category);
  const difficulty = normalizeDifficulty(q.difficulty);

  if (!type) return { ok: false, reason: 'bad_type' };
  if (!question_ar) return { ok: false, reason: 'missing_question_ar' };
  if (!category) return { ok: false, reason: 'missing_category' };
  if (!difficulty) return { ok: false, reason: 'bad_difficulty' };

  if (type === 'tf') {
    if (typeof q.correctBoolean !== 'boolean') return { ok: false, reason: 'bad_correctBoolean' };
    return { ok: true };
  }

  if (!Array.isArray(q.options_ar) || q.options_ar.length !== 4) return { ok: false, reason: 'bad_options_ar' };
  const correctIndex = q.correctIndex;
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return { ok: false, reason: 'bad_correctIndex' };
  return { ok: true };
}

function keyOf(q) {
  return `${q.type}|${normalizeString(q.question_ar).toLowerCase()}`;
}

function main() {
  if (!fs.existsSync(mainPath)) {
    console.error('❌ لا يوجد data/questions.json');
    process.exit(1);
  }

  const raw = fs.readFileSync(mainPath, 'utf8');
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) {
    console.error('❌ data/questions.json ليس Array');
    process.exit(1);
  }

  const changes = { type: 0, difficulty: 0, category: 0 };
  const invalidReasons = new Map();
  const seen = new Set();
  let dup = 0;

  const normalized = arr.map((q) => {
    // ننسخ بدون ما نكسر الحقول الأخرى
    const out = { ...q };

    const nt = normalizeType(out.type);
    if (nt && nt !== out.type) { out.type = nt; changes.type++; }

    const nd = normalizeDifficulty(out.difficulty);
    if (nd && nd !== out.difficulty) { out.difficulty = nd; changes.difficulty++; }

    const nc = normalizeCategory(out.category);
    if (nc && nc !== out.category) { out.category = nc; changes.category++; }

    // تقرير التكرار بعد التطبيع
    const k = keyOf(out);
    if (seen.has(k)) dup++;
    else seen.add(k);

    const v = validateQuestion(out);
    if (!v.ok) invalidReasons.set(v.reason, (invalidReasons.get(v.reason) || 0) + 1);

    return out;
  });

  const invalidTotal = [...invalidReasons.values()].reduce((a, b) => a + b, 0);

  console.log(apply ? '✅ (تطبيق) تم توحيد الداتابيس' : '✅ (فحص) تقرير توحيد الداتابيس — لم يتم تعديل أي ملف');
  console.log(`- إجمالي الأسئلة: ${normalized.length}`);
  console.log(`- تغييرات type: ${changes.type}`);
  console.log(`- تغييرات difficulty: ${changes.difficulty}`);
  console.log(`- تغييرات category: ${changes.category}`);
  console.log(`- تكرار بعد التطبيع (type+question_ar): ${dup}`);
  console.log(`- عناصر غير مطابقة بعد التطبيع: ${invalidTotal}`);
  if (invalidTotal > 0) {
    console.log('📌 الأسباب:');
    for (const [reason, count] of [...invalidReasons.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${reason}: ${count}`);
    }
  }

  if (!apply) {
    console.log('\nℹ️ للتطبيق الفعلي: node tests/normalize-questions.js --apply');
    return;
  }

  if (dup > 0) {
    console.error('❌ يوجد تكرار بعد التطبيع. أوقفنا الكتابة لتجنب حذف/تغيير غير مقصود.');
    process.exit(1);
  }
  if (invalidTotal > 0) {
    console.error('❌ يوجد عناصر غير مطابقة بعد التطبيع. أصلحها أولاً.');
    process.exit(1);
  }

  fs.writeFileSync(mainPath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
}

main();

