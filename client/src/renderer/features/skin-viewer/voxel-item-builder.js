import * as THREE from 'three';

/**
 * VoxelItemBuilder
 * Превращает оригинальные 2D PNG текстуры предметов из модов (Cataclysm, Simply Swords, Mekanism, Create, Twilight Forest)
 * в аутентичные объемные 3D модели предметов Minecraft в руке героя.
 */

class VoxelItemBuilder {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Создать 3D воксельный предмет из PNG картинки
     * @param {string} imgUrl Путь к картинке (например 'assets/equipment/items/frostfall.png')
     * @param {object} options Настройки масштаба, толщины и типа (held / shield / back)
     */
    async createItemMesh(imgUrl, options = {}) {
        const cacheKey = `${imgUrl}_${JSON.stringify(options)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey).clone(true);
        }

        try {
            const img = await this.loadImage(imgUrl);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, img.width, img.height);
            const data = imgData.data;
            const w = img.width;
            const h = img.height;

            const itemGroup = new THREE.Group();
            itemGroup.name = `VOXEL_ITEM_${imgUrl}`;

            const pixelSize = 1.0;
            const depth = options.depth || 0.8;
            const scale = options.scale || (16 / Math.max(w, h));

            const positions = [];
            const normals = [];
            const colors = [];

            // Собираем 3D воксельные грани
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    const r = data[idx] / 255;
                    const g = data[idx + 1] / 255;
                    const b = data[idx + 2] / 255;
                    const a = data[idx + 3] / 255;

                    if (a > 0.15) {
                        const px = (x - w / 2) * pixelSize;
                        const py = (h / 2 - y) * pixelSize;
                        const pz = 0;

                        // Front Face (+Z)
                        this.addQuad(
                            positions, normals, colors,
                            px, py, pz + depth / 2,
                            pixelSize, pixelSize,
                            [0, 0, 1], [r, g, b]
                        );
                        // Back Face (-Z)
                        this.addQuad(
                            positions, normals, colors,
                            px, py, pz - depth / 2,
                            pixelSize, pixelSize,
                            [0, 0, -1], [r * 0.85, g * 0.85, b * 0.85]
                        );

                        // Проверяем соседние пиксели для боковых граней
                        // Left
                        if (x === 0 || data[(y * w + (x - 1)) * 4 + 3] <= 38) {
                            this.addSideQuad(positions, normals, colors, px - pixelSize / 2, py, pz, depth, pixelSize, [-1, 0, 0], [r * 0.7, g * 0.7, b * 0.7], 'Y');
                        }
                        // Right
                        if (x === w - 1 || data[(y * w + (x + 1)) * 4 + 3] <= 38) {
                            this.addSideQuad(positions, normals, colors, px + pixelSize / 2, py, pz, depth, pixelSize, [1, 0, 0], [r * 0.7, g * 0.7, b * 0.7], 'Y');
                        }
                        // Top
                        if (y === 0 || data[((y - 1) * w + x) * 4 + 3] <= 38) {
                            this.addSideQuad(positions, normals, colors, px, py + pixelSize / 2, pz, pixelSize, depth, [0, 1, 0], [r * 0.9, g * 0.9, b * 0.9], 'X');
                        }
                        // Bottom
                        if (y === h - 1 || data[((y + 1) * w + x) * 4 + 3] <= 38) {
                            this.addSideQuad(positions, normals, colors, px, py - pixelSize / 2, pz, pixelSize, depth, [0, -1, 0], [r * 0.6, g * 0.6, b * 0.6], 'X');
                        }
                    }
                }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

            const material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.5,
                metalness: 0.2
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.set(scale, scale, scale);

            if (options.isShield) {
                // Щит / артефакт во второй руке (смотрит вперед)
                mesh.position.set(0, 0, 0);
                itemGroup.rotation.set(0, Math.PI / 2, 0);
                itemGroup.position.set(1.0, -8.0, 1.2);
            } else if (options.isBackpack) {
                // Рюкзак на спине
                mesh.position.set(0, 0, 0);
                itemGroup.position.set(0, 0, -3.5);
            } else {
                // Оружие / меч в основной руке:
                // Выравниваем эфес/рукоять (нижний левый угол) в центр хвата
                mesh.position.set(-w * scale * 0.25, -h * scale * 0.25, 0);
                // Поворот: -45° по Z выравнивает диагональный меч вертикально, затем -45° по X наклоняет вперед
                itemGroup.rotation.set(-Math.PI / 3.5, 0, -Math.PI / 4);
                itemGroup.position.set(-1.0, -9.5, 1.2);
            }

            itemGroup.add(mesh);
            this.cache.set(cacheKey, itemGroup);
            return itemGroup.clone(true);
        } catch (e) {
            console.warn(`[VoxelItemBuilder] Error building voxel model for ${imgUrl}`, e);
            return null;
        }
    }

    addQuad(positions, normals, colors, cx, cy, cz, w, h, norm, col) {
        const hw = w / 2;
        const hh = h / 2;

        if (norm[2] > 0) {
            // +Z Front
            positions.push(
                cx - hw, cy - hh, cz,
                cx + hw, cy - hh, cz,
                cx + hw, cy + hh, cz,
                cx - hw, cy - hh, cz,
                cx + hw, cy + hh, cz,
                cx - hw, cy + hh, cz
            );
        } else {
            // -Z Back
            positions.push(
                cx + hw, cy - hh, cz,
                cx - hw, cy - hh, cz,
                cx - hw, cy + hh, cz,
                cx + hw, cy - hh, cz,
                cx - hw, cy + hh, cz,
                cx + hw, cy + hh, cz
            );
        }

        for (let i = 0; i < 6; i++) {
            normals.push(norm[0], norm[1], norm[2]);
            colors.push(col[0], col[1], col[2]);
        }
    }

    addSideQuad(positions, normals, colors, cx, cy, cz, w, h, norm, col, axis) {
        const hw = w / 2;
        const hh = h / 2;

        if (norm[0] !== 0) {
            // Left or Right face (YZ plane)
            positions.push(
                cx, cy - hh, cz - hw,
                cx, cy - hh, cz + hw,
                cx, cy + hh, cz + hw,
                cx, cy - hh, cz - hw,
                cx, cy + hh, cz + hw,
                cx, cy + hh, cz - hw
            );
        } else {
            // Top or Bottom face (XZ plane)
            positions.push(
                cx - hw, cy, cz - hh,
                cx + hw, cy, cz - hh,
                cx + hw, cy, cz + hh,
                cx - hw, cy, cz - hh,
                cx + hw, cy, cz + hh,
                cx - hw, cy, cz + hh
            );
        }

        for (let i = 0; i < 6; i++) {
            normals.push(norm[0], norm[1], norm[2]);
            colors.push(col[0], col[1], col[2]);
        }
    }

    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = url;
        });
    }
}

export const voxelItemBuilder = new VoxelItemBuilder();
