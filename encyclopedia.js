async function loadEncyclopedia() {
    const grid = document.getElementById('organ-grid');

    try {
        const res = await fetch('./regions.json');
        const data = await res.json();

        grid.innerHTML = ""; // پاک کردن لودر

        Object.keys(data).forEach(key => {
            const item = data[key];
            if (!item.label) return;

            const card = document.createElement('div');
            card.className = 'organ-card';

            // ساخت بخش بیماری‌ها (نام قرمز، توضیحات مشکی)
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
                    
                    <div class="disease-list-mini">
                        <h4>بیماری‌های مرتبط:</h4>
                        ${diseasesHTML}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (e) {
        grid.innerHTML = "<p style='text-align:center; color:red;'>خطا در بارگذاری اطلاعات دانشنامه!</p>";
        console.error(e);
    }
}

window.onload = loadEncyclopedia;