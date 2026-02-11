/**
 * توليد أسئلة عبر AI — دفعات صغيرة + تحقق + حذف تكرار
 *
 * يدعم: Gemini → Claude (Anthropic) → ChatGPT (OpenAI) → DeepSeek — يجرب بالترتيب مع fallback
 *
 * الاستخدام:
 *   1. أنشئ .env وأضف مفتاحاً واحداً على الأقل:
 *      GEMINI_API_KEY | ANTHROPIC_API_KEY | OPENAI_API_KEY
 *   2. npm install && npm run gen
 *
 * يكتب الناتج في data/questions_add_500_new.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { z } from "zod";
import { jsonrepair } from "jsonrepair";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY?.trim();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY?.trim();

const hasAnyKey =
  GEMINI_API_KEY || ANTHROPIC_API_KEY || OPENAI_API_KEY || DEEPSEEK_API_KEY;
if (!hasAnyKey) {
  console.error(
    "[ERROR] أضف مفتاحاً واحداً على الأقل في .env: GEMINI_API_KEY | ANTHROPIC_API_KEY | OPENAI_API_KEY | DEEPSEEK_API_KEY",
  );
  process.exit(1);
}

const OUT_FILE = path.join(repoRoot, process.env.OUT_FILE || "data/questions_add_500_new.json");
const TOTAL = Number(process.env.TOTAL || 150);
const BATCH = Number(process.env.BATCH || 25);
const MODEL = process.env.MODEL || "gemini-2.5-flash";
const DELAY_BETWEEN_BATCHES_MS = Number(process.env.DELAY_BETWEEN_BATCHES_MS || 12000);
const RETRY_AFTER_429_SEC = Number(process.env.RETRY_AFTER_429_SEC || 90);

const CATEGORIES = [
  "القرآن الكريم",
  "السيرة",
  "الفقه",
  "الحديث الشريف",
  "الصحابة",
  "العقيدة",
  "التاريخ الإسلامي",
  "الثقافة العامة",
  "الجغرافيا",
  "اللغة العربية",
  "العلوم",
  "الرياضيات",
  "معلومات إسلامية",
  "الأحياء",
  "علوم الفضاء",
  "من القائل",
];

const DifficultyEnum = z.enum(["easy", "medium", "hard", "extreme"]);
const CategoryEnum = z.enum(CATEGORIES);

const TfSchema = z.object({
  type: z.literal("tf"),
  category: CategoryEnum,
  difficulty: DifficultyEnum,
  question_ar: z.string().min(8),
  correctBoolean: z.boolean(),
  source_ar: z.string().optional(),
});

const McqSchema = z.object({
  type: z.literal("mcq"),
  category: CategoryEnum,
  difficulty: DifficultyEnum,
  question_ar: z.string().min(8),
  options_ar: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  source_ar: z.string().optional(),
});

const QuestionSchema = z.union([TfSchema, McqSchema]);

function log(msg, tag = "LOG") {
  const t = new Date().toLocaleTimeString("ar-SA", { hour12: false });
  console.log(`[${t}] [${tag}] ${msg}`);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeText(s) {
  return (s || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function signature(q) {
  const base = normalizeText(q.question_ar)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "");
  return `${q.type}::${q.category}::${q.difficulty}::${base}`;
}

function countBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}

function buildPrompt(batchSize, currentCounts) {
  const { tfCount, mcqCount } = currentCounts;
  const wantTf = tfCount < mcqCount;
  const targetTf = wantTf ? Math.ceil(batchSize * 0.55) : Math.floor(batchSize * 0.45);
  const targetMcq = batchSize - targetTf;

  // نريد معظم الأسئلة Hard / Extreme فقط
  const easyN = Math.max(0, Math.round(batchSize * 0.02)); // حتى الـ easy أصعب من المعتاد
  const medN = Math.max(0, Math.round(batchSize * 0.08));
  const hardN = Math.max(4, Math.round(batchSize * 0.40));
  let extN = batchSize - (easyN + medN + hardN);
  if (extN < 5) extN = Math.max(5, batchSize - easyN - medN - hardN);

  return `
أنت خبير مسابقات "مرتفعة الصعوبة جداً" باللغة العربية. المطلوب: إنشاء ${batchSize} سؤال صعبة جداً بصيغة JSON فقط.

# قيود صارمة
- أخرج JSON فقط (مصفوفة تبدأ بـ [ وتنتهي بـ ]) بدون أي نص إضافي.
- لا تضف id إطلاقًا.
- اللغة عربية فقط.
- التصنيفات: ${CATEGORIES.join("، ")}
- ممنوع التكرار. ممنوع أسئلة سطحية أو بديهية.
- الخيارات في MCQ مضللة جداً وقريبة من الصواب.

# الصعوبة (أولوية قصوى — رفع المستوى الفعلي لكل فئة)
- easy: المستوى الفعلي = صعب. لا يقدر عليها إلا من قرأ في التخصص. ممنوع أي سؤال يمكن لأي شخص عادي الإجابة عنه (مثل أعداد تقريبية، حقائق مشهورة، نعم/لا بديهية).
- medium: المستوى الفعلي = أصعب من المتوسط. يتطلب حفظ تفاصيل من مراجع أو تمييز مصطلحات متشابهة يخلط بينها غير المتخصص. لا يكفي الثقافة العامة.
- hard: المستوى الفعلي = صعب جداً. مستوى طالب ماجستير أو متخصص. أرقام/تواريخ/فروق دقيقة من كتب متخصصة. الخيارات في MCQ يجب أن تكون كلها معقولة ويصعب التمييز بدون معرفة عميقة.
- extreme: المستوى الفعلي = مستحيل على غير المتخصص. السؤال يجب أن يعتمد على: أرقام أو تواريخ أو أسماء أو قواعد لا تُذكر إلا في هوامش الكتب أو شروح المتخصصين. الإجابة لا تُعرف إلا بحفظ دقيق أو مراجعة نادرة. إذا كان السؤال يمكن تخمينه أو استنتاجه من سياق عام = ليس extreme. ممنوع وضع "extreme" على أي سؤال يمكن لطالب جامعي عادي أن يحزر الإجابة.

# ممنوع منعاً باتاً (أي مستوى)
- أسئلة تعتمد على حقائق عامة أو أرقام تقريبية ("أكثر من ألف"، "مئات"، "قديماً").
- أسئلة يمكن الإجابة عنها دون دراسة مسبقة في نفس المجال.
- أي سؤال لو سُئل لشخص عشوائي ونجح = السؤال فاشل. الهدف أن يفشل معظم الممتحنين إلا من لديه معرفة فعلية.

# التوزيع المطلوب داخل هذه الدفعة
- عدد tf تقريبًا: ${targetTf}
- عدد mcq تقريبًا: ${targetMcq}
- توزيع الصعوبة: easy: ${easyN} | medium: ${medN} | hard: ${hardN} | extreme: ${extN}

# شكل كل عنصر:
tf:
{"type":"tf","category":"...","difficulty":"...","question_ar":"...","correctBoolean":true}

mcq:
{"type":"mcq","category":"...","difficulty":"...","question_ar":"...","options_ar":["...","...","...","..."],"correctIndex":2}

اطبع المصفوفة كاملة الآن.
  `.trim();
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 8192 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "").trim();
}

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const block = data?.content?.find((c) => c.type === "text");
  return (block?.text || "").trim();
}

async function callOpenAI(prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || "").trim();
}

async function callDeepSeek(prompt) {
  const res = await fetch(
    "https://api.deepseek.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 8192,
      }),
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || "").trim();
}

async function generateJSON(prompt) {
  const providers = [
    { name: "Gemini", fn: callGemini, key: GEMINI_API_KEY },
    { name: "Claude", fn: callClaude, key: ANTHROPIC_API_KEY },
    { name: "OpenAI", fn: callOpenAI, key: OPENAI_API_KEY },
    { name: "DeepSeek", fn: callDeepSeek, key: DEEPSEEK_API_KEY },
  ];
  let lastErr;
  for (const p of providers) {
    if (!p.key) continue;
    try {
      const result = await p.fn(prompt);
      if (result) return result;
    } catch (e) {
      lastErr = e;
      const msg = String(e.message);
      const reason = msg.includes("429") ? "حد الحصة" : msg.includes("400") || msg.includes("401") || msg.includes("expired") ? "مفتاح غير صالح أو منتهي" : "خطأ";
      log(`${reason} على ${p.name} — التجربة بالمزود التالي...`, "FALLBACK");
    }
  }
  throw lastErr || new Error("لا يوجد مزود متاح");
}

function extractJSONArray(raw) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON array found");
  return raw.slice(start, end + 1);
}

function validateQuestions(arr) {
  const valid = [];
  const errors = [];
  const seen = new Set();

  for (let i = 0; i < arr.length; i++) {
    const q = arr[i];
    try {
      q.question_ar = normalizeText(q.question_ar);
      if (q.type === "mcq" && Array.isArray(q.options_ar)) {
        q.options_ar = q.options_ar.map(normalizeText);
      }
      if (q.source_ar) q.source_ar = normalizeText(q.source_ar);

      const parsed = QuestionSchema.parse(q);

      if (!hasArabic(parsed.question_ar)) throw new Error("question_ar has no Arabic letters");
      if (parsed.type === "mcq") {
        for (const opt of parsed.options_ar) {
          if (!hasArabic(opt)) throw new Error("option has no Arabic letters");
        }
        const uniq = new Set(parsed.options_ar.map((o) => o.trim()));
        if (uniq.size !== 4) throw new Error("duplicate options");
      }

      const sig = signature(parsed);
      if (seen.has(sig)) throw new Error("duplicate within batch");
      seen.add(sig);

      valid.push(parsed);
    } catch (e) {
      errors.push({ index: i, error: String(e?.message || e) });
    }
  }

  return { valid, errors };
}

async function main() {
  const providers = [];
  if (GEMINI_API_KEY) providers.push("Gemini");
  if (ANTHROPIC_API_KEY) providers.push("Claude");
  if (OPENAI_API_KEY) providers.push("OpenAI");
  if (DEEPSEEK_API_KEY) providers.push("DeepSeek");
  log("=== بدء توليد الأسئلة ===", "START");
  log(`الهدف: ${TOTAL} | الدفعة: ${BATCH} | النموذج: ${MODEL}`, "CFG");
  log(`المزودون المتاحون: ${providers.length ? providers.join("، ") : "لا شيء! أضف مفاتيح في .env"}`, "CFG");
  log(`ملف الإخراج: ${path.relative(repoRoot, OUT_FILE)}`, "CFG");

  ensureDir(OUT_FILE);

  let all = [];
  const globalSeen = new Set();
  let batchNum = 0;
  let consecutiveFails = 0;
  const MAX_CONSECUTIVE_FAILS = 3;

  if (fs.existsSync(OUT_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
      if (Array.isArray(prev)) {
        all = prev;
        for (const q of all) globalSeen.add(signature(q));
        log(`استئناف: تم تحميل ${all.length} سؤال من الملف`, "RESUME");
      }
    } catch {}
  }

  while (all.length < TOTAL) {
    batchNum++;
    const tfCount = all.filter((x) => x.type === "tf").length;
    const mcqCount = all.filter((x) => x.type === "mcq").length;
    const remaining = TOTAL - all.length;
    const batchSize = Math.min(BATCH, remaining);

    const pct = Math.round((all.length / TOTAL) * 100);
    log(`────────────────────────────────────────`, "BATCH");
    log(`الدفعة #${batchNum} | المطلوب: ${batchSize} | الإجمالي: ${all.length}/${TOTAL} (${pct}%)`, "BATCH");

    const prompt = buildPrompt(batchSize, { tfCount, mcqCount });

    log("جاري إرسال الطلب إلى AI...", "API");
    let raw;
    try {
      const start = Date.now();
      raw = await generateJSON(prompt);
      const ms = Date.now() - start;
      log(`تم استلام الرد (${ms}ms) | حجم: ${(raw.length / 1024).toFixed(1)} KB`, "API");
    } catch (e) {
      const is429 = String(e.message).includes("429");
      if (is429 && RETRY_AFTER_429_SEC > 0) {
        log(`حد الحصة على الجميع — انتظار ${RETRY_AFTER_429_SEC} ثانية ثم إعادة المحاولة...`, "RETRY");
        await new Promise((r) => setTimeout(r, RETRY_AFTER_429_SEC * 1000));
        continue;
      }
      log(`فشل الطلب: ${e.message}`, "ERROR");
      consecutiveFails++;
      if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
        log(`توقف بعد ${MAX_CONSECUTIVE_FAILS} محاولات فاشلة. تحقق من المفاتيح في .env (Gemini/Claude/OpenAI)`, "ERROR");
        process.exit(1);
      }
      continue;
    }

    let jsonText;
    try {
      jsonText = extractJSONArray(raw);
    } catch (e) {
      log(`فشل استخراج JSON: ${e.message}`, "ERROR");
      continue;
    }

    let arr;
    try {
      arr = JSON.parse(jsonText);
    } catch (parseErr) {
      try {
        const repaired = jsonrepair(jsonText);
        arr = JSON.parse(repaired);
        log(`تم إصلاح JSON المكسور وإعادة التحليل`, "PARSE");
      } catch (repairErr) {
        log(`فشل parse وإصلاح JSON: ${parseErr.message}`, "ERROR");
        continue;
      }
    }
    if (!Array.isArray(arr)) {
      log("النتيجة ليست مصفوفة", "ERROR");
      continue;
    }
    log(`تم تحليل ${arr.length} عنصر من الرد`, "PARSE");

    const { valid, errors } = validateQuestions(arr);
    if (errors.length) {
      const errReasons = countBy(errors, (e) => e.error);
      log(`مرفوض: ${errors.length} | أسباب: ${[...errReasons.entries()].map(([k, v]) => `${k}(${v})`).join(", ")}`, "VALIDATE");
      if (errors[0]) log(`مثال: س ${errors[0].index + 1} → ${errors[0].error}`, "VALIDATE");
    }

    const final = [];
    let dupCount = 0;
    for (const q of valid) {
      const sig = signature(q);
      if (globalSeen.has(sig)) {
        dupCount++;
        continue;
      }
      globalSeen.add(sig);
      final.push(q);
    }

    if (dupCount) log(`تكرار مع السابق: ${dupCount}`, "DEDUPE");

    if (final.length === 0) {
      log("لا أسئلة جديدة من هذه الدفعة. إعادة المحاولة...", "RETRY");
      continue;
    }

    consecutiveFails = 0;
    all.push(...final);

    const batchDiff = countBy(final, (x) => x.difficulty);
    log(`مضاف: ${final.length} (tf:${final.filter(x=>x.type==="tf").length} mcq:${final.filter(x=>x.type==="mcq").length}) | صعوبة: easy:${batchDiff.get("easy")||0} med:${batchDiff.get("medium")||0} hard:${batchDiff.get("hard")||0} ext:${batchDiff.get("extreme")||0}`, "ADDED");

    fs.writeFileSync(OUT_FILE, JSON.stringify(all, null, 2), "utf-8");

    const diffMap = countBy(all, (x) => x.difficulty);
    log(`محفوظ: ${all.length} سؤال | ${Object.fromEntries(diffMap)}`, "SAVE");

    if (all.length < TOTAL && DELAY_BETWEEN_BATCHES_MS > 0) {
      log(`انتظار ${DELAY_BETWEEN_BATCHES_MS / 1000} ثانية قبل الدفعة التالية (لتجنب حد الحصة)...`, "WAIT");
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  log("=== اكتمل التوليد ===", "DONE");
  log(`النتيجة: ${path.relative(repoRoot, OUT_FILE)}`, "DONE");
  log("التالي: node tests/merge-questions.js data/questions_add_500_new.json --apply --clear-after", "NEXT");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
