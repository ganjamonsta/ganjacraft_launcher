import * as THREE from 'three';

/**
 * Bedrock & GeckoLib Advanced Player Rig
 * 
 * Продвинутый суставный скелет игрока Minecraft:
 * - Разделение рук на Плечо + Локоть + Предплечье + Кисть
 * - Разделение ног на Бедро + Колено + Голень + Стопу
 * - Шея, голова, торс и внешние слои одежды (2nd layer / jacket / hat / sleeves)
 * - Полная поддержка стандартных скинов Minecraft 64x64 и 64x32
 * - Точки крепления (Sockets): mainHand, offHand, back, head
 */

/**
 * Вспомогательная функция для генерации BoxBufferGeometry с кастомными UV координатами граней
 */
function createMinecraftBoxGeometry(width, height, depth, uvs, inflate = 0) {
    const w = width + inflate * 2;
    const h = height + inflate * 2;
    const d = depth + inflate * 2;

    const x0 = -w / 2, x1 = w / 2;
    const y0 = -h, y1 = 0; // pivot сверху (y=0 сверху, y=-h снизу)
    const z0 = -d / 2, z1 = d / 2;

    const positions = [];
    const normals = [];
    const uvsArray = [];

    const TW = 64.0;
    const TH = 64.0;

    const addQuad = (v0, v1, v2, v3, norm, uv) => {
        // uv: [u0, v0, u1, v1] in pixel coords
        const uMin = uv[0] / TW;
        const vMin = 1.0 - uv[3] / TH;
        const uMax = uv[2] / TW;
        const vMax = 1.0 - uv[1] / TH;

        // Треугольник 1: 0, 1, 2
        positions.push(...v0, ...v1, ...v2);
        normals.push(...norm, ...norm, ...norm);
        uvsArray.push(uMin, vMax, uMin, vMin, uMax, vMin);

        // Треугольник 2: 0, 2, 3
        positions.push(...v0, ...v2, ...v3);
        normals.push(...norm, ...norm, ...norm);
        uvsArray.push(uMin, vMax, uMax, vMin, uMax, vMax);
    };

    // Right (+X)
    if (uvs.right) addQuad([x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [1, 0, 0], uvs.right);
    // Left (-X)
    if (uvs.left) addQuad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [-1, 0, 0], uvs.left);
    // Top (+Y)
    if (uvs.top) addQuad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], uvs.top);
    // Bottom (-Y)
    if (uvs.bottom) addQuad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0], uvs.bottom);
    // Front (+Z)
    if (uvs.front) addQuad([x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [0, 0, 1], uvs.front);
    // Back (-Z)
    if (uvs.back) addQuad([x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [0, 0, -1], uvs.back);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvsArray, 2));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
}

export class BedrockPlayerRig {
    constructor() {
        this.root = new THREE.Group();
        this.root.name = 'BEDROCK_PLAYER_ROOT';

        this.materials = {
            base: null,
            layer2: null
        };

        this.bones = {};
        this.sockets = {};
        this.buildHierarchy();
    }

