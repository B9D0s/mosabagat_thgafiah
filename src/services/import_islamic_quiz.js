/**
 * import_islamic_quiz.js
 * استيراد أسئلة IslamicQuizAPI وتحويلها لصيغة بنك الأسئلة في مشروع السلطان
 *
 * Usage:
 *   node src/services/import_islamic_quiz.js path/to/islamic_quiz.json [output_file]
 *
 * مثال تشغيل (بعد تحميل ملف JSON من المستودع الخارجي):
 *   node src/services/import_islamic_quiz.js external/islamic_quiz_questions.json data/questions_islamicquiz.json
 *   node seed/seed_questions.js data/questions_islamicquiz.json
 */

const fs = require("fs");
const path = require("path");

const { validateQuestions } = require("../validators/questionValidator");
const { classifyCategory, classifyDifficulty, cleanArabicText } = require("./ingest");

const DEFAULT_INPUT = path.join(__dirname, "..", "..", "external", "islamic_quiz.json");
const DEFAULT_OUTPUT = path.join(__dirname, "..", "..", "data", "questions_islamicquiz.json");

/**
 * تطبيع الفئة الواردة من IslamicQuizAPI لتتوافق (قدر الإمكان) مع فئات المشروع
 */
function mapCategory(externalCategory, questionText) {
  const raw = (externalCategory || "").trim();

  // خرائط مباشرة من المستودع الخارجي إلى فئاتنا
  const directMap = {
    "التفسير": "القرآن الكريم",
    "العقيدة": "العقيدة",
    "الحديث": "الحديث الشريف",
    "الفقه": "الفقه",
    "التاريخ": "التاريخ الإسلامي",
    "التاريخ الإسلامي": "التاريخ الإسلامي",
    "اللغة العربية": "اللغة العربية",
    "الثقافة العامة": "الثقافة العامة",
  };

  if (directMap[raw]) {
    return directMap[raw];
  }

  // لو ما عرفنا الفئة من الاسم، نستخدم مصنّف المحتوى الموجود في ingest.js
  if (questionText) {
    return classifyCategory(questionText);
  }

  return "الثقافة العامة";
}

/**
 * تحويل سؤال واحد من IslamicQuizAPI إلى صيغة مشروع السلطان
 *
 * الشكل المتوقع من IslamicQuizAPI (تقريباً):
 * {
 *   "id": 1,
 *   "q": "نص السؤال",
 *   "link": "https://dorar.net/...",
 *   "answers": [
 *     { "answer": "خيار 1", "t": 0 },
 *     { "answer": "خيار 2", "t": 1 },
 *     { "answer": "خيار 3", "t": 0 }
 *   ],
 *   "category": "الفقه",
 *   "topic": "الهبات"
 * }
 */
function mapExternalQuestion(q, index) {
  const prefix = `سؤال خارجي #${index + 1}`;

  if (!q || !q.q || !Array.isArray(q.answers) || q.answers.length < 2) {
    console.warn(`⚠️ ${prefix}: تم تخطيه (لا يحتوي على نص سؤال أو إجابات كافية).`);
    return null;
  }

  const questionText = cleanArabicText(q.q);

  const options = q.answers
    .map((a) => (a && a.answer ? cleanArabicText(String(a.answer)) : null))
    .filter((opt) => opt && opt.length > 0);

  if (options.length < 2) {
    console.warn(`⚠️ ${prefix}: تم تخطيه (عدد الخيارات بعد التنظيف أقل من 2).`);
    return null;
  }

  let correctIndex = q.answers.findIndex((a) => a && Number(a.t) === 1);
  if (correctIndex < 0 || correctIndex >= options.length) {
    // لو لم نجد مؤشر صحيح واضح، نعتبر أول خيار هو الصحيح (أفضل من رمي السؤال بالكامل)
    console.warn(`⚠️ ${prefix}: لم يتم العثور على إجابة صحيحة صريحة، سيتم افتراض الخيار الأول كإجابة صحيحة.`);
    correctIndex = 0;
  }

  const category = mapCategory(q.category, questionText);
  const difficulty = classifyDifficulty(questionText);

  return {
    type: "mcq",
    category,
    difficulty,
    question_ar: questionText,
    options_ar: options,
    correctIndex,
    source_ar: q.link || "IslamicQuizAPI / dorar.net",
  };
}

/**
 * قراءة ملف JSON من IslamicQuizAPI وإخراجه بصيغة الأسئلة الموحّدة
 */
function importIslamicQuiz(inputPath, outputPath) {
  console.log(`📥 قراءة بيانات IslamicQuizAPI من: ${inputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ ملف الإدخال غير موجود: ${inputPath}`);
    console.log(
      "\nℹ️  حمّل ملف الأسئلة من مستودع IslamicQuizAPI (مجلد database أو JSON مرفق بالإصدار)\n" +
        "    ثم نفّذ الأمر مع المسار الصحيح للملف."
    );
    process.exit(1);
  }

  const rawContent = fs.readFileSync(inputPath, "utf-8");

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    console.error(`❌ خطأ في قراءة JSON: ${err.message}`);
    process.exit(1);
  }

  // نحاول دعم أكثر من شكل محتمل للملف (مصفوفة مباشرة أو كائن يحتوي على questions/data)
  let externalQuestions = [];
  if (Array.isArray(parsed)) {
    externalQuestions = parsed;
  } else if (Array.isArray(parsed.questions)) {
    externalQuestions = parsed.questions;
  } else if (Array.isArray(parsed.data)) {
    externalQuestions = parsed.data;
  }

  if (!externalQuestions.length) {
    console.error("❌ لم يتم العثور على أسئلة في ملف الإدخال (لا يوجد مصفوفة questions أو data).");
    process.exit(1);
  }

  console.log(`📋 عدد الأسئلة الخام: ${externalQuestions.length}`);

  const mappedQuestions = [];

  externalQuestions.forEach((q, index) => {
    const mapped = mapExternalQuestion(q, index);
    if (mapped) {
      mappedQuestions.push(mapped);
    }
  });

  console.log(`✅ تم تحويل: ${mappedQuestions.length} سؤال (من أصل ${externalQuestions.length})`);

  // التحقق باستخدام نفس Validator المستخدم في باقي المشروع
  const validation = validateQuestions(mappedQuestions);
  if (!validation.valid) {
    console.log(`\n⚠️  أخطاء التحقق: ${validation.errors.length} خطأ`);
    validation.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    if (validation.errors.length > 20) {
      console.log(`  ... و ${validation.errors.length - 20} أخطاء أخرى`);
    }
  }

  // حفظ الملف الناتج
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(mappedQuestions, null, 2), "utf-8");
  console.log(`\n💾 تم حفظ الملف المحوّل في: ${outputPath}`);
  console.log(`   عدد الأسئلة الجاهزة للإدخال في القاعدة: ${mappedQuestions.length}`);

  return mappedQuestions;
}

// تشغيل مباشر من سطر الأوامر
if (require.main === module) {
  const input = process.argv[2] || DEFAULT_INPUT;
  const output = process.argv[3] || DEFAULT_OUTPUT;
  importIslamicQuiz(input, output);
}

module.exports = {
  importIslamicQuiz,
  mapExternalQuestion,
  mapCategory,
};

