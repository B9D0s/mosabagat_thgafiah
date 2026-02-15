# توليد أسئلة عبر AI (Gemini / Claude / OpenAI)

السكربت `gen_questions_gemini.mjs` يطلب من AI إنشاء أسئلة دفعة دفعة (25 سؤال لكل طلب) مع تحقق من الهيكلة وحذف التكرار.

يدعم ثلاثة مزودين بالترتيب — عند حد الحصة (429) على واحد، يجرب التالي:
- **Gemini** (Google)
- **Claude** (Anthropic)
- **ChatGPT** (OpenAI)

## الخطوات

### 1. الحصول على مفتاح API (واحد على الأقل)

- Gemini: [Google AI Studio](https://aistudio.google.com/apikey)
- Claude: [Anthropic Console](https://console.anthropic.com/) → API Keys
- ChatGPT: [OpenAI Platform](https://platform.openai.com/api-keys)

### 2. إعداد الملف `.env`

```bash
cp .env.example .env
```

ثم افتح `.env` وضع مفتاحاً واحداً على الأقل:

```
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
```

### 3. تثبيت الاعتمادات

```bash
npm install
```

### 4. تشغيل السكربت

```bash
npm run gen
```

يرفع السكربت عدد الدفعات حتى يصل إلى `TOTAL` (افتراضي 150). يكتب الناتج في `data/questions_add_500_new.json`.

### 5. دمج مع الداتابيس

بعد انتهاء التوليد:

```bash
node tests/merge-questions.js data/questions_add_500_new.json --apply --clear-after
```

## المتغيرات (في `.env`)

| المتغير | الافتراضي | الوصف |
|---------|-----------|-------|
| `GEMINI_API_KEY` | — | مفتاح Gemini (واحد على الأقل مطلوب) |
| `ANTHROPIC_API_KEY` | — | مفتاح Claude |
| `OPENAI_API_KEY` | — | مفتاح ChatGPT |
| `OUT_FILE` | `data/questions_add_500_new.json` | ملف الإخراج |
| `TOTAL` | 150 | العدد الكلي المطلوب |
| `BATCH` | 25 | عدد الأسئلة لكل طلب |
| `MODEL` | `gemini-2.5-flash` | نموذج Gemini |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | نموذج Claude |
| `OPENAI_MODEL` | `gpt-4o-mini` | نموذج OpenAI |

## التوزيع

- **النوع:** توازن tf / mcq تلقائياً
- **الصعوبة:** 10% easy | 20% medium | 40% hard | 30% extreme
- **التصنيفات:** 18 فئة (بما فيها الأحياء، علوم الفضاء، من القائل، من أنا؟، التاريخ)

## استئناف التشغيل

إذا توقف السكربت، شغّله مرة أخرى — يقرأ الملف الحالي ويكمل من حيث توقف.
