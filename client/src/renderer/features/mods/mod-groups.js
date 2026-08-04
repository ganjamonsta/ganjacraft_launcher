/**
 * GanjaCraft Launcher - Mods Configuration
 * Конфигурация групп модов и метаданных
 */

/**
 * Группы модов с расширенными метаданными для карточек и каталога
 */
export const MOD_GROUPS = [
    // ----------------------------------------------------
    // ОПТИМИЗАЦИЯ
    // ----------------------------------------------------
    {
        id: 'sodium',
        name: 'Sodium',
        shortName: 'Sodium',
        version: '0.8.13',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'sodium',
        description: 'Ядерное ускорение рендеринга и многопоточности. Основной двигатель FPS.',
        curseSlug: 'sodium',
        modrinthSlug: 'sodium',
        files: ['client-sodium', 'client-embeddium', 'client-chloride']
    },
    {
        id: 'sodium_extra',
        name: 'Sodium Extra',
        shortName: 'Sodium Extra',
        version: '0.6.0',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        dependsOn: 'sodium',
        description: 'Расширенная оптимизация анимаций, частиц, частиц облаков и подпрядных чанков. Требует Sodium.',
        curseSlug: 'sodium-extra',
        modrinthSlug: 'sodium-extra',
        files: ['client-sodium-extra']
    },
    {
        id: 'reeses_options',
        name: 'Reese\'s Options',
        shortName: 'REESE\'S OPTIONS',
        version: '1.8.3',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'cloud',
        dependsOn: 'sodium',
        description: 'Удобное кастомное графическое меню настроек Sodium с вкладками и поиском. Требует Sodium.',
        curseSlug: 'reeses-sodium-options',
        modrinthSlug: 'reeses-sodium-options',
        files: ['client-reeses-sodium-options']
    },
    {
        id: 'entity_culling',
        name: 'Entity Culling',
        shortName: 'Entity Culling',
        version: '1.10.5',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'eye',
        dependsOn: 'sodium',
        description: 'Пропуск рендеринга скрытых стенками сущностей и сундуков. Сильно повышает FPS на базах. Требует Sodium.',
        curseSlug: 'entityculling',
        modrinthSlug: 'entityculling',
        files: ['client-entityculling']
    },
    {
        id: 'cull_leaves',
        name: 'Cull Leaves',
        shortName: 'Cull Leaves',
        version: '4.1.1',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'eye',
        description: 'Оптимизация рендеринга листвы (пропуск отрисовки внутренних блоков).',
        curseSlug: 'cull-leaves',
        modrinthSlug: 'cull-leaves',
        files: ['client-cullleaves']
    },
    {
        id: 'oculus',
        name: 'Iris / Oculus',
        shortName: 'Iris Shaders',
        version: '1.8.14',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        dependsOn: 'sodium',
        description: 'Поддержка шейдерпаков OptiFine в интерфейсе настроек Sodium. Требует Sodium.',
        curseSlug: 'iris',
        modrinthSlug: 'iris',
        files: ['client-oculus', 'client-iris']
    },

    // ----------------------------------------------------
    // ГРАФИКА
    // ----------------------------------------------------
    {
        id: 'cit_resewn',
        name: 'CIT Resewn',
        shortName: 'CIT Resewn',
        version: '1.2.18',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'block',
        description: 'Кастомное отображение моделей предметных рамок и текстур при переименовании предметов на наковальне.',
        curseSlug: 'cit-resewn',
        modrinthSlug: 'cit-resewn',
        files: ['client-citreforged', 'client-athena']
    },
    {
        id: 'etf',
        name: 'Entity Texture Features (ETF)',
        shortName: 'ETF Textures',
        version: '7.1',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'eye',
        description: 'Поддержка кастомных текстур мобов OptiFine, случайных скинов и светящихся глаз.',
        curseSlug: 'entity-texture-features-fabric-forge',
        modrinthSlug: 'entity-texture-features',
        files: ['client-entity_texture_features']
    },
    {
        id: 'emf',
        name: 'Entity Model Features (EMF)',
        shortName: 'EMF Models',
        version: '3.2.4',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'eye',
        dependsOn: 'etf',
        description: 'Кастомные 3D-модели мобов и сложная живая анимация сущностей. Требует ETF.',
        curseSlug: 'entity-model-features-fabric-forge',
        modrinthSlug: 'entity-model-features',
        files: ['client-entity_model_features']
    },

    // ----------------------------------------------------
    // ИНТЕРФЕЙС
    // ----------------------------------------------------
    {
        id: 'xaero_minimap',
        name: 'Xaero\'s Minimap',
        shortName: 'Xaero\'s Minimap',
        version: '24.5.0',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'map',
        description: 'Удобная миникарта в углу экрана с метками, сущностями и пещерами.',
        curseSlug: 'xaeros-minimap',
        modrinthSlug: 'xaeros-minimap',
        files: ['client-xaeros-minimap']
    },
    {
        id: 'xaero_worldmap',
        name: 'Xaero\'s WorldMap',
        shortName: 'Xaero\'s WorldMap',
        version: '1.38.8',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'map',
        description: 'Полноэкранная карта исследованного мира по нажатию клавиши M.',
        curseSlug: 'xaeros-world-map',
        modrinthSlug: 'xaeros-world-map',
        files: ['client-xaeros-worldmap']
    },
    {
        id: 'controlling',
        name: 'Controlling',
        shortName: 'Controlling',
        version: '19.0.5',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'gear',
        description: 'Быстрый поиск конфликтов клавиш и расширенная настройка биндов.',
        curseSlug: 'controlling',
        modrinthSlug: 'controlling',
        files: ['client-controlling', 'client-searchables']
    },
    {
        id: 'emi',
        name: 'EMI (Рецепты)',
        shortName: 'EMI',
        version: '1.1.24',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'block',
        description: 'Удобный интерфейс просмотра всех рецептов игры справа в инвентаре.',
        curseSlug: 'emi',
        modrinthSlug: 'emi',
        files: ['client-emi', 'client-createjeicompat']
    },
    {
        id: 'better_advancements',
        name: 'Better Advancements',
        shortName: 'Better Advancements',
        version: '0.4.2',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'gear',
        description: 'Удобное древо достижений во весь экран с описаниями и прогрессом.',
        curseSlug: 'better-advancements',
        modrinthSlug: 'better-advancements',
        files: ['client-betteradvancements']
    },
    {
        id: 'more_overlays',
        name: 'More Overlays',
        shortName: 'More Overlays',
        version: '1.22.1',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'block',
        description: 'Просмотр уровня освещенности (F7) и границы чанков для постройки.',
        curseSlug: 'more-overlays-updated',
        modrinthSlug: 'more-overlays',
        files: ['client-moreoverlays']
    },
    {
        id: 'lan_properties',
        name: 'LAN Properties',
        shortName: 'LAN Properties',
        version: '1.2.18',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'gear',
        description: 'Настройки порта, прав и онлайн-режима при открытии локального мира.',
        curseSlug: 'lan-server-properties',
        modrinthSlug: 'lan-server-properties',
        files: ['client-lanserverproperties', 'client_lanserverproperties'],
        defaultDisabled: true
    },
    {
        id: 'discord_rpc',
        name: 'Discord RPC',
        shortName: 'Discord RPC',
        version: '3.3.0',
        category: 'Интеграции',
        subCategory: 'Интерфейс',
        icon: 'gear',
        description: 'Отображение статуса игры и сервера GanjaCraft в Discord.',
        curseSlug: 'simple-discord-rpc',
        modrinthSlug: 'simple-rpc',
        files: ['client-simplerpc']
    },
    {
        id: 'fancymenu',
        name: 'FancyMenu UI',
        shortName: 'FancyMenu UI',
        version: '3.2.3',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'cloud',
        description: 'Кастомные меню, фоны и заставки загрузки.',
        curseSlug: 'fancymenu',
        modrinthSlug: 'fancymenu',
        files: ['client-fancymenu', 'client-konkrete', 'client-melody'],
        defaultDisabled: true
    },

    // ----------------------------------------------------
    // МЕХАНИКИ
    // ----------------------------------------------------
    {
        id: 'forgematica',
        name: 'Forgematica',
        shortName: 'Forgematica',
        version: '0.4.1',
        category: 'Механики',
        subCategory: 'Механики',
        icon: 'block',
        description: 'Загрузка 3D-схематик постройки и полупрозрачная проекция блоков.',
        curseSlug: 'forgematica',
        modrinthSlug: 'forgematica',
        files: ['client-forgematica', 'client-Forgematica', 'client-mafglib', 'client-badpackets'],
        defaultDisabled: true
    },
    {
        id: 'forgematica_printer',
        name: 'Forgematica Printer',
        shortName: 'Printer',
        version: '0.1.0',
        category: 'Механики',
        subCategory: 'Механики',
        icon: 'block',
        dependsOn: 'forgematica',
        description: 'Автоматический 3D-принтер блоков по загруженной схематике. Требует Forgematica.',
        curseSlug: 'neoforgematica-printer',
        modrinthSlug: 'neoforgematica-printer',
        files: ['client-neoforgematicaprinter', 'client-NeoForgematicaPrinter'],
        defaultDisabled: true
    },
    {
        id: 'third_person',
        name: 'Better Third Person',
        shortName: 'Better 3rd Person',
        version: '2.2.0',
        category: 'Механики',
        subCategory: 'Механики',
        icon: 'eye',
        description: 'Плавная свободная камера от третьего лица при нажатии F5 (360° обзор).',
        curseSlug: 'leawind-third-person',
        modrinthSlug: 'leawind-third-person',
        files: ['client-leawind_third_person']
    },
    {
        id: 'controllable',
        name: 'Gamepad Controls',
        shortName: 'Gamepad Controls',
        version: '1.0.0',
        category: 'Механики',
        subCategory: 'Механики',
        icon: 'gamepad',
        description: 'Поддержка геймпадов Xbox, DualShock, DualSense и вибрации.',
        curseSlug: 'controllable-fabric',
        modrinthSlug: 'controllable',
        files: ['client-motorassistance', 'client-controllable', 'client-framework'],
        defaultDisabled: true
    },
    {
        id: 'epic_tweaks',
        name: 'Epic Tweaks & Combat',
        shortName: 'Epic Tweaks',
        version: '1.1.3',
        category: 'Механики',
        subCategory: 'Механики',
        icon: 'swords',
        description: 'Улучшенные анимации ударов, боевые увороты и боевая система.',
        curseSlug: 'epic-fight-mod',
        modrinthSlug: 'epic-fight',
        files: ['client-epictweaks']
    }
];

/**
 * Категории фильтров (вкладки сверху)
 */
export const SUB_CATEGORIES = [
    'ОПЦИОНАЛЬНЫЕ',
    'КАТАЛОГ ССЫЛОК'
];

export const CATEGORY_ORDER = [
    'Оптимизация',
    'Графика',
    'Интерфейс',
    'Механики',
    'Интеграции',
    'Остальное'
];

/**
 * ID групп с дефолтным отключением
 */
export const DEFAULT_DISABLED_GROUPS = MOD_GROUPS
    .filter(g => g.defaultDisabled)
    .map(g => g.id);