    /**
     * Создание полной иерархии суставов
     */
    buildHierarchy() {
        // 1. Torso
        this.bones.torso = new THREE.Group();
        this.bones.torso.name = 'bone_torso';
        this.bones.torso.position.set(0, 0, 0);
        this.root.add(this.bones.torso);

        // 2. Head (на шее сверху торса, y = 0 relative to torso top)
        this.bones.head = new THREE.Group();
        this.bones.head.name = 'bone_head';
        this.bones.head.position.set(0, 0, 0); // Шея
        this.bones.torso.add(this.bones.head);

        // 3. Right Arm (Плечо -> Локоть -> Предплечье -> Сокет)
        this.bones.rightShoulder = new THREE.Group();
        this.bones.rightShoulder.name = 'bone_right_shoulder';
        this.bones.rightShoulder.position.set(-5, -2, 0);
        this.bones.torso.add(this.bones.rightShoulder);

        this.bones.rightUpperArm = new THREE.Group();
        this.bones.rightUpperArm.name = 'bone_right_upper_arm';
        this.bones.rightShoulder.add(this.bones.rightUpperArm);

        this.bones.rightElbow = new THREE.Group();
        this.bones.rightElbow.name = 'bone_right_elbow';
        this.bones.rightElbow.position.set(0, -6, 0);
        this.bones.rightUpperArm.add(this.bones.rightElbow);

        this.bones.rightLowerArm = new THREE.Group();
        this.bones.rightLowerArm.name = 'bone_right_lower_arm';
        this.bones.rightElbow.add(this.bones.rightLowerArm);

        // 4. Left Arm (Плечо -> Локоть -> Предплечье -> Сокет)
        this.bones.leftShoulder = new THREE.Group();
        this.bones.leftShoulder.name = 'bone_left_shoulder';
        this.bones.leftShoulder.position.set(5, -2, 0);
        this.bones.torso.add(this.bones.leftShoulder);

        this.bones.leftUpperArm = new THREE.Group();
        this.bones.leftUpperArm.name = 'bone_left_upper_arm';
        this.bones.leftShoulder.add(this.bones.leftUpperArm);

        this.bones.leftElbow = new THREE.Group();
        this.bones.leftElbow.name = 'bone_left_elbow';
        this.bones.leftElbow.position.set(0, -6, 0);
        this.bones.leftUpperArm.add(this.bones.leftElbow);

        this.bones.leftLowerArm = new THREE.Group();
        this.bones.leftLowerArm.name = 'bone_left_lower_arm';
        this.bones.leftElbow.add(this.bones.leftLowerArm);

        // 5. Right Leg (Бедро -> Колено -> Голень)
        this.bones.rightHip = new THREE.Group();
        this.bones.rightHip.name = 'bone_right_hip';
        this.bones.rightHip.position.set(-1.9, -12, 0);
        this.bones.torso.add(this.bones.rightHip);

        this.bones.rightUpperLeg = new THREE.Group();
        this.bones.rightUpperLeg.name = 'bone_right_upper_leg';
        this.bones.rightHip.add(this.bones.rightUpperLeg);

        this.bones.rightKnee = new THREE.Group();
        this.bones.rightKnee.name = 'bone_right_knee';
        this.bones.rightKnee.position.set(0, -6, 0);
        this.bones.rightUpperLeg.add(this.bones.rightKnee);

        this.bones.rightLowerLeg = new THREE.Group();
        this.bones.rightLowerLeg.name = 'bone_right_lower_leg';
        this.bones.rightKnee.add(this.bones.rightLowerLeg);

        // 6. Left Leg (Бедро -> Колено -> Голень)
        this.bones.leftHip = new THREE.Group();
        this.bones.leftHip.name = 'bone_left_hip';
        this.bones.leftHip.position.set(1.9, -12, 0);
        this.bones.torso.add(this.bones.leftHip);

        this.bones.leftUpperLeg = new THREE.Group();
        this.bones.leftUpperLeg.name = 'bone_left_upper_leg';
        this.bones.leftHip.add(this.bones.leftUpperLeg);

        this.bones.leftKnee = new THREE.Group();
        this.bones.leftKnee.name = 'bone_left_knee';
        this.bones.leftKnee.position.set(0, -6, 0);
        this.bones.leftUpperLeg.add(this.bones.leftKnee);

        this.bones.leftLowerLeg = new THREE.Group();
        this.bones.leftLowerLeg.name = 'bone_left_lower_leg';
        this.bones.leftKnee.add(this.bones.leftLowerLeg);

        // ── ТОЧКИ КРЕПЛЕНИЯ (SOCKETS) ──
        // Основная рука (TACZ стволы / мечи)
        this.sockets.mainHand = new THREE.Group();
        this.sockets.mainHand.name = 'socket_main_hand';
        this.sockets.mainHand.position.set(0, -5.5, 0);
        this.bones.rightLowerArm.add(this.sockets.mainHand);

        // Вторая рука (цевьё / щит)
        this.sockets.offHand = new THREE.Group();
        this.sockets.offHand.name = 'socket_off_hand';
        this.sockets.offHand.position.set(0, -5.5, 0);
        this.bones.leftLowerArm.add(this.sockets.offHand);

        // Спина (рюкзаки, плащи, крылья)
        this.sockets.back = new THREE.Group();
        this.sockets.back.name = 'socket_back';
        this.sockets.back.position.set(0, -6, 2.2);
        this.bones.torso.add(this.sockets.back);

        // Голова (шлемы, короны)
        this.sockets.head = new THREE.Group();
        this.sockets.head.name = 'socket_head';
        this.sockets.head.position.set(0, 0, 0);
        this.bones.head.add(this.sockets.head);
    }

