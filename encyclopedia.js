async function loadEncyclopedia() {
    const grid = document.getElementById('organ-grid');
    
    try {
        const res = await fetch('./regions.json');
        const data = await res.json();
        grid.innerHTML = ""; 

        Object.keys(data).forEach(key => {
            const item = data[key];
            if (!item.label) return;

            const card = document.createElement('div');
            card.className = 'organ-card';

            // ساخت لیست بیماری‌ها
            let diseasesHTML = "";
            if (Array.isArray(item.diseases)) {
                diseasesHTML = item.diseases.map(d => `
                    <div class="disease-item-ency">
                        <b>${d.name}</b>
                        <span>${d.desc}</span>
                    </div>
                `).join('');
            }

            card.innerHTML = `
                <img src="${item.image || 'https://via.placeholder.com/400x250'}" alt="${item.label}">
                <div class="organ-card-body">
                    <h3>${item.label}</h3>
                    <p class="info-text">${item.info || 'توضیحات علمی برای این بخش در دسترس نیست.'}</p>
                    
                    <!-- بخش کشویی جدید -->
                    <div class="disease-accordion">
                        <div class="accordion-header" onclick="toggleAccordion(this)">
                            <span>مشاهده بیماری‌های مرتبط</span>
                            <span class="arrow-icon">▼</span>
                        </div>
                        <div class="accordion-content">
                            <div class="disease-list-wrapper">
                                ${diseasesHTML || '<p>موردی یافت نشد.</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (e) {
        grid.innerHTML = "<p style='text-align:center; color:red;'>خطا در بارگذاری اطلاعات!</p>";
    }
}

// تابع جابجایی وضعیت کشو
window.toggleAccordion = (element) => {
    const accordion = element.parentElement;
    const content = accordion.querySelector('.accordion-content');
    const isOpen = accordion.classList.contains('open');

    // بستن بقیه (اختیاری - اگر می‌خواهید فقط یکی باز باشد)
    // document.querySelectorAll('.disease-accordion').forEach(el => el.classList.remove('open'));

    if (isOpen) {
        accordion.classList.remove('open');
        element.querySelector('span').innerText = "مشاهده بیماری‌های مرتبط";
    } else {
        accordion.classList.add('open');
        element.querySelector('span').innerText = "بستن لیست بیماری‌ها";
    }
};

window.onload = loadEncyclopedia;
