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
                
                div.innerHTML = `
                    <div class="news-date">${item.created_at}</div>
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
