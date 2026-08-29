/**
 * Ganj4Craft Launcher - RAM Slider Module
 * Двойной ползунок для выбора минимальной и максимальной памяти
 */

/**
 * Инициализация ползунка RAM
 * @param {Object} config - Текущий конфиг с memoryMin и memoryMax
 */
export function initRamSlider(config) {
    const sliderMin = document.getElementById('setting-ram-slider-min');
    const sliderMax = document.getElementById('setting-ram-slider-max');
    const ramRange = document.getElementById('ram-range');
    const ramMinDisplay = document.getElementById('ram-min-display');
    const ramMaxDisplay = document.getElementById('ram-max-display');
    const hiddenMin = document.getElementById('setting-ram-min');
    const hiddenMax = document.getElementById('setting-ram-max');
    
    if (!sliderMin || !sliderMax) {
        console.warn('[RAM-SLIDER] Sliders not found');
        return;
    }
    
    // Парсим значения из конфига (например "4G" -> 4)
    const parseRamValue = (value) => {
        if (!value) return null;
        const match = String(value).match(/^(\d+)[GM]?$/i);
        return match ? parseInt(match[1], 10) : null;
    };
    
    // Начальные значения
    let minVal = parseRamValue(config?.memoryMin) || 1;
    let maxVal = parseRamValue(config?.memoryMax) || 3;
    
    // Ограничения
    const minLimit = 1;
    const maxLimit = 16;
    const minGap = 1; // Минимальная разница между min и max
    
    // Клампим значения
    minVal = Math.max(minLimit, Math.min(maxLimit - minGap, minVal));
    maxVal = Math.max(minVal + minGap, Math.min(maxLimit, maxVal));
    
    // Устанавливаем начальные значения
    sliderMin.value = minVal;
    sliderMax.value = maxVal;
    
    /**
     * Обновить визуальное отображение
     */
    const updateDisplay = () => {
        const minValue = parseInt(sliderMin.value);
        const maxValue = parseInt(sliderMax.value);
        
        // Обновляем текстовые отображения
        if (ramMinDisplay) ramMinDisplay.textContent = minValue;
        if (ramMaxDisplay) ramMaxDisplay.textContent = maxValue;
        
        // Обновляем скрытые поля для совместимости
        if (hiddenMin) hiddenMin.value = `${minValue}G`;
        if (hiddenMax) hiddenMax.value = `${maxValue}G`;
        
        // Обновляем визуальный диапазон
        if (ramRange) {
            const percentMin = ((minValue - minLimit) / (maxLimit - minLimit)) * 100;
            const percentMax = ((maxValue - minLimit) / (maxLimit - minLimit)) * 100;
            ramRange.style.left = `${percentMin}%`;
            ramRange.style.width = `${percentMax - percentMin}%`;
        }
    };
    
    /**
     * Обработчик изменения минимального слайдера
     */
    const onMinChange = () => {
        let minValue = parseInt(sliderMin.value);
        let maxValue = parseInt(sliderMax.value);
        
        // Не позволяем минимуму превысить максимум - minGap
        if (minValue > maxValue - minGap) {
            minValue = maxValue - minGap;
            sliderMin.value = minValue;
        }
        
        updateDisplay();
        triggerChangeEvent();
    };
    
    /**
     * Обработчик изменения максимального слайдера
     */
    const onMaxChange = () => {
        let minValue = parseInt(sliderMin.value);
        let maxValue = parseInt(sliderMax.value);
        
        // Не позволяем максимуму опуститься ниже минимума + minGap
        if (maxValue < minValue + minGap) {
            maxValue = minValue + minGap;
            sliderMax.value = maxValue;
        }
        
        updateDisplay();
        triggerChangeEvent();
    };
    
    /**
     * Триггер события изменения для updateSaveButtonVisibility
     */
    const triggerChangeEvent = () => {
        // Создаем событие change для скрытых полей
        if (hiddenMin) {
            hiddenMin.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };
    
    // Добавляем слушатели
    sliderMin.addEventListener('input', onMinChange);
    sliderMax.addEventListener('input', onMaxChange);
    
    // Инициализируем отображение
    updateDisplay();
    
    console.log('[RAM-SLIDER] Initialized:', { min: minVal, max: maxVal });
}
