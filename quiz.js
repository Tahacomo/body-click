let data = {}, questions = [], currentIndex = 0, quizScore = 0, isAnswered = false;

async function loadData() {
    const res = await fetch('./regions.json');
    data = await res.json();
}

function startQuiz() {
    questions = [];
    Object.keys(data).forEach(key => {
        if (data[key].diseases && Array.isArray(data[key].diseases)) {
            data[key].diseases.forEach(d => {
                questions.push({ disease: d.name, correct: data[key].label, img: data[key].image });
            });
        }
    });

    questions.sort(() => Math.random() - 0.5);
    questions = questions.slice(0, 10);
    
    document.getElementById('quiz-start-screen').classList.add('hidden');
    document.getElementById('quiz-game-screen').classList.remove('hidden');
    showQuestion();
}

function showQuestion() {
    isAnswered = false;
    const q = questions[currentIndex];
    
    document.getElementById('q-number').innerText = (currentIndex + 1).toLocaleString('fa-IR');
    document.getElementById('progress').style.width = (currentIndex * 10) + "%";
    document.getElementById('target-disease').innerText = q.disease;
    document.getElementById('organ-img').style.display = "none";
    document.getElementById('quiz-feedback').innerText = "";
    
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = "";

    const opts = [q.correct];
    const others = Object.values(data).map(r => r.label).filter(l => l !== q.correct);
    opts.push(...others.sort(() => Math.random() - 0.5).slice(0, 3));
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
    if(img) { imgEl.src = img; imgEl.style.display = "block"; }

    if (selected === correct) {
        btn.classList.add('correct');
        quizScore += 10;
    } else {
        btn.classList.add('wrong');
        // هایلایت کردن گزینه درست
        Array.from(document.querySelectorAll('.option-btn')).forEach(b => {
            if(b.innerText === correct) b.classList.add('correct');
        });
    }

    setTimeout(() => {
        currentIndex++;
        if (currentIndex < 10) showQuestion();
        else finish();
    }, 2000);
}

// دکمه پایان زودرس آزمون
document.getElementById('exit-early').onclick = () => {
    if(confirm("آیا می‌خواهید به آزمون پایان دهید؟")) finish();
};

function finish() {
    document.getElementById('quiz-game-screen').classList.add('hidden');
    document.getElementById('quiz-result-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = quizScore.toLocaleString('fa-IR');
    
    const emoji = document.getElementById('result-emoji');
    if (quizScore >= 80) emoji.innerText = "🌟";
    else if (quizScore >= 50) emoji.innerText = "🙂";
    else emoji.innerText = "📚";
}

document.getElementById('start-quiz-btn').onclick = startQuiz;
loadData();
