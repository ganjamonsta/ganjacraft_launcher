import * as THREE from 'three';

/**
 * Universal GeckoLib & Bedrock 3D Model Loader
 * 
 * Загружает любые .geo.json модели мобов, брони, боссов и оружия из модов Minecraft
 * (GeckoLib, TACZ, Cataclysm, Iron's Spells, Blockbench) со всеми костями и текстурами.
 */

class GeckoLibModelLoader {
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
        const tex = this.textureLoader.load(url);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        this.textureCache.set(url, tex);
        return tex;
    }

    /**
     * Загрузить 3D модель мода из .geo.json и текстуры
     * @param {string} geoUrl Путь к .geo.json
     * @param {string} texUrl Путь к текстуре .png
     * @param {string} [emissiveUrl] Опциональный путь к светящейся маске _e.png
     */
    async loadModel(geoUrl, texUrl, emissiveUrl = null) {
        try {
            const cacheKey = `${geoUrl}|${texUrl}`;
            const res = await fetch(geoUrl);
            if (!res.ok) throw new Error(`HTTP error ${res.status} loading ${geoUrl}`);
            const geoJson = await res.json();

            const texture = this.loadTexture(texUrl);
            const emissiveMap = emissiveUrl ? this.loadTexture(emissiveUrl) : null;

            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.08,
                side: THREE.DoubleSide
            });

            return this.parseGeometry(geoJson, material, emissiveMap);
        } catch (e) {
            console.error('[GeckoLibLoader] Failed to load model:', geoUrl, e);
            return null;
        }
    }

    /**
     * Парсинг Bedrock / GeckoLib геометрии в иерархию THREE.Group
     */
    parseGeometry(geoJson, material, emissiveMap = null) {
        const geometries = geoJson['minecraft:geometry'] || [];
        if (!geometries.length) return new THREE.Group();

        const geo = geometries[0];
        const desc = geo.description || {};
        const texW = desc.texture_width || 64;
        const texH = desc.texture_height || 64;
        const bones = geo.bones || [];

        const rootGroup = new THREE.Group();
        rootGroup.name = desc.identifier || 'GECKOLIB_ROOT';

        const boneGroups = new Map();
        const locators = new Map();

        // 1. Создаем группы для каждой кости
        bones.forEach(b => {
            const bg = new THREE.Group();
            bg.name = `bone_${b.name}`;
            const pivot = b.pivot || [0, 0, 0];
            const rot = b.rotation || [0, 0, 0];

            bg.userData = {
                pivot: [...pivot],
                initRot: [...rot]
            };

            // Начальный поворот кости (в градусах)
            bg.rotation.set(
                THREE.MathUtils.degToRad(-rot[0]),
                THREE.MathUtils.degToRad(-rot[1]),
                THREE.MathUtils.degToRad(rot[2])
            );

            boneGroups.set(b.name, bg);

            // Локаторы
            if (b.locators) {
                Object.entries(b.locators).forEach(([locName, locPos]) => {
                    const locGroup = new THREE.Group();
                    locGroup.name = `locator_${locName}`;
                    locGroup.position.set(-locPos[0] + pivot[0], locPos[1] - pivot[1], locPos[2] - pivot[2]);
                    bg.add(locGroup);
                    locators.set(locName, locGroup);
                });
            }
        });

        // 2. Строим иерархию костей (Parent-Child)
        bones.forEach(b => {
            const bg = boneGroups.get(b.name);
            const pivot = b.pivot || [0, 0, 0];

            if (b.parent && boneGroups.has(b.parent)) {
                const parentBg = boneGroups.get(b.parent);
                const parentPivot = parentBg.userData.pivot || [0, 0, 0];
                // Относительное смещение от пивота родителя
                bg.position.set(
                    -(pivot[0] - parentPivot[0]),
                    pivot[1] - parentPivot[1],
                    pivot[2] - parentPivot[2]
                );
                parentBg.add(bg);
            } else {
                // Корневая кость
                bg.position.set(-pivot[0], pivot[1], pivot[2]);
                rootGroup.add(bg);
            }

            // 3. Строим кубы для кости
            if (b.cubes && b.cubes.length > 0) {
                const cubeGeometry = this.buildCubesGeometry(b.cubes, pivot, texW, texH, b.mirror);
                if (cubeGeometry) {
                    const mesh = new THREE.Mesh(cubeGeometry, material);
                    mesh.name = `cubes_${b.name}`;
                    bg.add(mesh);

                    // Эмиссионный светящийся слой (если есть)
                    if (emissiveMap) {
                        const emissiveMat = new THREE.MeshBasicMaterial({
                            map: emissiveMap,
                            transparent: true,
                            blending: THREE.AdditiveBlending,
                            depthWrite: false
                        });
                        const emissiveMesh = new THREE.Mesh(cubeGeometry, emissiveMat);
                        bg.add(emissiveMesh);
                    }
                }
            }
        });

        rootGroup.userData.bones = boneGroups;
        rootGroup.userData.locators = locators;
        return rootGroup;
    }

    /**
     * Компиляция кубов кости в объединенный BufferGeometry
     */
    buildCubesGeometry(cubes, bonePivot, texW, texH, defaultMirror = false) {
        const positions = [];
        const normals = [];
        const uvs = [];

        cubes.forEach(c => {
            const origin = c.origin || [0, 0, 0];
            const size = c.size || [0, 0, 0];
            const inflate = c.inflate || 0;
            const mirror = c.mirror !== undefined ? c.mirror : defaultMirror;

            // Позиции относительно пивота кости
            const minX = -(origin[0] + size[0] + inflate) + bonePivot[0];
            const maxX = -(origin[0] - inflate) + bonePivot[0];
            const minY = origin[1] - inflate - bonePivot[1];
            const maxY = origin[1] + size[1] + inflate - bonePivot[1];
            const minZ = origin[2] - inflate - bonePivot[2];
            const maxZ = origin[2] + size[2] + inflate - bonePivot[2];

            const addFace = (v0, v1, v2, v3, norm, uvRect) => {
                const u0 = uvRect[0] / texW;
                const v0 = 1.0 - uvRect[3] / texH;
                const u1 = uvRect[2] / texW;
                const v1 = 1.0 - uvRect[1] / texH;

                // Треугольник 1
                positions.push(...v0, ...v1, ...v2);
                normals.push(...norm, ...norm, ...norm);
                uvs.push(u0, v1, u0, v0, u1, v0);

                // Треугольник 2
                positions.push(...v0, ...v2, ...v3);
                normals.push(...norm, ...norm, ...norm);
                uvs.push(u0, v1, u1, v0, u1, v1);
            };

            const dx = size[0], dy = size[1], dz = size[2];

            if (Array.isArray(c.uv)) {
                // Стандартный box UV: [u, v]
                const u = c.uv[0];
                const v = c.uv[1];

                const topUV = [u + dz, v, u + dz + dx, v + dz];
                const bottomUV = [u + dz + dx, v, u + dz + dx + dx, v + dz];
                const rightUV = mirror ? [u + dz + dx, v + dz, u + dz + dx + dz, v + dz + dy] : [u, v + dz, u + dz, v + dz + dy];
                const frontUV = [u + dz, v + dz, u + dz + dx, v + dz + dy];
                const leftUV = mirror ? [u, v + dz, u + dz, v + dz + dy] : [u + dz + dx, v + dz, u + dz + dx + dz, v + dz + dy];
                const backUV = [u + dz + dx + dz, v + dz, u + dz + dx + dz + dx, v + dz + dy];

                // +X (Right)
                addFace([maxX, maxY, maxZ], [maxX, minY, maxZ], [maxX, minY, minZ], [maxX, maxY, minZ], [1, 0, 0], rightUV);
                // -X (Left)
                addFace([minX, maxY, minZ], [minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [-1, 0, 0], leftUV);
                // +Y (Top)
                addFace([minX, maxY, minZ], [minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [0, 1, 0], topUV);
                // -Y (Bottom)
                addFace([minX, minY, maxZ], [minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [0, -1, 0], bottomUV);
                // +Z (Front)
                addFace([minX, maxY, maxZ], [minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [0, 0, 1], frontUV);
                // -Z (Back)
                addFace([maxX, maxY, minZ], [maxX, minY, minZ], [minX, minY, minZ], [minX, maxY, minZ], [0, 0, -1], backUV);
            } else if (typeof c.uv === 'object' && c.uv !== null) {
                // Per-face UV
                if (c.uv.east) addFace([maxX, maxY, maxZ], [maxX, minY, maxZ], [maxX, minY, minZ], [maxX, maxY, minZ], [1, 0, 0], c.uv.east.uv);
                if (c.uv.west) addFace([minX, maxY, minZ], [minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [-1, 0, 0], c.uv.west.uv);
                if (c.uv.up) addFace([minX, maxY, minZ], [minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [0, 1, 0], c.uv.up.uv);
                if (c.uv.down) addFace([minX, minY, maxZ], [minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [0, -1, 0], c.uv.down.uv);
                if (c.uv.south) addFace([minX, maxY, maxZ], [minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [0, 0, 1], c.uv.south.uv);
                if (c.uv.north) addFace([maxX, maxY, minZ], [maxX, minY, minZ], [minX, minY, minZ], [minX, maxY, minZ], [0, 0, -1], c.uv.north.uv);
            }
        });

        if (!positions.length) return null;

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        return geo;
    }
}

export const geckolibLoader = new GeckoLibModelLoader();
