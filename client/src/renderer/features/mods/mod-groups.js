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
        name: 'Оптимизация и Шейдеры (Sodium)',
        category: 'Графика и Производительность',
        description: 'Sodium, Sodium Extra, Reese\'s Sodium Options. Повышение FPS и гибкое меню настроек.',
        files: [
            'client-sodium',
            'client-sodium-extra',
            'client-reeses-sodium-options',
            'client-embeddium',
            'client-oculus',
            'client-entityculling',
            'client-chloride'
        ]
    },
    {
        id: 'visuals',
        name: 'Улучшенная Графика (ETF / EMF)',
        category: 'Графика и Производительность',
        description: 'Поддержка сложных текстурпаков (ETF, EMF, CIT), анимаций сущностей и 3D-моделей.',
        files: [
            'client-entity_texture_features',
            'client-entity_model_features',
            'client-citreforged',
            'client-athena'
        ]
    },
    {
        id: 'lanserver',
        name: 'Улучшенная Локальная Игра (LAN)',
        category: 'Интерфейс и Инструменты',
        description: 'Расширенная настройка сервера при открытии мира для друзей (порт, онлайн, права).',
        files: [
            'client-lanserverproperties',
            'client_lanserverproperties'
        ]
    },
    {
        id: 'schematics',
        name: 'Схематики и 3D-Принтер (Forgematica)',
        category: 'Интерфейс и Инструменты',
        description: 'Загрузка 3D-схематик, подсветка при постройке и автоматический принтер блоков.',
        files: [
            'client-forgematica',
            'client-Forgematica',
            'client-neoforgematicaprinter',
            'client-NeoForgematicaPrinter',
            'client-mafglib',
            'client-badpackets'
        ],
        defaultDisabled: true
    },
    {
        id: 'fancymenu',
        name: 'Красивое Меню',
        category: 'Интерфейс и Инструменты',
        description: 'Кастомное интерфейсное меню FancyMenu.',
        files: ['client-fancymenu', 'client-konkrete', 'client-melody'],
        defaultDisabled: true
    },
    {
        id: 'controls',
        name: 'Удобное Управление',
        category: 'Интерфейс и Инструменты',
        description: 'Поиск конфликтов клавиш и расширенная настройка биндов (Controlling).',
        files: ['client-controlling', 'client-searchables']
    },
    {
        id: 'advancements',
        name: 'Улучшенные Достижения',
        category: 'Интерфейс и Инструменты',
        description: 'Более удобный интерфейс системы достижений.',
        files: ['client-betteradvancements']
    },
    {
        id: 'overlays',
        name: 'More Overlays',
        category: 'Интерфейс и Инструменты',
        description: 'Просмотр уровня освещения (F7) и подсвечивание сетки чанков.',
        files: ['client-moreoverlays']
    },
    {
        id: 'rpc',
        name: 'Discord RPC',
        category: 'Интеграции',
        description: 'Показывает статус игры и информацию о сервере в вашем Discord профиле.',
        files: ['client-simplerpc']
    },
    {
        id: 'thirdperson',
        name: 'Better Third Person',
        category: 'Геймплей',
        description: 'Свободная альтернативная камера от 3-го лица при нажатии F5.',
        files: ['client-leawind_third_person']
    },
    {
        id: 'motor',
        name: 'Motor Assistance',
        category: 'Геймплей',
        description: 'Поддержка игры с геймпада и контроллеров.',
        files: ['client-motorassistance', 'client-controllable', 'client-framework'],
        defaultDisabled: true
    },
    {
        id: 'tweaks',
        name: 'Epic Tweaks',
        category: 'Геймплей',
        description: 'Дополнительные анимации и боевые твики Epic Fight.',
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
