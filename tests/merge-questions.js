/**
 * دمج وتوحيد أسئلة — سكربت واحد لكل العمليات
 *
 * الاستخدام:
 *   # دمج بنوك خارجية
 *   node tests/merge-questions.js data/bank1.json data/bank2.json
 *   node tests/merge-questions.js data/bank1.json data/bank2.json --apply
 *
 *   # دمج ثم تفريغ ملف الإضافة ليكون جاهزاً للدورة التالية
 *   node tests/merge-questions.js data/questions_add_500_new.json --apply --clear-after
 *
 *   # توحيد الداتابيس فقط (type / difficulty / category) دون إضافة ملفات
 *   node tests/merge-questions.js --normalize
 *   node tests/merge-questions.js --normalize --apply
 *
 * المميزات:
 * - دمج ملف واحد أو عدة ملفات مع questions.json
 * - توحيد type / difficulty / category (بما فيها خريطة التصنيفات)
 * - منع التكرار + ترقيم id — افتراضياً فحص فقط، --apply للتطبيق
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const mainPath = path.join(repoRoot, 'data', 'questions.json');
const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const clearAfter = argv.includes('--clear-after');
const normalizeOnly = argv.includes('--normalize');
const addFiles = argv.filter(a => a && !a.startsWith('-'));

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
  if (['very_hard', 'very hard', 'veryhard', 'vhard', 'very-hard'].includes(d)) return 'extreme';
  if (['سهل', 'سهله', 'easy_ar'].includes(d)) return 'easy';
  if (['متوسط', 'متوسطه'].includes(d)) return 'medium';
  if (['صعب'].includes(d)) return 'hard';
  if (['صعب جدا', 'صعب جداً', 'صعب جداَ', 'صعب جدًا'].includes(d)) return 'extreme';
  return '';
}

const CATEGORY_MAP = {
  'general_culture': 'الثقافة العامة', 'general culture': 'الثقافة العامة',
  'ثقافة عامة': 'الثقافة العامة', 'الثقافة العامة': 'الثقافة العامة',
  'جغرافيا': 'الجغرافيا', 'الجغرافيا': 'الجغرافيا',
  'السيرة النبوية': 'السيرة', 'السيرة': 'السيرة',
  'إسلامية': 'معلومات إسلامية', 'اسلامية': 'معلومات إسلامية',
  'معلومات إسلامية': 'معلومات إسلامية',
  'علوم': 'العلوم', 'العلوم': 'العلوم',
  'رياضيات': 'الرياضيات', 'الرياضيات': 'الرياضيات',
  'أحياء': 'الأحياء', 'الاحياء': 'الأحياء', 'الأحياء': 'الأحياء',
  'علوم الفضاء': 'علوم الفضاء', 'علوم_الفضاء': 'علوم الفضاء',
  'من القائل': 'من القائل', 'من_القائل': 'من القائل',
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

  if (!type || (type !== 'mcq' && type !== 'tf')) return { ok: false, reason: 'bad_type' };
  if (!question_ar) return { ok: false, reason: 'missing_question_ar' };
  if (!category) return { ok: false, reason: 'missing_category' };
  if (!difficulty || !['easy', 'medium', 'hard', 'extreme'].includes(difficulty)) return { ok: false, reason: 'bad_difficulty' };

  const categoryNorm = normalizeCategory(category);

  if (type === 'tf') {
    if (typeof q.correctBoolean !== 'boolean') return { ok: false, reason: 'bad_correctBoolean' };
    return { ok: true, normalized: { ...q, type, question_ar, category: categoryNorm, difficulty } };
  }

  if (!Array.isArray(q.options_ar) || q.options_ar.length !== 4) return { ok: false, reason: 'bad_options_ar' };
  const options_ar = q.options_ar.map(normalizeString);
  if (options_ar.some(o => !o)) return { ok: false, reason: 'empty_option' };
  if (new Set(options_ar.map(o => o.toLowerCase())).size !== options_ar.length) return { ok: false, reason: 'duplicate_options' };
  const correctIndex = q.correctIndex;
  if (!Number.isInteger(correctIndex)) return { ok: false, reason: 'bad_correctIndex' };
  if (correctIndex < 0 || correctIndex > 3) return { ok: false, reason: 'correctIndex_out_of_range' };
  return { ok: true, normalized: { ...q, type, question_ar, category: categoryNorm, difficulty, options_ar, correctIndex } };
}

function keyOf(q) {
  return `${q.type}|${normalizeString(q.question_ar).toLowerCase()}`;
}

function expandPaths(patterns) {
  const result = [];
  for (const p of patterns) {
    const full = path.isAbsolute(p) ? p : path.join(repoRoot, p);
    if (p.includes('*')) {
      const dir = path.dirname(full);
      const base = path.basename(full).replace(/\*/g, '.*');
      const re = new RegExp('^' + base.replace(/\./g, '\\.') + '$');
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir)) {
          if (re.test(f)) result.push(path.join(dir, f));
        }
      }
    } else if (fs.existsSync(full)) {
      result.push(full);
    }
  }
  return result;
}

