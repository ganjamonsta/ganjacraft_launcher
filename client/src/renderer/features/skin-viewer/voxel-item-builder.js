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
        
        try {
            let voxelData = this.cache.get(cacheKey);
            if (!voxelData) {
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

                const pixelSize = 1.0;
                const depth = options.depth || 0.55;
                const scale = options.scale || (0.55 * (16 / Math.max(w, h)));

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
                            const px = (x - w / 2 + 0.5) * pixelSize;
                            const py = (h / 2 - y - 0.5) * pixelSize;
                            const pz = 0;

                            // Передняя грань (+Z)
                            this.addFaceQuad(positions, normals, colors, px, py, pz + depth / 2, pixelSize, [0, 0, 1], [r, g, b]);
                            // Задняя грань (-Z)
                            this.addFaceQuad(positions, normals, colors, px, py, pz - depth / 2, pixelSize, [0, 0, -1], [r * 0.7, g * 0.7, b * 0.7]);

                            // Боковые грани (только если соседний пиксель прозрачный)
                            // Right
                            if (x === w - 1 || data[(y * w + x + 1) * 4 + 3] <= 38) {
                                this.addSideQuad(positions, normals, colors, px + pixelSize / 2, py, pz, pixelSize, depth, [1, 0, 0], [r * 0.8, g * 0.8, b * 0.8], 'Y');
                            }
                            // Left
                            if (x === 0 || data[(y * w + x - 1) * 4 + 3] <= 38) {
                                this.addSideQuad(positions, normals, colors, px - pixelSize / 2, py, pz, pixelSize, depth, [-1, 0, 0], [r * 0.8, g * 0.8, b * 0.8], 'Y');
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

                voxelData = {
                    positions: new Float32Array(positions),
                    normals: new Float32Array(normals),
                    colors: new Float32Array(colors),
                    scale
                };
                this.cache.set(cacheKey, voxelData);
            }

            const itemGroup = new THREE.Group();
            itemGroup.name = `VOXEL_ITEM_${imgUrl}`;

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(voxelData.positions, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(voxelData.normals, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(voxelData.colors, 3));
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();

            const material = new THREE.MeshBasicMaterial({
                vertexColors: true,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            const scale = voxelData.scale;
            mesh.scale.set(scale, scale, scale);

            if (options.isBackpack) {
                // Рюкзак на спине
                mesh.position.set(0, 0, 0);
                itemGroup.position.set(0, 0, -3.5);
            } else if (options.isOffHand) {
                // Предмет во второй руке (например тотем)
                mesh.position.set(0, 0, 0);
                itemGroup.rotation.set(-0.2, 0, 0);
                itemGroup.position.set(0.6, -9.8, 0.6);
            } else {
                // Оружие / меч в основной руке:
                // Эфес/рукоять (нижний левый угол) точно в кисти
                mesh.position.set(5.5 * scale, 5.5 * scale, 0);
                // Поворот по Z выравнивает диагональный меч, наклон по X направляет вперед
                itemGroup.rotation.set(-Math.PI / 3.0, 0, -Math.PI / 4);
                itemGroup.position.set(-0.8, -9.8, 0.8);
            }

            itemGroup.add(mesh);
            return itemGroup;
        } catch (e) {
            console.warn(`[VoxelItemBuilder] Error building voxel model for ${imgUrl}`, e);
            return null;
        }
    }

    addFaceQuad(pos, norm, col, cx, cy, cz, size, n, c) {
        const hs = size / 2;
        const x1 = cx - hs, x2 = cx + hs;
        const y1 = cy - hs, y2 = cy + hs;

        // Tri 1
        pos.push(x1, y1, cz,  x2, y1, cz,  x2, y2, cz);
        norm.push(n[0], n[1], n[2],  n[0], n[1], n[2],  n[0], n[1], n[2]);
        col.push(c[0], c[1], c[2],  c[0], c[1], c[2],  c[0], c[1], c[2]);

        // Tri 2
        pos.push(x1, y1, cz,  x2, y2, cz,  x1, y2, cz);
        norm.push(n[0], n[1], n[2],  n[0], n[1], n[2],  n[0], n[1], n[2]);
        col.push(c[0], c[1], c[2],  c[0], c[1], c[2],  c[0], c[1], c[2]);
    }

    addSideQuad(pos, norm, col, cx, cy, cz, size, depth, n, c, axis) {
        const hs = size / 2;
        const hd = depth / 2;

        let v1, v2, v3, v4;

        if (axis === 'Y') {
            // Вертикальная боковая грань (Left/Right)
            v1 = [cx, cy - hs, cz - hd];
            v2 = [cx, cy - hs, cz + hd];
            v3 = [cx, cy + hs, cz + hd];
            v4 = [cx, cy + hs, cz - hd];
        } else {
            // Горизонтальная боковая грань (Top/Bottom)
            v1 = [cx - hs, cy, cz - hd];
            v2 = [cx + hs, cy, cz - hd];
            v3 = [cx + hs, cy, cz + hd];
            v4 = [cx - hs, cy, cz + hd];
        }

        // Tri 1
        pos.push(v1[0], v1[1], v1[2],  v2[0], v2[1], v2[2],  v3[0], v3[1], v3[2]);
        norm.push(n[0], n[1], n[2],  n[0], n[1], n[2],  n[0], n[1], n[2]);
        col.push(c[0], c[1], c[2],  c[0], c[1], c[2],  c[0], c[1], c[2]);

        // Tri 2
        pos.push(v1[0], v1[1], v1[2],  v3[0], v3[1], v3[2],  v4[0], v4[1], v4[2]);
        norm.push(n[0], n[1], n[2],  n[0], n[1], n[2],  n[0], n[1], n[2]);
        col.push(c[0], c[1], c[2],  c[0], c[1], c[2],  c[0], c[1], c[2]);
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
