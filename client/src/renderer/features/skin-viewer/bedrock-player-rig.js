import * as THREE from 'three';

/**
 * Bedrock & GeckoLib Advanced Player Rig
 * 
 * Точный суставный скелет игрока Minecraft:
 * - Плечо + Локоть + Предплечье + Кисть
 * - Бедро + Колено + Голень + Стопа
 * - 100% совместимость с UV-разверткой и координатами Minecraft Java / Bedrock
 * - Точки крепления (Sockets): mainHand, offHand, back, head
 */

function setUVs(box, u, v, width, height, depth, textureWidth = 64, textureHeight = 64) {
    const toFaceVertices = (x1, y1, x2, y2) => [
        new THREE.Vector2(x1 / textureWidth, 1.0 - y2 / textureHeight),
        new THREE.Vector2(x2 / textureWidth, 1.0 - y2 / textureHeight),
        new THREE.Vector2(x2 / textureWidth, 1.0 - y1 / textureHeight),
        new THREE.Vector2(x1 / textureWidth, 1.0 - y1 / textureHeight),
    ];

    const top = toFaceVertices(u + depth, v, u + width + depth, v + depth);
    const bottom = toFaceVertices(u + width + depth, v, u + width * 2 + depth, v + depth);
    const left = toFaceVertices(u, v + depth, u + depth, v + depth + height);
    const front = toFaceVertices(u + depth, v + depth, u + width + depth, v + depth + height);
    const right = toFaceVertices(u + width + depth, v + depth, u + width + depth * 2, v + height + depth);
    const back = toFaceVertices(u + width + depth * 2, v + depth, u + width * 2 + depth * 2, v + height + depth);

    const uvRight = [right[3], right[2], right[0], right[1]];
    const uvLeft = [left[3], left[2], left[0], left[1]];
    const uvTop = [top[3], top[2], top[0], top[1]];
    const uvBottom = [bottom[0], bottom[1], bottom[3], bottom[2]];
    const uvFront = [front[3], front[2], front[0], front[1]];
    const uvBack = [back[3], back[2], back[0], back[1]];

    const newUVData = [];
    for (const uvArray of [uvRight, uvLeft, uvTop, uvBottom, uvFront, uvBack]) {
        for (const uv of uvArray) {
            newUVData.push(uv.x, uv.y);
        }
    }
    const uvAttr = box.attributes.uv;
    uvAttr.set(new Float32Array(newUVData));
    uvAttr.needsUpdate = true;
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
     * Построение скелета
     */
    buildHierarchy() {
        // 1. Torso
        this.bones.torso = new THREE.Group();
        this.bones.torso.name = 'bone_torso';
        this.bones.torso.position.set(0, 0, 0);
        this.root.add(this.bones.torso);

        // 2. Head (Шея на верху торса: y = +6)
        this.bones.head = new THREE.Group();
        this.bones.head.name = 'bone_head';
        this.bones.head.position.set(0, 6, 0);
        this.bones.torso.add(this.bones.head);

        // 3. Right Arm
        this.bones.rightShoulder = new THREE.Group();
        this.bones.rightShoulder.name = 'bone_right_shoulder';
        this.bones.rightShoulder.position.set(-6, 4, 0);
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

        // 4. Left Arm
        this.bones.leftShoulder = new THREE.Group();
        this.bones.leftShoulder.name = 'bone_left_shoulder';
        this.bones.leftShoulder.position.set(6, 4, 0);
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

        // 5. Right Leg
        this.bones.rightHip = new THREE.Group();
        this.bones.rightHip.name = 'bone_right_hip';
        this.bones.rightHip.position.set(-1.9, -6, 0);
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

        // 6. Left Leg
        this.bones.leftHip = new THREE.Group();
        this.bones.leftHip.name = 'bone_left_hip';
        this.bones.leftHip.position.set(1.9, -6, 0);
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
        this.sockets.mainHand = new THREE.Group();
        this.sockets.mainHand.name = 'socket_main_hand';
        this.sockets.mainHand.position.set(0, -5.5, 0);
        this.bones.rightLowerArm.add(this.sockets.mainHand);

        this.sockets.offHand = new THREE.Group();
        this.sockets.offHand.name = 'socket_off_hand';
        this.sockets.offHand.position.set(0, -5.5, 0);
        this.bones.leftLowerArm.add(this.sockets.offHand);

        this.sockets.back = new THREE.Group();
        this.sockets.back.name = 'socket_back';
        this.sockets.back.position.set(0, 0, -2.1);
        this.bones.torso.add(this.sockets.back);

        this.sockets.head = new THREE.Group();
        this.sockets.head.name = 'socket_head';
        this.sockets.head.position.set(0, 4.0, 0);
        this.bones.head.add(this.sockets.head);
    }

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
        this.clearMeshes();

        // 1. HEAD (8x8x8)
        const headGeo = new THREE.BoxGeometry(8, 8, 8);
        setUVs(headGeo, 0, 0, 8, 8, 8);
        headGeo.translate(0, 4, 0);
        this.bones.head.add(new THREE.Mesh(headGeo, this.materials.base));

        const hatGeo = new THREE.BoxGeometry(8.8, 8.8, 8.8);
        setUVs(hatGeo, 32, 0, 8, 8, 8);
        hatGeo.translate(0, 4, 0);
        this.bones.head.add(new THREE.Mesh(hatGeo, this.materials.layer2));

        // 2. TORSO (8x12x4)
        const torsoGeo = new THREE.BoxGeometry(8, 12, 4);
        setUVs(torsoGeo, 16, 16, 8, 12, 4);
        this.bones.torso.add(new THREE.Mesh(torsoGeo, this.materials.base));

        const jacketGeo = new THREE.BoxGeometry(8.6, 12.5, 4.6);
        setUVs(jacketGeo, 16, 32, 8, 12, 4);
        this.bones.torso.add(new THREE.Mesh(jacketGeo, this.materials.layer2));

        // 3. RIGHT ARM (Upper 4x6x4 + Lower 4x6x4)
        const rUpperGeo = new THREE.BoxGeometry(4, 6, 4);
        setUVs(rUpperGeo, 40, 16, 4, 6, 4);
        rUpperGeo.translate(0, -3, 0);
        this.bones.rightUpperArm.add(new THREE.Mesh(rUpperGeo, this.materials.base));

        const rSleeveUpperGeo = new THREE.BoxGeometry(4.5, 6.2, 4.5);
        setUVs(rSleeveUpperGeo, 40, 32, 4, 6, 4);
        rSleeveUpperGeo.translate(0, -3, 0);
        this.bones.rightUpperArm.add(new THREE.Mesh(rSleeveUpperGeo, this.materials.layer2));

        const rLowerGeo = new THREE.BoxGeometry(4, 6, 4);
        setUVs(rLowerGeo, 40, 22, 4, 6, 4);
        rLowerGeo.translate(0, -3, 0);
        this.bones.rightLowerArm.add(new THREE.Mesh(rLowerGeo, this.materials.base));

        const rSleeveLowerGeo = new THREE.BoxGeometry(4.5, 6.2, 4.5);
        setUVs(rSleeveLowerGeo, 40, 38, 4, 6, 4);
        rSleeveLowerGeo.translate(0, -3, 0);
        this.bones.rightLowerArm.add(new THREE.Mesh(rSleeveLowerGeo, this.materials.layer2));

        // 4. LEFT ARM (Upper 4x6x4 + Lower 4x6x4)
        const lUpperGeo = new THREE.BoxGeometry(4, 6, 4);
        setUVs(lUpperGeo, 32, 48, 4, 6, 4);
        lUpperGeo.translate(0, -3, 0);
        this.bones.leftUpperArm.add(new THREE.Mesh(lUpperGeo, this.materials.base));

        const lSleeveUpperGeo = new THREE.BoxGeometry(4.5, 6.2, 4.5);
        setUVs(lSleeveUpperGeo, 48, 48, 4, 6, 4);
        lSleeveUpperGeo.translate(0, -3, 0);
        this.bones.leftUpperArm.add(new THREE.Mesh(lSleeveUpperGeo, this.materials.layer2));

        const lLowerGeo = new THREE.BoxGeometry(4, 6, 4);
        setUVs(lLowerGeo, 32, 54, 4, 6, 4);
        lLowerGeo.translate(0, -3, 0);
        this.bones.leftLowerArm.add(new THREE.Mesh(lLowerGeo, this.materials.base));

        const lSleeveLowerGeo = new THREE.BoxGeometry(4.5, 6.2, 4.5);
        setUVs(lSleeveLowerGeo, 48, 54, 4, 6, 4);
        lSleeveLowerGeo.translate(0, -3, 0);
        this.bones.leftLowerArm.add(new THREE.Mesh(lSleeveLowerGeo, this.materials.layer2));

        // 5. RIGHT LEG (Upper 4x6x4 + Lower 4x6x4)
        const rLegUpperGeo = new THREE.BoxGeometry(4, 6, 4);
        setUVs(rLegUpperGeo, 0, 16, 4, 6, 4);
        rLegUpperGeo.translate(0, -3, 0);
        this.bones.rightUpperLeg.add(new THREE.Mesh(rLegUpperGeo, this.materials.base));

        const rPantsUpperGeo = new THREE.BoxGeometry(4.5, 6.2, 4.5);
        setUVs(rPantsUpperGeo, 0, 32, 4, 6, 4);
        rPantsUpperGeo.translate(0, -3, 0);
        this.bones.rightUpperLeg.add(new THREE.Mesh(rPantsUpperGeo, this.materials.layer2));

        const rLegLowerGeo = new THREE.BoxGeometry(4, 6, 4);
        setUVs(rLegLowerGeo, 0, 22, 4, 6, 4);
        rLegLowerGeo.translate(0, -3, 0);
        this.bones.rightLowerLeg.add(new THREE.Mesh(rLegLowerGeo, this.materials.base));

        const rPantsLowerGeo = new THREE.BoxGeometry(4.5, 6.2, 4.5);
        setUVs(rPantsLowerGeo, 0, 38, 4, 6, 4);
        rPantsLowerGeo.translate(0, -3, 0);
        this.bones.rightLowerLeg.add(new THREE.Mesh(rPantsLowerGeo, this.materials.layer2));

        // 6. LEFT LEG (Upper 4x6x4 + Lower 4x6x4)
        const lLegUpperGeo = new THREE.BoxGeometry(4, 6, 4);
        setUVs(lLegUpperGeo, 16, 48, 4, 6, 4);
        lLegUpperGeo.translate(0, -3, 0);
        this.bones.leftUpperLeg.add(new THREE.Mesh(lLegUpperGeo, this.materials.base));

        const lPantsUpperGeo = new THREE.BoxGeometry(4.5, 6.2, 4.5);
        setUVs(lPantsUpperGeo, 0, 48, 4, 6, 4);
        lPantsUpperGeo.translate(0, -3, 0);
        this.bones.leftUpperLeg.add(new THREE.Mesh(lPantsUpperGeo, this.materials.layer2));

        const lLegLowerGeo = new THREE.BoxGeometry(4, 6, 4);
        setUVs(lLegLowerGeo, 16, 54, 4, 6, 4);
        lLegLowerGeo.translate(0, -3, 0);
        this.bones.leftLowerLeg.add(new THREE.Mesh(lLegLowerGeo, this.materials.base));

        const lPantsLowerGeo = new THREE.BoxGeometry(4.5, 6.2, 4.5);
        setUVs(lPantsLowerGeo, 0, 54, 4, 6, 4);
        lPantsLowerGeo.translate(0, -3, 0);
        this.bones.leftLowerLeg.add(new THREE.Mesh(lPantsLowerGeo, this.materials.layer2));
    }

    clearMeshes() {
        const disposeMesh = (obj) => {
            if (!obj) return;
            for (let i = obj.children.length - 1; i >= 0; i--) {
                const child = obj.children[i];
                if (child.isMesh) {
                    obj.remove(child);
                    if (child.geometry) child.geometry.dispose();
                } else {
                    disposeMesh(child);
                }
            }
        };
        disposeMesh(this.root);
    }
}
