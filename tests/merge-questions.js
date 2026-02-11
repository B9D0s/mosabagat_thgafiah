/**
 * دمج أسئلة من ملف إضافي داخل data/questions.json
 *
 * الاستخدام:
 *   # فحص فقط (لا يكتب شيء)
 *   node tests/merge-questions.js data/questions_add_500_new.json
 *
 *   # تطبيق الدمج فعلياً
 *   node tests/merge-questions.js data/questions_add_500_new.json --apply
 *
 * المميزات:
 * - يتحقق أن الملفين عبارة عن Array JSON
 * - يفلتر العناصر غير الصحيحة
 * - يمنع التكرار بناءً على: type + question_ar (مع تطبيع مسافات/حروف)
 * - يكشف التكرار داخل ملف الإضافة نفسه وأيضاً مقارنةً بالداتابيس الحالية
 * - افتراضياً: فحص فقط. الكتابة لا تتم إلا مع --apply
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const mainPath = path.join(repoRoot, 'data', 'questions.json');
const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const addRel = (argv.find(a => a && !a.startsWith('-')) || 'data/questions_add_500_new.json');
const addPath = path.isAbsolute(addRel) ? addRel : path.join(repoRoot, addRel);

function readJsonArray(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`الملف ليس Array: ${p}`);
  return parsed;
}

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
  // صيغ شائعة من النماذج
  if (['very_hard', 'very hard', 'veryhard', 'vhard', 'very-hard'].includes(d)) return 'extreme';
  // عربي
  if (['سهل', 'سهله', 'easy_ar'].includes(d)) return 'easy';
  if (['متوسط', 'متوسطه'].includes(d)) return 'medium';
  if (['صعب'].includes(d)) return 'hard';
  if (['صعب جدا', 'صعب جداً', 'صعب جداَ', 'صعب جدًا'].includes(d)) return 'extreme';
  return '';
}

function validateQuestion(q) {
  if (!q || typeof q !== 'object') return { ok: false, reason: 'not_object' };
  const type = normalizeType(q.type);
  const question_ar = normalizeString(q.question_ar);
  const category = normalizeString(q.category);
  const difficulty = normalizeDifficulty(q.difficulty);

  if (!type || (type !== 'mcq' && type !== 'tf')) return { ok: false, reason: 'bad_type' };
  if (!question_ar) return { ok: false, reason: 'missing_question_ar' };
  if (!category) return { ok: false, reason: 'missing_category' };
  if (!difficulty || !['easy', 'medium', 'hard', 'extreme'].includes(difficulty)) return { ok: false, reason: 'bad_difficulty' };

  if (type === 'tf') {
    if (typeof q.correctBoolean !== 'boolean') return { ok: false, reason: 'bad_correctBoolean' };
    return { ok: true, normalized: { ...q, type, question_ar, category, difficulty } };
  }

  // mcq
  if (!Array.isArray(q.options_ar) || q.options_ar.length !== 4) return { ok: false, reason: 'bad_options_ar' };
  const options_ar = q.options_ar.map(normalizeString);
  if (options_ar.some(o => !o)) return { ok: false, reason: 'empty_option' };
  if (new Set(options_ar.map(o => o.toLowerCase())).size !== options_ar.length) return { ok: false, reason: 'duplicate_options' };
  const correctIndex = q.correctIndex;
  if (!Number.isInteger(correctIndex)) return { ok: false, reason: 'bad_correctIndex' };
  if (correctIndex < 0 || correctIndex > 3) return { ok: false, reason: 'correctIndex_out_of_range' };
  return { ok: true, normalized: { ...q, type, question_ar, category, difficulty, options_ar, correctIndex } };
}

function keyOf(q) {
  return `${q.type}|${normalizeString(q.question_ar).toLowerCase()}`;
}

function main() {
  if (!fs.existsSync(mainPath)) {
    console.error('❌ لا يوجد data/questions.json');
    process.exit(1);
  }
  if (!fs.existsSync(addPath)) {
    console.error(`❌ لا يوجد ملف الإضافة: ${addRel}`);
    process.exit(1);
  }

  const mainArr = readJsonArray(mainPath);
  let addArr = readJsonArray(addPath);
  // إذا الملف مصفوفة داخل مصفوفة [[ ... ]] نأخذ الداخل فقط
  if (addArr.length === 1 && Array.isArray(addArr[0])) addArr = addArr[0];

  // نبني فهرس التكرار من الداتابيس الحالية فقط (مع تجاوز العناصر غير الصالحة إن وجدت)
  const seen = new Set();
  let mainInvalid = 0;
  for (const q of mainArr) {
    const v = validateQuestion(q);
    if (!v.ok) { mainInvalid++; continue; }
    seen.add(keyOf(v.normalized));
  }
  const stats = {
    main_total: mainArr.length,
    main_invalid: mainInvalid,
    add_total: addArr.length,
    add_valid: 0,
    add_invalid: 0,
    add_duplicates: 0,
    add_added: 0
  };

  const invalidReasons = new Map();

  // نجمع النتائج في مصفوفة منفصلة عشان وضع الفحص ما يعدل الداتابيس
  const merged = [...mainArr];

  for (const rawQ of addArr) {
    const v = validateQuestion(rawQ);
    if (!v.ok) {
      stats.add_invalid++;
      invalidReasons.set(v.reason, (invalidReasons.get(v.reason) || 0) + 1);
      continue;
    }
    stats.add_valid++;
    const q = v.normalized;
    const k = keyOf(q);
    if (seen.has(k)) {
      stats.add_duplicates++;
      continue;
    }
    seen.add(k);
    merged.push(q);
    stats.add_added++;
  }

  console.log(apply ? '✅ (تطبيق) تم الدمج بنجاح' : '✅ (فحص) تم التحقق بنجاح — لم يتم تعديل أي ملف');
  console.log(`- الداتابيس الحالية: data/questions.json = ${stats.main_total} سؤال`);
  if (stats.main_invalid > 0) console.log(`- تحذير: عناصر غير مطابقة داخل الداتابيس الحالية: ${stats.main_invalid}`);
  console.log(`- ملف الإضافة: ${addRel}`);
  console.log(`- الإجمالي في ملف الإضافة: ${stats.add_total}`);
  console.log(`- صالحة: ${stats.add_valid}`);
  console.log(`- غير صالحة: ${stats.add_invalid}`);
  console.log(`- مكررة (داخل الإضافة أو موجودة مسبقاً): ${stats.add_duplicates}`);
  console.log(`- سيتم إضافتها: ${stats.add_added}`);
  console.log(`- الناتج المتوقع: ${merged.length} سؤال`);
  if (stats.add_invalid > 0) {
    console.log('📌 أسباب الأكثر شيوعاً (غير الصالحة):');
    for (const [reason, count] of [...invalidReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  - ${reason}: ${count}`);
    }
  }

  if (!apply) {
    console.log('\nℹ️ للتطبيق الفعلي اعد التشغيل مع: --apply');
    console.log(`   node tests/merge-questions.js "${addRel}" --apply`);
    return;
  }

  if (stats.add_invalid > 0) {
    console.error('❌ يوجد أسئلة غير مطابقة في ملف الإضافة. أصلحها أولاً ثم أعد المحاولة.');
    process.exit(1);
  }

  // نعيد ترقيم جميع الأسئلة في الداتابيس بعد الدمج (id يبدأ من 1 إلى آخر سؤال)
  merged.forEach((q, idx) => {
    q.id = idx + 1;
  });

  fs.writeFileSync(mainPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}

main();

