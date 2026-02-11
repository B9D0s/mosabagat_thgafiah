/**
 * اختبار منطق لعبة صح/خطأ: التأكد أن كل مستوى صعوبة ينتج مجموعة أسئلة غير فاضية
 * تشغيل: node tests/true-false-pool-test.js
 */
const fs = require('fs');
const path = require('path');

const DIFFICULTY_MIX = {
  easy:    { easy: 0.60, medium: 0.30, hard: 0.10 },
  medium:  { easy: 0.20, medium: 0.55, hard: 0.25 },
  hard:    { easy: 0.10, medium: 0.25, hard: 0.65 },
  extreme: { easy: 0.05, medium: 0.15, hard: 0.80 }
};
const MAX_QUESTIONS = 60;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPool(RAW_QUESTIONS_BY_DIFF, difficulty) {
  const mix = DIFFICULTY_MIX[difficulty] || DIFFICULTY_MIX.medium;
  const target = MAX_QUESTIONS;

  let easyCount  = Math.round(target * mix.easy);
  let medCount   = Math.round(target * mix.medium);
  let hardCount  = Math.round(target * mix.hard);
  let total = easyCount + medCount + hardCount;
  if (total > target) medCount -= (total - target);
  if (total < target) medCount += (target - total);

  const pickFrom = (arr, count) => shuffleArray([...arr]).slice(0, count);

  let pool = [
    ...pickFrom(RAW_QUESTIONS_BY_DIFF.easy, easyCount),
    ...pickFrom(RAW_QUESTIONS_BY_DIFF.medium, medCount),
    ...pickFrom(RAW_QUESTIONS_BY_DIFF.hard, hardCount)
  ];

  if (pool.length < target) {
    const usedIds = new Set(pool.map(q => q.q));
    const allRemaining = [
      ...RAW_QUESTIONS_BY_DIFF.easy,
      ...RAW_QUESTIONS_BY_DIFF.medium,
      ...RAW_QUESTIONS_BY_DIFF.hard
    ].filter(q => !usedIds.has(q.q));
    pool = [...pool, ...shuffleArray(allRemaining).slice(0, target - pool.length)];
  }

  return shuffleArray(pool).slice(0, MAX_QUESTIONS);
}

const jsonPath = path.join(__dirname, '..', 'data', 'questions.json');
if (!fs.existsSync(jsonPath)) {
  console.error('❌ الملف data/questions.json غير موجود');
  process.exit(1);
}

const all = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const tfQuestions = all.filter(q => q.type === 'tf');

if (tfQuestions.length === 0) {
  console.error('❌ لا توجد أسئلة من نوع tf في الملف');
  process.exit(1);
}

const RAW_QUESTIONS_BY_DIFF = { easy: [], medium: [], hard: [] };
const DIFF_PTS = { easy: 10, medium: 20, hard: 30 };
tfQuestions.forEach(q => {
  const diff = q.difficulty === 'extreme' ? 'hard' : (q.difficulty || 'medium');
  const bucket = diff === 'hard' ? 'hard' : (diff === 'easy' ? 'easy' : 'medium');
  RAW_QUESTIONS_BY_DIFF[bucket].push({
    q: q.question_ar,
    a: q.correctBoolean === true,
    diff: bucket,
    pts: DIFF_PTS[q.difficulty] || 10
  });
});

console.log('📊 إحصائيات أسئلة صح/خطأ:');
console.log('   سهل:', RAW_QUESTIONS_BY_DIFF.easy.length);
console.log('   متوسط:', RAW_QUESTIONS_BY_DIFF.medium.length);
console.log('   صعب:', RAW_QUESTIONS_BY_DIFF.hard.length);
console.log('   المجموع:', tfQuestions.length);
console.log('');

const levels = ['easy', 'medium', 'hard', 'extreme'];
const names = { easy: 'سهل', medium: 'متوسط', hard: 'صعب', extreme: 'صعب جداً' };
let ok = true;

for (const level of levels) {
  const pool = buildPool(RAW_QUESTIONS_BY_DIFF, level);
  const e = pool.filter(q => q.diff === 'easy').length;
  const m = pool.filter(q => q.diff === 'medium').length;
  const h = pool.filter(q => q.diff === 'hard').length;
  if (pool.length === 0) {
    console.log(`❌ ${names[level]} (${level}): المجموعة فاضية!`);
    ok = false;
  } else {
    console.log(`✅ ${names[level]} (${level}): ${pool.length} سؤال (سهل:${e} متوسط:${m} صعب:${h})`);
  }
}

if (ok) {
  console.log('\n✅ كل المستويات تنتج أسئلة — الاختبار نجح.');
} else {
  console.log('\n❌ فشل الاختبار.');
  process.exit(1);
}
