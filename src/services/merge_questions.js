/**
 * merge_questions.js
 * دمج جميع ملفات JSON الخاصة بالأسئلة في ملف واحد موحد: data/questions.json
 *
 * - يقرأ:
 *    - data/questions.json (إن وجد)
 *    - data/questions_islamicquiz.json (إن وجد)
 *    - data/questions_bank_v1.json (إن وجد)
 * - يدمجها في مصفوفة واحدة مع إزالة التكرار حسب نص السؤال العربي question_ar
 * - يعيد حفظ data/questions.json كملف رئيسي واحد
 *
 * Usage:
 *   node src/services/merge_questions.js
 */

const fs = require("fs");
const path = require("path");
const { validateQuestions } = require("../validators/questionValidator");

const MAIN_PATH = path.join(__dirname, "..", "..", "data", "questions.json");
const ISLAMIC_PATH = path.join(__dirname, "..", "..", "data", "questions_islamicquiz.json");
const BANK_V1_PATH = path.join(__dirname, "..", "..", "data", "questions_bank_v1.json");

function safeReadJSON(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`❌ خطأ في قراءة JSON من: ${filePath} - ${err.message}`);
    return [];
  }
}

function mergeQuestions() {
  console.log("📥 دمج ملفات الأسئلة في ملف واحد: data/questions.json\n");

  const mainQuestions = safeReadJSON(MAIN_PATH);
  const islamicQuestions = safeReadJSON(ISLAMIC_PATH);
  const bankV1Questions = safeReadJSON(BANK_V1_PATH);

  console.log(`📋 الأسئلة الحالية في questions.json: ${mainQuestions.length}`);
  console.log(`📋 أسئلة IslamicQuiz الخارجية: ${islamicQuestions.length}`);
  console.log(`📋 أسئلة بنك v1: ${bankV1Questions.length}`);

  const all = [...mainQuestions, ...islamicQuestions, ...bankV1Questions];

  // إزالة التكرار بالاعتماد على نص السؤال العربي
  const seen = new Set();
  const merged = [];

  for (const q of all) {
    const key = (q.question_ar || "").trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(q);
  }

  console.log(`\n✅ بعد الدمج وإزالة التكرار: ${merged.length} سؤال`);

  // تحقق سريع من صحة الهيكلة
  const validation = validateQuestions(merged);
  if (!validation.valid) {
    console.log(`\n⚠️  أخطاء التحقق: ${validation.errors.length} خطأ`);
    validation.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    if (validation.errors.length > 20) {
      console.log(`  ... و ${validation.errors.length - 20} أخطاء أخرى`);
    }
  }

  fs.writeFileSync(MAIN_PATH, JSON.stringify(merged, null, 2), "utf-8");
  console.log(`\n💾 تم تحديث الملف الرئيسي: data/questions.json`);
}

if (require.main === module) {
  mergeQuestions();
}

module.exports = { mergeQuestions };

