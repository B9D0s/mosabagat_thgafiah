/**
 * server.js - Sultan Quiz API Server
 * سيرفر API مسابقات السلطان
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const { initDB } = require("./db/database");
const questionRoutes = require("./routes/questions");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static HTML files (games)
app.use(express.static(path.join(__dirname, "..")));

// API Routes
app.use("/api", questionRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    name: "Sultan Quiz API - مسابقات السلطان",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      categories: "GET /api/categories",
      random_questions: "GET /api/questions/random?type=mcq|tf|any&category=...&difficulty=...&count=5&exclude_ids=1,2,3&reveal=true",
      verify_answer: "POST /api/questions/verify { question_id, answer }",
      stats: "GET /api/stats",
    },
  });
});

// API documentation
app.get("/api", (req, res) => {
  res.json({
    name: "Sultan Quiz API 🏆",
    description: "بنك الأسئلة العربية للمسابقات",
    version: "1.0.0",
    endpoints: [
      {
        method: "GET",
        path: "/health",
        description: "فحص حالة السيرفر",
      },
      {
        method: "GET",
        path: "/api/categories",
        description: "الحصول على جميع الفئات",
      },
      {
        method: "GET",
        path: "/api/questions/random",
        description: "أسئلة عشوائية مع فلاتر",
        params: {
          type: "mcq | tf | any (default: any)",
          category: "اسم الفئة بالعربي",
          difficulty: "easy | medium | hard | extreme",
          count: "عدد الأسئلة (1-50, default: 5)",
          exclude_ids: "معرفات مفصولة بفاصلة",
          reveal: "true لإظهار الإجابات",
        },
      },
      {
        method: "POST",
        path: "/api/questions/verify",
        description: "التحقق من إجابة",
        body: {
          question_id: "معرف السؤال (رقم)",
          answer: "الإجابة (index لـ MCQ, true/false لـ TF)",
        },
      },
      {
        method: "GET",
        path: "/api/stats",
        description: "إحصائيات بنك الأسئلة",
      },
    ],
    points_system: {
      easy: "10 نقاط",
      medium: "20 نقطة",
      hard: "30 نقطة",
      extreme: "50 نقطة",
    },
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "المسار غير موجود",
    hint: "جرب GET /health أو GET /api للتوثيق",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ خطأ:", err.message);
  res.status(500).json({
    success: false,
    error: "خطأ في السيرفر",
  });
});

// Auto-seed: if DB is empty, seed from questions.json automatically
async function autoSeedIfEmpty() {
  const { getDB, saveDB } = require("./db/database");
  const { validateQuestions, POINTS_MAP } = require("./validators/questionValidator");
  const fs = require("fs");

  const db = getDB();
  const countResult = db.exec("SELECT COUNT(*) FROM questions");
  const count = countResult[0]?.values[0]?.[0] || 0;

  if (count > 0) {
    console.log(`📊 قاعدة البيانات تحتوي على ${count} سؤال`);
    return;
  }

  console.log("🌱 قاعدة البيانات فارغة، جاري الإدخال التلقائي من questions.json...");

  const jsonPath = path.join(__dirname, "..", "data", "questions.json");
  if (!fs.existsSync(jsonPath)) {
    console.warn("⚠️ ملف data/questions.json غير موجود، لن يتم إدخال أسئلة.");
    return;
  }

  const questions = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const icons = {
    "الصحابة": "🌟", "السيرة": "📜", "الفقه": "⚖️",
    "التاريخ الإسلامي": "🏛️", "الثقافة العامة": "📚", "القرآن الكريم": "📖",
    "الحديث الشريف": "📿", "العقيدة": "🕌", "اللغة العربية": "✍️", "الجغرافيا": "🌍",
  };

  const categories = {};
  let inserted = 0;

  for (const q of questions) {
    try {
      if (!categories[q.category]) {
        const existing = db.exec(`SELECT id FROM categories WHERE name_ar = '${q.category.replace(/'/g, "''")}'`);
        if (existing.length > 0 && existing[0].values.length > 0) {
          categories[q.category] = existing[0].values[0][0];
        } else {
          const icon = icons[q.category] || "📚";
          db.run(`INSERT INTO categories (name_ar, icon) VALUES ('${q.category.replace(/'/g, "''")}', '${icon}')`);
          const r = db.exec("SELECT last_insert_rowid()");
          categories[q.category] = r[0].values[0][0];
        }
      }

      const catId = categories[q.category];
      const pts = POINTS_MAP[q.difficulty] || 10;
      const qText = q.question_ar.replace(/'/g, "''");
      const src = (q.source_ar || "").replace(/'/g, "''");
      const expl = (q.explanation_ar || "").replace(/'/g, "''");

      const dup = db.exec(`SELECT id FROM questions WHERE question_ar = '${qText}'`);
      if (dup.length > 0 && dup[0].values.length > 0) continue;

      if (q.type === "mcq") {
        db.run(`INSERT INTO questions (type, category_id, difficulty, question_ar, source_ar, explanation_ar, points_base)
          VALUES ('mcq', ${catId}, '${q.difficulty}', '${qText}', '${src}', '${expl}', ${pts})`);
      } else {
        db.run(`INSERT INTO questions (type, category_id, difficulty, question_ar, correct_boolean, source_ar, explanation_ar, points_base)
          VALUES ('tf', ${catId}, '${q.difficulty}', '${qText}', ${q.correctBoolean ? 1 : 0}, '${src}', '${expl}', ${pts})`);
      }

      const qIdR = db.exec("SELECT last_insert_rowid()");
      const questionId = qIdR[0].values[0][0];

      if (q.type === "mcq" && q.options_ar) {
        q.options_ar.forEach((opt, idx) => {
          const isCorrect = idx === q.correctIndex ? 1 : 0;
          db.run(`INSERT INTO choices (question_id, choice_text_ar, choice_index, is_correct)
            VALUES (${questionId}, '${opt.replace(/'/g, "''")}', ${idx}, ${isCorrect})`);
        });
      }
      inserted++;
    } catch (e) { /* skip problematic questions */ }
  }

  saveDB();
  console.log(`✅ تم إدخال ${inserted} سؤال تلقائياً من questions.json`);
}

// Start server
async function start() {
  try {
    console.log("🔄 جاري تشغيل قاعدة البيانات...");
    await initDB();
    console.log("✅ قاعدة البيانات جاهزة");

    await autoSeedIfEmpty();

    app.listen(PORT, () => {
      console.log("\n" + "=".repeat(50));
      console.log("🏆 Sultan Quiz API - مسابقات السلطان");
      console.log("=".repeat(50));
      console.log(`🌐 السيرفر يعمل على: http://localhost:${PORT}`);
      console.log(`📋 التوثيق: http://localhost:${PORT}/api`);
      console.log(`❤️  الحالة: http://localhost:${PORT}/health`);
      console.log(`📊 الإحصائيات: http://localhost:${PORT}/api/stats`);
      console.log(`🎲 أسئلة عشوائية: http://localhost:${PORT}/api/questions/random`);
      console.log("=".repeat(50) + "\n");
    });
  } catch (err) {
    console.error("❌ فشل تشغيل السيرفر:", err);
    process.exit(1);
  }
}

start();
