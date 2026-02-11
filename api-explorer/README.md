# بنك الأسئلة الثقافية

واجهة استكشاف أسئلة الـ API (فلترة، بحث، سؤال عشوائي، تحميل JSON).

## تشغيل محلي (للمعاينة قبل الـ push)

من **جذر المشروع** (مجلد السلطان) في الطرفية:

```bash
npm run serve
```

ثم افتح في المتصفح:

```
http://localhost:3333/api-explorer/
```

إذا ظهر خطأ `ERR_CONNECTION_REFUSED`، تأكد أن الطرفية مفتوحة **داخل مجلد المشروع** (في Cursor: Terminal → New Terminal تكون غالباً في المشروع). إن كان المسار يحتوي أحرفاً عربية وقد فشل `cd`، افتح المجلد من مستكشف الملفات وادخل إلى المجلد ثم شغّل من هناك: `npm run serve`.

## ملاحظة

- الأسئلة تُحمّل من GitHub (رابط الـ CDN) إن كان متاحاً.
- إن فشل التحميل (مثلاً بدون نت)، السكربت يحاول تحميل `../data/questions.json` عند تشغيلك من خادم محلي (نفس المصدر).

## الرابط المباشر (من الجوال أو أي جهاز)

بعد تفعيل **GitHub Pages** للمستودع:

1. في GitHub: المستودع **mosabagat_thgafiah** → **Settings** → **Pages**.
2. تحت **Build and deployment** → **Source**: اختر **Deploy from a branch**.
3. **Branch**: اختر `main` (أو `master`) والمجلد **/ (root)** → **Save**.
4. انتظر 1–2 دقيقة ثم افتح الرابط:

```
https://b9d0s.github.io/mosabagat_thgafiah/api-explorer/
```

(حروف صغيرة في اسم المستخدم في الرابط.)

**إذا ظهر 404 "File not found":**

1. تأكد أن مجلد **api-explorer** مرفوع على GitHub: افتح المستودع وابحث عن مجلد `api-explorer` وفيه `index.html`.
2. إذا المجلد غير موجود، ارفعه من جهازك:
   ```bash
   git add api-explorer
   git commit -m "Add api-explorer (بنك الأسئلة)"
   git push origin main
   ```
3. جرّب الرابط مع اسم الملف صراحة:  
   `https://b9d0s.github.io/mosabagat_thgafiah/api-explorer/index.html`
4. في **Settings → Pages** تأكد أن النشر من الفرع **main** والمجلد **/ (root)**.
5. بعد أي push انتظر 1–3 دقائق حتى يُحدَّث الموقع.

## الأجهزة

التصميم متجاوب: جوال، تابلت، لابتوب.
