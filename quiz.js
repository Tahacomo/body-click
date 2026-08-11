let data = {};
let quizScore = 0;
let currentIndex = 0;
let questions = [];
let isAnswered = false;

// ۱. لود کردن داده‌ها از فایل مشترک regions.json
async function loadData() {
    try {
        const res = await fetch('./regions.json');
        data = await res.json();
        document.getElementById('start-quiz-btn').disabled = false;
    } catch (e) {
        alert("خطا در بارگذاری داده‌های آزمون!");
    }
}

function initQuiz() {
    questions = [];
    quizScore = 0;
    currentIndex = 0;

    // استخراج تمام بیماری‌ها
    Object.keys(data).forEach(key => {
        const region = data[key];
        if (region.diseases && Array.isArray(region.diseases)) {
            region.diseases.forEach(d => {
                questions.push({
                    disease: d.name,
                    correct: region.label,
                    img: region.image
                });
            });
        }
    });

    // انتخاب ۱۰ سوال تصادفی
    questions.sort(() => Math.random() - 0.5);
    questions = questions.slice(0, 10);

    document.getElementById('quiz-start-screen').classList.add('hidden');
    document.getElementById('quiz-game-screen').classList.remove('hidden');
    showQuestion();
}

function showQuestion() {
    isAnswered = false;
    const q = questions[currentIndex];

    document.getElementById('q-number').innerText = currentIndex + 1;
    document.getElementById('target-disease').innerText = q.disease;
    document.getElementById('quiz-feedback').innerText = "";
    document.getElementById('organ-img').style.display = "none";

    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = "";

    // ساخت گزینه‌ها
    const opts = [q.correct];
    const otherLabels = Object.values(data).map(r => r.label).filter(l => l !== q.correct);
    opts.push(...otherLabels.sort(() => Math.random() - 0.5).slice(0, 3));
    opts.sort(() => Math.random() - 0.5);

    opts.forEach(o => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = o;
        btn.onclick = () => check(btn, o, q.correct, q.img);
        optionsContainer.appendChild(btn);
    });
}

function check(btn, selected, correct, img) {
    if (isAnswered) return;
    isAnswered = true;

    const imgEl = document.getElementById('organ-img');
    imgEl.src = img;
    imgEl.style.display = "block"; // نمایش عکس عضو برای یادگیری بیشتر

    if (selected === correct) {
        btn.classList.add('correct');
        quizScore += 10;
        document.getElementById('current-score').innerText = quizScore;
        document.getElementById('quiz-feedback').innerHTML = "<span style='color:green'>✅ عالی بود!</span>";
    } else {
        btn.classList.add('wrong');
        document.getElementById('quiz-feedback').innerHTML = `<span style='color:red'>❌ اشتباه! پاسخ درست: ${correct}</span>`;
    }

    setTimeout(() => {
        currentIndex++;
        if (currentIndex < 10) showQuestion();
        else finish();
    }, 2500);
}

function finish() {
    document.getElementById('quiz-game-screen').classList.add('hidden');
    document.getElementById('quiz-result-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = quizScore;

    const emoji = document.getElementById('result-emoji');
    if (quizScore >= 80) emoji.innerText = "🏆 عالی! تو یک متخصصی";
    else if (quizScore >= 50) emoji.innerText = "🥈 خوب بود، بیشتر تلاش کن";
    else emoji.innerText = "🎓 نیاز به مطالعه بیشتر داری";
}

document.getElementById('start-quiz-btn').onclick = initQuiz;
loadData();