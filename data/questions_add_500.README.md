# ملف إضافة 500 سؤال

الملف المقصود لتجميع الأسئلة الجديدة هو:

- `data/questions_add_500.json`
- `data/questions_add_500_new.json` (**هذا هو الملف المعتمد الآن**)

## المطلوب داخل الملف

- لازم يكون **JSON Array فقط** بالشكل:

```json
[
  { ... سؤال 1 ... },
  { ... سؤال 2 ... }
]
```

- **ممنوع** أي نص خارج الـ JSON.
- لا تضف `id` (اختياري)—الأساس عندنا يعتمد على محتوى السؤال.

## نوعين من الأسئلة

### 1) صح/خطأ (`tf`)

```json
{
  "type": "tf",
  "category": "السيرة",
  "difficulty": "easy",
  "question_ar": "نص السؤال...",
  "correctBoolean": true,
  "source_ar": "اختياري"
}
```

### 2) اختيار من متعدد (`mcq`)

```json
{
  "type": "mcq",
  "category": "الفقه",
  "difficulty": "medium",
  "question_ar": "نص السؤال...",
  "options_ar": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
  "correctIndex": 2,
  "source_ar": "اختياري"
}
```

## دمج الأسئلة داخل الداتابيس الأساسية

بعد ما تملأ الملف، شغّل:

```bash
node tests/merge-questions.js data/questions_add_500_new.json
```

هذا الأمر يعمل **فحص فقط** (بدون تعديل أي ملف). إذا طلع التقرير سليم، طبّق الدمج فعلياً:

```bash
node tests/merge-questions.js data/questions_add_500_new.json --apply
```

السكربت راح:
- يدمج داخل `data/questions.json`
- يمنع التكرار حسب (`type` + `question_ar`)
- يطلع لك تقرير بعدد الأسئلة المضافة/المرفوضة

