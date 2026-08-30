import * as THREE from 'three';

/**
 * TACZ & Bedrock Geometry 3D Loader
 * Парсит оригинальные .geo.json модели TACZ и накладывает аутентичные UV-текстуры.
 */

class TaczGeoLoader {
    constructor() {
        this.modelCache = new Map();
        this.textureCache = new Map();
        this.textureLoader = new THREE.TextureLoader();
    }

    /**
     * Загрузка текстуры с пиксельной резкостью (NearestFilter)
     */
    loadTexture(url) {
        if (this.textureCache.has(url)) {
            return this.textureCache.get(url);
        }
        const texture = this.textureLoader.load(url);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        this.textureCache.set(url, texture);
        return texture;
    }

    /**
     * Загрузка и генерация 3D Group для оружия TACZ
     * @param {string} gunId Идентификатор оружия (например 'ak47', 'deagle', 'spas_12')
     */
    async loadGunModel(gunId) {
        if (this.modelCache.has(gunId)) {
            return this.modelCache.get(gunId).clone(true);
        }

        try {
            const geoUrl = `assets/tacz/geo/${gunId}_geo.json`;
            const texUrl = `assets/tacz/uv/${gunId}.png`;

            const res = await fetch(geoUrl);
            if (!res.ok) throw new Error(`Failed to fetch TACZ geo for ${gunId}`);
            const geoJson = await res.json();

            const texture = this.loadTexture(texUrl);
            const material = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.15,
                roughness: 0.45,
                metalness: 0.25
            });

