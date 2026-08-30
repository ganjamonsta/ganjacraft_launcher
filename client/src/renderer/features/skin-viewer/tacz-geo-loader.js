import * as THREE from 'three';

/**
 * TACZ & Bedrock Geometry 3D Loader
 * Парсит оригинальные .geo.json модели TACZ и компилирует всю геометрию
 * в оптимизированный THREE.BufferGeometry (1 Draw Call).
 */

class TaczGeoLoader {
    constructor() {
        this.dataCache = new Map();
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
        try {
            let data = this.dataCache.get(gunId);
            if (!data) {
                const geoUrl = `assets/tacz/geo/${gunId}_geo.json`;
                const res = await fetch(geoUrl);
                if (!res.ok) throw new Error(`Failed to fetch TACZ geo for ${gunId}`);
                const geoJson = await res.json();
                data = this.parseBedrockGeoData(geoJson, gunId);
                this.dataCache.set(gunId, data);
            }

            const texUrl = `assets/tacz/uv/${gunId}.png`;
            const texture = this.loadTexture(texUrl);
            
            // Используем MeshBasicMaterial для идеальной стабильности WebGL и аутентичного вида пикселей
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.1,
                side: THREE.DoubleSide
            });

            const rootGroup = new THREE.Group();
            rootGroup.name = `TACZ_GUN_${gunId}`;

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(data.positions), 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(data.normals), 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(data.uvs), 2));
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(data.pivot[0], -data.pivot[1], -data.pivot[2]);
            rootGroup.add(mesh);

            if (gunId === 'minigun') {
                rootGroup.rotation.set(-Math.PI / 2 + 0.15, 0, Math.PI);
                rootGroup.scale.set(0.58, 0.58, 0.58);
                rootGroup.position.set(-0.5, -9.6, 0.6);
            } else if (gunId === 'rpg7') {
                rootGroup.rotation.set(-Math.PI / 2, 0, Math.PI);
                rootGroup.scale.set(0.65, 0.65, 0.65);
                rootGroup.position.set(-0.5, -9.8, 1.0);
            } else if (gunId === 'glock_17' || gunId === 'deagle') {
                rootGroup.rotation.set(-Math.PI / 2, 0, Math.PI);
                rootGroup.scale.set(0.68, 0.68, 0.68);
                rootGroup.position.set(0, -10.4, 0.4);
            } else {
                // ak47, vector45, spas_12, ai_awp, p90, m4a1 и др.
                rootGroup.rotation.set(-Math.PI / 2, 0, Math.PI);
                rootGroup.scale.set(0.65, 0.65, 0.65);
                rootGroup.position.set(0, -10.2, 0.5);
            }

            return rootGroup;
        } catch (e) {
            console.warn(`[TaczGeoLoader] Could not load real 3D model for ${gunId}, fallback`, e);
            return null;
        }
    }

    /**
     * Парсер Bedrock 1.12.0 minecraft:geometry в сырые массивы геометрии
     */
    parseBedrockGeoData(geoJson, gunId) {
        const geometries = geoJson['minecraft:geometry'] || [];
        if (!geometries.length) {
            return { positions: [], normals: [], uvs: [], pivot: [0, 0, 0] };
        }

        const geo = geometries[0];
        const desc = geo.description || {};
        const texW = desc.texture_width || 64;
        const texH = desc.texture_height || 64;
        const bones = geo.bones || [];

        const boneMap = new Map();
        bones.forEach(b => boneMap.set(b.name, b));

        const boneWorldMatrices = new Map();

        const getBoneMatrix = (boneName) => {
            if (boneWorldMatrices.has(boneName)) {
                return boneWorldMatrices.get(boneName);
            }
            const bone = boneMap.get(boneName);
            if (!bone) {
                const idMat = new THREE.Matrix4();
                boneWorldMatrices.set(boneName, idMat);
                return idMat;
            }

            const bName = (bone.name || '').toLowerCase();
            if (bName.includes('lefthand') || bName.includes('righthand') || bName === 'camera' || bName === 'crosshair') {
                return null;
            }

            const pivot = bone.pivot || [0, 0, 0];
            const rot = bone.rotation || [0, 0, 0];

            const mTranslateToPivot = new THREE.Matrix4().makeTranslation(-pivot[0], pivot[1], pivot[2]);
            const mRot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                THREE.MathUtils.degToRad(-rot[0]),
                THREE.MathUtils.degToRad(-rot[1]),
                THREE.MathUtils.degToRad(rot[2]),
                'ZYX'
            ));
            const mTranslateFromPivot = new THREE.Matrix4().makeTranslation(pivot[0], -pivot[1], -pivot[2]);

            const localMat = new THREE.Matrix4();
            localMat.multiply(mTranslateToPivot);
            localMat.multiply(mRot);
            localMat.multiply(mTranslateFromPivot);

            if (bone.parent && boneMap.has(bone.parent)) {
                const parentMat = getBoneMatrix(bone.parent);
                if (parentMat) {
                    const combined = new THREE.Matrix4();
                    combined.multiplyMatrices(parentMat, localMat);
                    boneWorldMatrices.set(boneName, combined);
                    return combined;
                }
            }

            boneWorldMatrices.set(boneName, localMat);
            return localMat;
        };

        const positions = [];
        const normals = [];
        const uvs = [];

        for (const bone of bones) {
            const boneMat = getBoneMatrix(bone.name);
            if (!boneMat) continue;

            const cubes = bone.cubes || [];
            for (const cube of cubes) {
                const origin = cube.origin || [0, 0, 0];
                const size = cube.size || [1, 1, 1];
                const inflate = cube.inflate || 0;

                const minX = - (origin[0] + size[0] + inflate);
                const maxX = - (origin[0] - inflate);
                const minY = origin[1] - inflate;
                const maxY = origin[1] + size[1] + inflate;
                const minZ = origin[2] - inflate;
                const maxZ = origin[2] + size[2] + inflate;

                const corners = [
                    new THREE.Vector3(minX, minY, minZ),
                    new THREE.Vector3(minX, minY, maxZ),
                    new THREE.Vector3(minX, maxY, minZ),
                    new THREE.Vector3(minX, maxY, maxZ),
                    new THREE.Vector3(maxX, minY, minZ),
                    new THREE.Vector3(maxX, minY, maxZ),
                    new THREE.Vector3(maxX, maxY, minZ),
                    new THREE.Vector3(maxX, maxY, maxZ),
                ];

                let cubeMat = boneMat;
                if (cube.rotation && cube.pivot) {
                    const cPivot = cube.pivot;
                    const cRot = cube.rotation;
                    const cTransTo = new THREE.Matrix4().makeTranslation(-cPivot[0], cPivot[1], cPivot[2]);
                    const cRotM = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
                        THREE.MathUtils.degToRad(-cRot[0]),
                        THREE.MathUtils.degToRad(-cRot[1]),
                        THREE.MathUtils.degToRad(cRot[2]),
                        'ZYX'
                    ));
                    const cTransFrom = new THREE.Matrix4().makeTranslation(cPivot[0], -cPivot[1], -cPivot[2]);
                    const cLocal = new THREE.Matrix4().multiply(cTransTo).multiply(cRotM).multiply(cTransFrom);
                    cubeMat = new THREE.Matrix4().multiplyMatrices(boneMat, cLocal);
                }

                corners.forEach(p => p.applyMatrix4(cubeMat));

                const faces = [
                    { idxs: [5, 4, 6, 7], norm: [1, 0, 0], face: 'east' },
                    { idxs: [0, 1, 3, 2], norm: [-1, 0, 0], face: 'west' },
                    { idxs: [3, 7, 6, 2], norm: [0, 1, 0], face: 'up' },
                    { idxs: [0, 4, 5, 1], norm: [0, -1, 0], face: 'down' },
                    { idxs: [1, 5, 7, 3], norm: [0, 0, 1], face: 'south' },
                    { idxs: [4, 0, 2, 6], norm: [0, 0, -1], face: 'north' }
                ];

                const uv = cube.uv;
                const dx = size[0];
                const dy = size[1];
                const dz = size[2];

                faces.forEach((f, fIdx) => {
                    let u0 = 0, v0 = 0, u1 = 0, v1 = 0;

                    if (uv && typeof uv === 'object' && !Array.isArray(uv)) {
                        const fData = uv[f.face];
                        if (fData && fData.uv) {
                            const fu = fData.uv[0];
                            const fv = fData.uv[1];
                            const fuw = fData.uv_size ? fData.uv_size[0] : 1;
                            const fuh = fData.uv_size ? fData.uv_size[1] : 1;
                            u0 = fu / texW;
                            v0 = 1.0 - (fv + fuh) / texH;
                            u1 = (fu + fuw) / texW;
                            v1 = 1.0 - fv / texH;
                        }
                    } else if (Array.isArray(uv)) {
                        const bu = uv[0];
                        const bv = uv[1];
                        let fx = 0, fy = 0, fw = 0, fh = 0;
                        if (fIdx === 0) { fx = bu; fy = bv + dz; fw = dz; fh = dy; }
                        else if (fIdx === 1) { fx = bu + dz + dx; fy = bv + dz; fw = dz; fh = dy; }
                        else if (fIdx === 2) { fx = bu + dz; fy = bv; fw = dx; fh = dz; }
                        else if (fIdx === 3) { fx = bu + dz + dx; fy = bv; fw = dx; fh = dz; }
                        else if (fIdx === 4) { fx = bu + dz + dz; fy = bv + dz; fw = dx; fh = dy; }
                        else if (fIdx === 5) { fx = bu + dz * 2 + dx; fy = bv + dz; fw = dx; fh = dy; }

                        u0 = fx / texW;
                        v0 = 1.0 - (fy + fh) / texH;
                        u1 = (fx + fw) / texW;
                        v1 = 1.0 - fy / texH;
                    }

                    const vA = corners[f.idxs[0]];
                    const vB = corners[f.idxs[1]];
                    const vC = corners[f.idxs[2]];
                    const vD = corners[f.idxs[3]];

                    // Triangle 1: A, B, C
                    positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
                    normals.push(f.norm[0], f.norm[1], f.norm[2], f.norm[0], f.norm[1], f.norm[2], f.norm[0], f.norm[1], f.norm[2]);
                    uvs.push(u0, v0, u1, v0, u1, v1);

                    // Triangle 2: A, C, D
                    positions.push(vA.x, vA.y, vA.z, vC.x, vC.y, vC.z, vD.x, vD.y, vD.z);
                    normals.push(f.norm[0], f.norm[1], f.norm[2], f.norm[0], f.norm[1], f.norm[2], f.norm[0], f.norm[1], f.norm[2]);
                    uvs.push(u0, v0, u1, v1, u0, v1);
                });
            }
        }

        const rootBone = bones.find(b => b.name === 'root') || bones[0];
        const pivot = rootBone?.pivot || [0, 0, 0];

        return {
            positions,
            normals,
            uvs,
            pivot
        };
    }
}

export const taczGeoLoader = new TaczGeoLoader();