function runNormalizeOnly() {
  if (!fs.existsSync(mainPath)) {
    console.error('❌ لا يوجد data/questions.json');
    process.exit(1);
  }
  const arr = readJsonArray(mainPath);
  const changes = { type: 0, difficulty: 0, category: 0 };
  const seen = new Set();
  let dup = 0;
  const invalidReasons = new Map();

  const normalized = arr.map((q) => {
    const out = { ...q };
    const nt = normalizeType(out.type);
    if (nt && nt !== out.type) { out.type = nt; changes.type++; }
    const nd = normalizeDifficulty(out.difficulty);
    if (nd && nd !== out.difficulty) { out.difficulty = nd; changes.difficulty++; }
    const nc = normalizeCategory(out.category);
    if (nc && nc !== out.category) { out.category = nc; changes.category++; }
    const k = keyOf(out);
    if (seen.has(k)) dup++;
    else seen.add(k);
    const v = validateQuestion(out);
    if (!v.ok) invalidReasons.set(v.reason, (invalidReasons.get(v.reason) || 0) + 1);
    return out;
  });

  const invalidTotal = [...invalidReasons.values()].reduce((a, b) => a + b, 0);
  console.log(apply ? '✅ (تطبيق) تم توحيد الداتابيس' : '✅ (فحص) تقرير توحيد — لم يتم تعديل أي ملف');
  console.log(`- إجمالي: ${normalized.length} | تغييرات type: ${changes.type} | difficulty: ${changes.difficulty} | category: ${changes.category}`);
  console.log(`- تكرار: ${dup} | غير مطابقة: ${invalidTotal}`);
  if (invalidTotal > 0) {
    for (const [r, c] of [...invalidReasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  - ${r}: ${c}`);
  }
  if (!apply) {
    console.log('\nℹ️ للتطبيق: node tests/merge-questions.js --normalize --apply');
    return;
  }
  if (dup > 0 || invalidTotal > 0) {
    console.error('❌ أصلح التكرار أو العناصر غير المطابقة أولاً.');
    process.exit(1);
  }
  normalized.forEach((q, i) => { q.id = i + 1; });
  fs.writeFileSync(mainPath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
}

function main() {
  if (!fs.existsSync(mainPath)) {
    console.error('❌ لا يوجد data/questions.json');
    process.exit(1);
  }

  if (normalizeOnly) {
    runNormalizeOnly();
    return;
  }

  const toMerge = addFiles.length ? expandPaths(addFiles) : expandPaths(['data/questions_add_500_new.json']);
  if (toMerge.length === 0) {
    console.error('❌ لم يُعثر على ملفات. مثال: node tests/merge-questions.js data/bank1.json data/bank2.json');
    process.exit(1);
  }

  const mainArr = readJsonArray(mainPath);

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
    add_total: 0,
    add_valid: 0,
    add_invalid: 0,
    add_duplicates: 0,
    add_added: 0
  };

  const invalidReasons = new Map();
  let merged = [...mainArr];

  for (const addPath of toMerge) {
    let addArr = readJsonArray(addPath);
    if (addArr.length === 1 && Array.isArray(addArr[0])) addArr = addArr[0];
    stats.add_total += addArr.length;

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
  }

  const filesLabel = toMerge.length === 1 ? path.relative(repoRoot, toMerge[0]) : `${toMerge.length} ملف`;
  console.log(apply ? '✅ (تطبيق) تم الدمج بنجاح' : '✅ (فحص) تم التحقق بنجاح — لم يتم تعديل أي ملف');
  console.log(`- الداتابيس الحالية: data/questions.json = ${stats.main_total} سؤال`);
  if (stats.main_invalid > 0) console.log(`- تحذير: عناصر غير مطابقة داخل الداتابيس الحالية: ${stats.main_invalid}`);
  console.log(`- ملفات الإضافة: ${filesLabel}`);
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
    const args = toMerge.map(p => path.relative(repoRoot, p)).join(' ');
    console.log(`   node tests/merge-questions.js ${args} --apply`);
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

  if (clearAfter && toMerge.length > 0) {
    const empty = '[]\n';
    for (const p of toMerge) {
      fs.writeFileSync(p, empty, 'utf8');
      console.log(`- تم تفريغ: ${path.relative(repoRoot, p)} ← جاهز لإضافة أسئلة جديدة`);
    }
  }
}

main();