            const gunGroup = this.parseBedrockGeo(geoJson, material, gunId);
            this.modelCache.set(gunId, gunGroup);
            return gunGroup.clone(true);
        } catch (e) {
            console.warn(`[TaczGeoLoader] Could not load real 3D model for ${gunId}, fallback`, e);
            return null;
        }
    }

    /**
     * Парсер Bedrock 1.12.0 minecraft:geometry в Three.js
     */
    parseBedrockGeo(geoJson, material, gunId) {
        const rootGroup = new THREE.Group();
        rootGroup.name = `TACZ_GUN_${gunId}`;

        const geometries = geoJson['minecraft:geometry'] || [];
        if (!geometries.length) return rootGroup;

        const geo = geometries[0];
        const desc = geo.description || {};
        const texW = desc.texture_width || 64;
        const texH = desc.texture_height || 64;
        const bones = geo.bones || [];

        // Карта костей
        const boneMap = new Map();
        const boneGroups = new Map();

        // 1. Создаем Three.js группы для всех костей (исключая руки от первого лица)
        for (const bone of bones) {
            const bName = (bone.name || '').toLowerCase();
            // Исключаем кости рук от первого лица
            if (bName.includes('lefthand') || bName.includes('righthand') || bName === 'camera' || bName === 'crosshair') {
                continue;
            }

            const bGroup = new THREE.Group();
            bGroup.name = bone.name;

            const pivot = bone.pivot || [0, 0, 0];
            bGroup.position.set(-pivot[0], pivot[1], pivot[2]);

            if (bone.rotation) {
                bGroup.rotation.set(
                    THREE.MathUtils.degToRad(-bone.rotation[0]),
                    THREE.MathUtils.degToRad(-bone.rotation[1]),
                    THREE.MathUtils.degToRad(bone.rotation[2]),
                    'ZYX'
                );
            }

            boneMap.set(bone.name, bone);
            boneGroups.set(bone.name, bGroup);
        }

        // 2. Выстраиваем иерархию и строим кубы
        for (const bone of bones) {
            const bGroup = boneGroups.get(bone.name);
            if (!bGroup) continue;

            const parentGroup = bone.parent ? boneGroups.get(bone.parent) : null;
            if (parentGroup) {
                const parentBone = boneMap.get(bone.parent);
                const pPivot = parentBone && parentBone.pivot ? parentBone.pivot : [0, 0, 0];
                const curPivot = bone.pivot || [0, 0, 0];
                // Относительная позиция к родителю
                bGroup.position.set(
                    -(curPivot[0] - pPivot[0]),
                    curPivot[1] - pPivot[1],
                    curPivot[2] - pPivot[2]
                );
                parentGroup.add(bGroup);
            } else {
                bGroup.position.set(0, 0, 0);
                rootGroup.add(bGroup);
            }

            // Рендерим кубы этой кости
            if (bone.cubes && Array.isArray(bone.cubes)) {
                const bonePivot = bone.pivot || [0, 0, 0];

                for (const cube of bone.cubes) {
                    const mesh = this.createCubeMesh(cube, bonePivot, texW, texH, material);
                    if (mesh) {
                        bGroup.add(mesh);
                    }
                }
            }
        }

        // Стандартный масштаб и поворот ствола в руке
        rootGroup.scale.set(0.55, 0.55, 0.55);
        // Ориентация: ствол направлен вперед (+Z), приклад назад
        rootGroup.rotation.set(-0.1, Math.PI, 0);
        rootGroup.position.set(-1.0, -9.6, 1.2);

        return rootGroup;
    }

    /**
     * Создание куба с точной UV-разверткой Bedrock
     */
    createCubeMesh(cube, bonePivot, texW, texH, material) {
        const origin = cube.origin || [0, 0, 0];
        const size = cube.size || [1, 1, 1];
        const inflate = cube.inflate || 0;

        const w = size[0] + inflate * 2;
        const h = size[1] + inflate * 2;
        const d = size[2] + inflate * 2;

        if (w <= 0 || h <= 0 || d <= 0) return null;

        const geometry = new THREE.BoxGeometry(w, h, d);
        this.applyBedrockUVs(geometry, cube, texW, texH);

        const mesh = new THREE.Mesh(geometry, material);

        // Центр куба относительно кости
        const cx = -(origin[0] + size[0] / 2 - bonePivot[0]);
        const cy = origin[1] + size[1] / 2 - bonePivot[1];
        const cz = origin[2] + size[2] / 2 - bonePivot[2];

        if (cube.rotation && cube.pivot) {
            const cubePivotGroup = new THREE.Group();
            const cp = cube.pivot;
            cubePivotGroup.position.set(
                -(cp[0] - bonePivot[0]),
                cp[1] - bonePivot[1],
                cp[2] - bonePivot[2]
            );
            cubePivotGroup.rotation.set(
                THREE.MathUtils.degToRad(-cube.rotation[0]),
                THREE.MathUtils.degToRad(-cube.rotation[1]),
                THREE.MathUtils.degToRad(cube.rotation[2]),
                'ZYX'
            );

            mesh.position.set(
                -(origin[0] + size[0] / 2 - cp[0]),
                origin[1] + size[1] / 2 - cp[1],
                origin[2] + size[2] / 2 - cp[2]
            );

            cubePivotGroup.add(mesh);
            return cubePivotGroup;
        } else {
            mesh.position.set(cx, cy, cz);
            return mesh;
        }
    }

    /**
     * Преобразование Bedrock UV карты в Three.js UV буфер
     */
    applyBedrockUVs(geometry, cube, texW, texH) {
        const uvAttr = geometry.attributes.uv;
        if (!uvAttr) return;

        const uvs = uvAttr.array;
        const size = cube.size || [1, 1, 1];
        const uv = cube.uv;

        // Порядок граней BoxGeometry в Three.js:
        // 0: East (+X), 1: West (-X), 2: Up (+Y), 3: Down (-Y), 4: South (+Z), 5: North (-Z)
        const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];

        if (uv && typeof uv === 'object' && !Array.isArray(uv)) {
            // Per-face UV
            faceOrder.forEach((faceName, faceIdx) => {
                const fData = uv[faceName];
                if (fData && fData.uv) {
                    const u = fData.uv[0];
                    const v = fData.uv[1];
                    const uw = fData.uv_size ? fData.uv_size[0] : size[0];
                    const uh = fData.uv_size ? fData.uv_size[1] : size[1];

                    const u0 = u / texW;
                    const v0 = 1.0 - (v + uh) / texH;
                    const u1 = (u + uw) / texW;
                    const v1 = 1.0 - v / texH;

                    const base = faceIdx * 8;
                    uvs[base + 0] = u0; uvs[base + 1] = v1;
                    uvs[base + 2] = u1; uvs[base + 3] = v1;
                    uvs[base + 4] = u0; uvs[base + 5] = v0;
                    uvs[base + 6] = u1; uvs[base + 7] = v0;
                }
            });
        } else if (Array.isArray(uv)) {
            // Standard Box UV: [u, v]
            const u = uv[0];
            const v = uv[1];
            const dx = size[0];
            const dy = size[1];
            const dz = size[2];

            const setFace = (faceIdx, fx, fy, fw, fh) => {
                const u0 = fx / texW;
                const v0 = 1.0 - (fy + fh) / texH;
                const u1 = (fx + fw) / texW;
                const v1 = 1.0 - fy / texH;

                const base = faceIdx * 8;
                uvs[base + 0] = u0; uvs[base + 1] = v1;
                uvs[base + 2] = u1; uvs[base + 3] = v1;
                uvs[base + 4] = u0; uvs[base + 5] = v0;
                uvs[base + 6] = u1; uvs[base + 7] = v0;
            };

            // East (+X)
            setFace(0, u, v + dz, dz, dy);
            // West (-X)
            setFace(1, u + dz + dx, v + dz, dz, dy);
            // Up (+Y)
            setFace(2, u + dz, v, dx, dz);
            // Down (-Y)
            setFace(3, u + dz + dx, v, dx, dz);
            // South (+Z)
            setFace(4, u + dz, v + dz, dx, dy);
            // North (-Z)
            setFace(5, u + dz * 2 + dx, v + dz, dx, dy);
        }

        uvAttr.needsUpdate = true;
    }
}

export const taczGeoLoader = new TaczGeoLoader();
