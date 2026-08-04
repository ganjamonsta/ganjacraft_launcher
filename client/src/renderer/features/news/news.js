/**
 * GanjaCraft Launcher - News Feature
 * Загрузка и отображение новостей
 */

import { dom } from '../../utils/dom.js';

/**
 * Загрузить новости
 */
export async function loadNews() {
    const list = dom.get('news-list');
    if (!list) return;
    
    try {
        const result = await window.api.getNews();
        if (result.success && result.news.length > 0) {
            list.innerHTML = '';
            result.news.forEach(item => {
                const div = document.createElement('div');
                div.className = 'news-item';
                
                let imgHtml = '';
                if (item.image_url) {
                    imgHtml = `<img src="${item.image_url}">`;
                }
                
                let dateDisplay = item.created_at;
                if (item.timestamp) {
                    const d = new Date(item.timestamp * 1000);
                    dateDisplay = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                } else if (item.created_at) {
                    const parts = item.created_at.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/);
                    if (parts) {
                        const isoStr = `${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}:${parts[5]}:00+03:00`;
                        const d = new Date(isoStr);
                        if (!isNaN(d.getTime())) {
                            dateDisplay = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                        }
                    }
                }

                div.innerHTML = `
                    <div class="news-date">${dateDisplay}</div>
                    ${imgHtml}
                    <div class="news-text">${item.text || ''}</div>
                `;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = '<div style="padding:10px; color:#888;">Новостей пока нет.</div>';
        }
    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="padding:10px; color:#d32f2f;">Не удалось загрузить новости.</div>';
    }
}
