/**
 * GanjaCraft Launcher - Mods Configuration
 * Конфигурация групп модов
 */

/**
 * Группы модов с метаданными
 */
export const MOD_GROUPS = [
    {
        id: 'optimization',
        name: 'Оптимизация и Шейдеры',
        category: 'Графика и Производительность',
        description: 'Embeddium, Oculus (Шейдеры), EntityCulling. Значительно повышает FPS.',
        files: ['client-embeddium', 'client-oculus', 'client-entityculling', 'client-chloride']
    },
    {
        id: 'visuals',
        name: 'Улучшенная Графика',
        category: 'Графика и Производительность',
        description: 'Поддержка сложных текстурпаков (ETF, EMF, CIT).',
        files: ['client-entity_texture_features', 'client-entity_model_features', 'client-citreforged', 'client-athena']
    },
    {
        id: 'fancymenu',
        name: 'Красивое Меню',
        category: 'Интерфейс и Инструменты',
        description: 'Кастомное меню FancyMenu.',
        files: ['client-fancymenu', 'client-konkrete', 'client-melody'],
        defaultDisabled: true
    },
    {
        id: 'controls',
        name: 'Удобное Управление',
        category: 'Интерфейс и Инструменты',
        description: 'Поиск конфликтов клавиш и комбинации биндов(Controlling).',
        files: ['client-Controlling', 'client-Searchables']
    },
    {
        id: 'advancements',
        name: 'Улучшенные Достижения',
        category: 'Интерфейс и Инструменты',
        description: 'Более удобный интерфейс ачивок.',
        files: ['client-BetterAdvancements']
    },
    {
        id: 'overlays',
        name: 'More Overlays',
        category: 'Интерфейс и Инструменты',
        description: 'F7 для просмотра уровня освещения и поиск в инвентаре.',
        files: ['client-moreoverlays']
    },
    {
        id: 'schematics',
        name: 'Схематики (Forgematica)',
        category: 'Интерфейс и Инструменты',
        description: 'Загрузка/просмотр схематики и помощь в строительстве.',
        files: ['client-Forgematica', 'client-MaFgLib', 'client-badpackets'],
        defaultDisabled: true
    },
    {
        id: 'rpc',
        name: 'Discord RPC',
        category: 'Интеграции',
        description: 'Показывает статус игры в Discord.',
        files: ['client-SimpleRPC']
    },
    {
        id: 'thirdperson',
        name: 'Better Third Person',
        category: 'Геймплей',
        description: 'Альтернатинвая камера от 3-го лица (F5).',
        files: ['client-leawind_third_person']
    },
    {
        id: 'motor',
        name: 'Motor Assistance',
        category: 'Геймплей',
        description: 'Помощь в управлении игрой геймпадом.',
        files: ['client-motorassistance', 'client-controllable', 'client-framework'],
        defaultDisabled: true
    },
    {
        id: 'tweaks',
        name: 'Epic Tweaks',
        category: 'Геймплей',
        description: 'Твики Epic Fight.',
        files: ['client-epictweaks']
    }
];

/**
 * Порядок категорий для отображения
 */
export const CATEGORY_ORDER = [
    'Графика и Производительность',
    'Интерфейс и Инструменты',
    'Геймплей',
    'Интеграции',
    'Остальное'
];

/**
 * ID групп с дефолтным отключением
 */
export const DEFAULT_DISABLED_GROUPS = MOD_GROUPS
    .filter(g => g.defaultDisabled)
    .map(g => g.id);
