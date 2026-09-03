/**
 * Ganj4Craft Launcher - Mods Configuration
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
        description: 'Ядерное ускорение рендеринга и многопоточности чанков. Основной двигатель FPS.',
        curseSlug: 'sodium',
        modrinthSlug: 'sodium',
        files: ['client-sodium', 'client-embeddium']
    },
    {
        id: 'sodium_extra',
        name: 'Sodium Extra',
        shortName: 'Sodium Extra',
        version: '0.9.3',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        dependsOn: 'sodium',
        description: 'Расширенная оптимизация анимаций, частиц, частиц облаков и подпрядных чанков.',
        curseSlug: 'sodium-extra',
        modrinthSlug: 'sodium-extra',
        files: ['client-sodium-extra']
    },
    {
        id: 'reeses_options',
        name: 'Reese\'s Options',
        shortName: 'Reese\'s Options',
        version: '2.2.3',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'cloud',
        dependsOn: 'sodium',
        description: 'Удобное графическое меню настроек Sodium с вертикальными вкладками и поиском.',
        curseSlug: 'reeses-sodium-options',
        modrinthSlug: 'reeses-sodium-options',
        files: ['client-reeses-sodium-options']
    },
    {
        id: 'iris',
        name: 'Iris Shaders',
        shortName: 'Iris Shaders',
        version: '1.8.14',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'brush',
        dependsOn: 'sodium',
        description: 'Поддержка современных шейдерпаков в интерфейсе настроек видео Sodium.',
        curseSlug: 'iris',
        modrinthSlug: 'iris',
        files: ['client-iris', 'client-oculus']
    },
    {
        id: 'entity_culling',
        name: 'Entity Culling',
        shortName: 'Entity Culling',
        version: '1.10.5',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'eye',
        description: 'Пропуск рендеринга скрытых стенами сущностей и сундуков. Сильно повышает FPS на базах.',
        curseSlug: 'entityculling',
        modrinthSlug: 'entityculling',
        files: ['client-entityculling']
    },
    {
        id: 'cull_leaves',
        name: 'Cull Leaves + MidnightLib',
        shortName: 'Cull Leaves',
        version: '4.1.1',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'leaf',
        description: 'Отсечение внутренних невидимых граней листвы деревьев (включает MidnightLib).',
        curseSlug: 'cull-leaves',
        modrinthSlug: 'cull-leaves',
        files: ['client-cullleaves', 'client-midnightlib']
    },

    // ----------------------------------------------------
    // ГРАФИКА
    // ----------------------------------------------------
    {
        id: 'borderless',
        name: 'Borderless Window',
        shortName: 'Borderless Window',
        version: '1.7.5',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'monitor',
        description: 'Полноэкранный режим в окне без рамок для мгновенного переключения окон (Alt+Tab).',
        curseSlug: 'borderless-mining',
        modrinthSlug: 'borderless-mining',
        files: ['client-borderless']
    },
    {
        id: 'athena',
        name: 'Athena (Connected Textures)',
        shortName: 'Athena (CTM)',
        version: '4.0.6',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'block',
        description: 'Соединяющиеся текстуры блоков (стекло, камень и другие блоки OptiFine CTM).',
        curseSlug: 'athena',
        modrinthSlug: 'athena',
        files: ['client-athena']
    },
    {
        id: 'etf',
        name: 'Entity Texture Features (ETF)',
        shortName: 'Entity Textures (ETF)',
        version: '7.1',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'eye',
        description: 'Кастомные и случайные текстуры мобов, светящиеся глаза и поддержка OptiFine скинов.',
        curseSlug: 'entity-texture-features-fabric-forge',
        modrinthSlug: 'entity-texture-features',
        files: ['client-entity_texture_features']
    },
    {
        id: 'emf',
        name: 'Entity Model Features (EMF)',
        shortName: 'Entity Models (EMF)',
        version: '3.2.4',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'eye',
        dependsOn: 'etf',
        description: 'Кастомные 3D-модели мобов и живая анимация сущностей (OptiFine CEM).',
        curseSlug: 'entity-model-features',
        modrinthSlug: 'entity-model-features',
        files: ['client-entity_model_features']
    },

    // ----------------------------------------------------
    // ИНТЕРФЕЙС
    // ----------------------------------------------------
    {
        id: 'emi',
        name: 'EMI (Рецепты)',
        shortName: 'EMI Recipes',
        version: '1.1.24',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'block',
        description: 'Просмотр всех рецептов игры и дерева крафта справа в инвентаре (включает Create compat).',
        curseSlug: 'emi',
        modrinthSlug: 'emi',
        files: ['client-emi', 'client-createjeicompat']
    },
    {
        id: 'controlling',
        name: 'Controlling',
        shortName: 'Controlling',
        version: '19.0.5',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'keyboard',
        description: 'Быстрый поиск конфликтов клавиш и расширенная настройка биндов (включает Searchables).',
        curseSlug: 'controlling',
        modrinthSlug: 'controlling',
        files: ['client-controlling', 'client-searchables', 'client-Searchables', 'client-Controlling']
    },
    {
        id: 'mouse_tweaks',
        name: 'Mouse Tweaks',
        shortName: 'Mouse Tweaks',
        version: '2.26.1',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'mouse',
        description: 'Удобное перемещение предметов в инвентаре зажатием ПКМ, быстрое перемещение колесиком мыши.',
        curseSlug: 'mouse-tweaks',
        modrinthSlug: 'mouse-tweaks',
        files: ['client-mousetweaks', 'client-MouseTweaks']
    },
    {
        id: 'better_advancements',
        name: 'Better Advancements',
        shortName: 'Better Advancements',
        version: '0.4.3.21',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'award',
        description: 'Удобное полноэкранное древо достижений с масштабированием, описаниями и прогрессом.',
        curseSlug: 'better-advancements',
        modrinthSlug: 'better-advancements',
        files: ['client-betteradvancements', 'client-BetterAdvancements'],
        defaultDisabled: true
    },

    // ----------------------------------------------------
    // КАМЕРА
    // ----------------------------------------------------
    {
        id: 'third_person',
        name: 'Better Third Person',
        shortName: 'Better 3rd Person',
        version: '1.9.0',
        category: 'Камера',
        subCategory: 'Камера',
        icon: 'camera',
        description: 'Плавная свободная камера от третьего лица при нажатии F5 (обзор на 360° вокруг игрока).',
        curseSlug: 'leawind-third-person',
        modrinthSlug: 'leawind-third-person',
        files: ['client-leawind_third_person', 'client-betterthirdperson', 'client-BetterThirdPerson'],
        defaultDisabled: true
    },
    {
        id: 'first_person',
        name: 'First Person Model',
        shortName: 'First Person Model',
        version: '2.7.2',
        category: 'Камера',
        subCategory: 'Камера',
        icon: 'user',
        description: 'Реалистичный вид от первого лица с отображением тела, ног, брони и предметов персонажа.',
        curseSlug: 'first-person-model',
        modrinthSlug: 'first-person-model',
        files: ['client-firstperson', 'client-FirstPerson'],
        defaultDisabled: true
    },

    // ----------------------------------------------------
    // СТРОИТЕЛЬСТВО
    // ----------------------------------------------------
    {
        id: 'forgematica',
        name: 'Forgematica (Схематики)',
        shortName: 'Forgematica',
        version: '0.4.1',
        category: 'Строительство',
        subCategory: 'Строительство',
        icon: 'blueprint',
        description: 'Загрузка 3D-схематик постройки, полупрозрачная проекция и сверка блоков (порт Litematica).',
        curseSlug: 'forgematica',
        modrinthSlug: 'forgematica',
        files: ['client-forgematica', 'client-Forgematica', 'client-mafglib', 'client-badpackets'],
        defaultDisabled: true
    },
    {
        id: 'forgematica_printer',
        name: 'NeoForgematica Printer',
        shortName: 'Forgematica Printer',
        version: '0.1.0',
        category: 'Строительство',
        subCategory: 'Строительство',
        icon: 'block',
        dependsOn: 'forgematica',
        description: 'Автоматическая расстановка блоков по загруженной проекции Forgematica.',
        curseSlug: 'neoforgematicaprinter',
        modrinthSlug: 'neoforgematicaprinter',
        files: ['client-neoforgematicaprinter', 'client-NeoForgematicaPrinter'],
        defaultDisabled: true
    }
];

/**
 * Категории порядка отображения в лаунчере
 */
export const CATEGORY_ORDER = [
    'Оптимизация',
    'Графика',
    'Интерфейс',
    'Камера',
    'Строительство',
    'Остальное'
];

/**
 * ID групп с дефолтным отключением
 */
export const DEFAULT_DISABLED_GROUPS = MOD_GROUPS
    .filter(g => g.defaultDisabled)
    .map(g => g.id);

export const SUB_CATEGORIES = ['ОПЦИОНАЛЬНЫЕ'];