    /**
     * Создание мешей тела с текстурой скина
     */
    applySkinTexture(texture) {
        if (!texture) return;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;

        this.materials.base = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide
        });

        this.materials.layer2 = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide
        });

        this.rebuildSkinMeshes();
    }

    rebuildSkinMeshes() {
        if (!this.materials.base) return;

        // Удаляем старые меши
        this.clearMeshes();

        // 1. HEAD (8x8x8)
        const headGeo = createMinecraftBoxGeometry(8, 8, 8, {
            top: [8, 0, 16, 8],
            bottom: [16, 0, 24, 8],
            right: [0, 8, 8, 16],
            front: [8, 8, 16, 16],
            left: [16, 8, 24, 16],
            back: [24, 8, 32, 16]
        });
        const headMesh = new THREE.Mesh(headGeo, this.materials.base);
        headMesh.name = 'mesh_head';
        headMesh.position.set(0, 8, 0);
        this.bones.head.add(headMesh);

        // Hat Layer
        const hatGeo = createMinecraftBoxGeometry(8, 8, 8, {
            top: [40, 0, 48, 8],
            bottom: [48, 0, 56, 8],
            right: [32, 8, 40, 16],
            front: [40, 8, 48, 16],
            left: [48, 8, 56, 16],
            back: [56, 8, 64, 16]
        }, 0.5);
        const hatMesh = new THREE.Mesh(hatGeo, this.materials.layer2);
        hatMesh.name = 'mesh_hat';
        hatMesh.position.set(0, 8, 0);
        this.bones.head.add(hatMesh);

        // 2. TORSO (8x12x4)
        const torsoGeo = createMinecraftBoxGeometry(8, 12, 4, {
            top: [20, 16, 28, 20],
            bottom: [28, 16, 36, 20],
            right: [16, 20, 20, 32],
            front: [20, 20, 28, 32],
            left: [28, 20, 32, 32],
            back: [32, 20, 40, 32]
        });
        const torsoMesh = new THREE.Mesh(torsoGeo, this.materials.base);
        torsoMesh.name = 'mesh_torso';
        this.bones.torso.add(torsoMesh);

        // Jacket Layer
        const jacketGeo = createMinecraftBoxGeometry(8, 12, 4, {
            top: [20, 32, 28, 36],
            bottom: [28, 32, 36, 36],
            right: [16, 36, 20, 48],
            front: [20, 36, 28, 48],
            left: [28, 36, 32, 48],
            back: [32, 36, 40, 48]
        }, 0.35);
        const jacketMesh = new THREE.Mesh(jacketGeo, this.materials.layer2);
        jacketMesh.name = 'mesh_jacket';
        this.bones.torso.add(jacketMesh);

        // 3. RIGHT ARM (Upper 4x6x4 + Lower 4x6x4)
        const rUpperGeo = createMinecraftBoxGeometry(4, 6, 4, {
            top: [44, 16, 48, 20],
            bottom: [48, 16, 52, 20],
            right: [40, 20, 44, 26],
            front: [44, 20, 48, 26],
            left: [48, 20, 52, 26],
            back: [52, 20, 56, 26]
        });
        const rUpperMesh = new THREE.Mesh(rUpperGeo, this.materials.base);
        rUpperMesh.name = 'mesh_right_upper_arm';
        this.bones.rightUpperArm.add(rUpperMesh);

        const rLowerGeo = createMinecraftBoxGeometry(4, 6, 4, {
            bottom: [48, 16, 52, 20],
            right: [40, 26, 44, 32],
            front: [44, 26, 48, 32],
            left: [48, 26, 52, 32],
            back: [52, 26, 56, 32]
        });
        const rLowerMesh = new THREE.Mesh(rLowerGeo, this.materials.base);
        rLowerMesh.name = 'mesh_right_lower_arm';
        this.bones.rightLowerArm.add(rLowerMesh);

        // Right Sleeve Layer
        const rSleeveUpperGeo = createMinecraftBoxGeometry(4, 6, 4, {
            top: [44, 32, 48, 36],
            bottom: [48, 32, 52, 36],
            right: [40, 36, 44, 42],
            front: [44, 36, 48, 42],
            left: [48, 36, 52, 42],
            back: [52, 36, 56, 42]
        }, 0.28);
        this.bones.rightUpperArm.add(new THREE.Mesh(rSleeveUpperGeo, this.materials.layer2));

        const rSleeveLowerGeo = createMinecraftBoxGeometry(4, 6, 4, {
            bottom: [48, 32, 52, 36],
            right: [40, 42, 44, 48],
            front: [44, 42, 48, 48],
            left: [48, 42, 52, 48],
            back: [52, 42, 56, 48]
        }, 0.28);
        this.bones.rightLowerArm.add(new THREE.Mesh(rSleeveLowerGeo, this.materials.layer2));

        // 4. LEFT ARM (Upper 4x6x4 + Lower 4x6x4)
        const lUpperGeo = createMinecraftBoxGeometry(4, 6, 4, {
            top: [36, 48, 40, 52],
            bottom: [40, 48, 44, 52],
            right: [32, 52, 36, 58],
            front: [36, 52, 40, 58],
            left: [40, 52, 44, 58],
            back: [44, 52, 48, 58]
        });
        const lUpperMesh = new THREE.Mesh(lUpperGeo, this.materials.base);
        lUpperMesh.name = 'mesh_left_upper_arm';
        this.bones.leftUpperArm.add(lUpperMesh);

        const lLowerGeo = createMinecraftBoxGeometry(4, 6, 4, {
            bottom: [40, 48, 44, 52],
            right: [32, 58, 36, 64],
            front: [36, 58, 40, 64],
            left: [40, 58, 44, 64],
            back: [44, 58, 48, 64]
        });
        const lLowerMesh = new THREE.Mesh(lLowerGeo, this.materials.base);
        lLowerMesh.name = 'mesh_left_lower_arm';
        this.bones.leftLowerArm.add(lLowerMesh);

        // Left Sleeve Layer
        const lSleeveUpperGeo = createMinecraftBoxGeometry(4, 6, 4, {
            top: [52, 48, 56, 52],
            bottom: [56, 48, 60, 52],
            right: [48, 52, 52, 58],
            front: [52, 52, 56, 58],
            left: [56, 52, 60, 58],
            back: [60, 52, 64, 58]
        }, 0.28);
        this.bones.leftUpperArm.add(new THREE.Mesh(lSleeveUpperGeo, this.materials.layer2));

        const lSleeveLowerGeo = createMinecraftBoxGeometry(4, 6, 4, {
            bottom: [56, 48, 60, 52],
            right: [48, 58, 52, 64],
            front: [52, 58, 56, 64],
            left: [56, 58, 60, 64],
            back: [60, 58, 64, 64]
        }, 0.28);
        this.bones.leftLowerArm.add(new THREE.Mesh(lSleeveLowerGeo, this.materials.layer2));

        // 5. RIGHT LEG (Upper 4x6x4 + Lower 4x6x4)
        const rThighGeo = createMinecraftBoxGeometry(4, 6, 4, {
            top: [4, 16, 8, 20],
            bottom: [8, 16, 12, 20],
            right: [0, 20, 4, 26],
            front: [4, 20, 8, 26],
            left: [8, 20, 12, 26],
            back: [12, 20, 16, 26]
        });
        this.bones.rightUpperLeg.add(new THREE.Mesh(rThighGeo, this.materials.base));

        const rShinGeo = createMinecraftBoxGeometry(4, 6, 4, {
            bottom: [8, 16, 12, 20],
            right: [0, 26, 4, 32],
            front: [4, 26, 8, 32],
            left: [8, 26, 12, 32],
            back: [12, 26, 16, 32]
        });
        this.bones.rightLowerLeg.add(new THREE.Mesh(rShinGeo, this.materials.base));

        // Right Pants Layer
        const rPantUpperGeo = createMinecraftBoxGeometry(4, 6, 4, {
            top: [4, 32, 8, 36],
            bottom: [8, 32, 12, 36],
            right: [0, 36, 4, 42],
            front: [4, 36, 8, 42],
            left: [8, 36, 12, 42],
            back: [12, 36, 16, 42]
        }, 0.25);
        this.bones.rightUpperLeg.add(new THREE.Mesh(rPantUpperGeo, this.materials.layer2));

        const rPantLowerGeo = createMinecraftBoxGeometry(4, 6, 4, {
            bottom: [8, 32, 12, 36],
            right: [0, 42, 4, 48],
            front: [4, 42, 8, 48],
            left: [8, 42, 12, 48],
            back: [12, 42, 16, 48]
        }, 0.25);
        this.bones.rightLowerLeg.add(new THREE.Mesh(rPantLowerGeo, this.materials.layer2));

        // 6. LEFT LEG (Upper 4x6x4 + Lower 4x6x4)
        const lThighGeo = createMinecraftBoxGeometry(4, 6, 4, {
            top: [20, 48, 24, 52],
            bottom: [24, 48, 28, 52],
            right: [16, 52, 20, 58],
            front: [20, 52, 24, 58],
            left: [24, 52, 28, 58],
            back: [28, 52, 32, 58]
        });
        this.bones.leftUpperLeg.add(new THREE.Mesh(lThighGeo, this.materials.base));

        const lShinGeo = createMinecraftBoxGeometry(4, 6, 4, {
            bottom: [24, 48, 28, 52],
            right: [16, 58, 20, 64],
            front: [20, 58, 24, 64],
            left: [24, 58, 28, 64],
            back: [28, 58, 32, 64]
        });
        this.bones.leftLowerLeg.add(new THREE.Mesh(lShinGeo, this.materials.base));

        // Left Pants Layer
        const lPantUpperGeo = createMinecraftBoxGeometry(4, 6, 4, {
            top: [4, 48, 8, 52],
            bottom: [8, 48, 12, 52],
            right: [0, 52, 4, 58],
            front: [4, 52, 8, 58],
            left: [8, 52, 12, 58],
            back: [12, 52, 16, 58]
        }, 0.25);
        this.bones.leftUpperLeg.add(new THREE.Mesh(lPantUpperGeo, this.materials.layer2));

        const lPantLowerGeo = createMinecraftBoxGeometry(4, 6, 4, {
            bottom: [8, 48, 12, 52],
            right: [0, 58, 4, 64],
            front: [4, 58, 8, 64],
            left: [8, 58, 12, 64],
            back: [12, 58, 16, 64]
        }, 0.25);
        this.bones.leftLowerLeg.add(new THREE.Mesh(lPantLowerGeo, this.materials.layer2));
    }

    clearMeshes() {
        const disposeNode = (node) => {
            if (!node) return;
            for (let i = node.children.length - 1; i >= 0; i--) {
                const child = node.children[i];
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    node.remove(child);
                } else if (!child.name.startsWith('socket_') && !child.name.startsWith('bone_')) {
                    disposeNode(child);
                }
            }
        };

        Object.values(this.bones).forEach(bone => disposeNode(bone));
    }
}
