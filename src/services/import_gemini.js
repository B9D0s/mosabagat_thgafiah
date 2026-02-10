/**
 * import_gemini.js
 * دمج محتوى data/gemini.json مع بنك الأسئلة الرئيسي data/questions.json
 * مع توحيد الصيغة وإزالة التكرار حسب نص السؤال العربي question_ar.
 *
 * Usage:
 *   node src/services/import_gemini.js
 */

const fs = require("fs");
const path = require("path");
const { validateQuestions } = require("../validators/questionValidator");

const MAIN_PATH = path.join(__dirname, "..", "..", "data", "questions.json");
const GEMINI_PATH = path.join(__dirname, "..", "..", "data", "gemini.json");

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function importGemini() {
  console.log("📥 دمج gemini.json مع بنك الأسئلة الرئيسي...\n");

  const mainArr = readJSON(MAIN_PATH);
  if (!Array.isArray(mainArr)) {
    console.error("❌ data/questions.json ليس مصفوفة JSON صالحة.");
    process.exit(1);
  }

  const geminiRaw = readJSON(GEMINI_PATH);
  if (!geminiRaw) {
    console.error("❌ ملف data/gemini.json غير موجود.");
    process.exit(1);
  }

  const geminiArr = Array.isArray(geminiRaw)
    ? geminiRaw
    : Array.isArray(geminiRaw.questions)
      ? geminiRaw.questions
      : [];

  if (!geminiArr.length) {
    console.warn("⚠️ لا توجد أسئلة في gemini.json (حقل questions). لن يتم دمج شيء.");
    return;
  }

  console.log(`📋 عدد الأسئلة الحالية في questions.json: ${mainArr.length}`);
  console.log(`📋 عدد الأسئلة في gemini.json: ${geminiArr.length}`);

  const combined = [...mainArr, ...geminiArr];

  const seen = new Set();
  const merged = [];

  for (const q of combined) {
    const key = (q.question_ar || "").trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(q);
  }

  console.log(`\n✅ بعد الدمج وإزالة التكرار: ${merged.length} سؤال فريد`);

  const validation = validateQuestions(merged);
  if (!validation.valid) {
    console.log(`\n⚠️  أخطاء التحقق: ${validation.errors.length} خطأ`);
    validation.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    if (validation.errors.length > 20) {
      console.log(`  ... و ${validation.errors.length - 20} أخطاء أخرى`);
    }
  }

  fs.writeFileSync(MAIN_PATH, JSON.stringify(merged, null, 2), "utf-8");
  console.log(`\n💾 تم تحديث data/questions.json بنجاح.`);

  console.log(`\n🎯 الإجمالي النهائي للأسئلة في JSON: ${merged.length}`);
}

if (require.main === module) {
  importGemini();
}

module.exports = { importGemini };

