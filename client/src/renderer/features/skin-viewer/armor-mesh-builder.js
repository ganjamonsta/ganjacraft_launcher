import * as THREE from 'three';

/**
 * ArmorMeshBuilder
 * Полноценный 3D билдер ванильной брони Minecraft с математически точной UV-разверткой (Java Edition).
 */

function setMinecraftUVs(box, u, v, width, height, depth, textureWidth = 64, textureHeight = 32) {
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

class ArmorMeshBuilder {
    constructor() {
        this.textureCache = new Map();
        this.textureLoader = new THREE.TextureLoader();
    }

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

    createMaterial(textureUrl) {
        const texture = this.loadTexture(textureUrl);
        return new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide
        });
    }

    // ── 🪖 ШЛЕМ ──
    buildHelmet(textureUrl, options = {}) {
        const group = new THREE.Group();
        group.name = `ARMOR_HELMET_${options.id || 'custom'}`;
        const mat = this.createMaterial(textureUrl);

        // Основной слой шлема (Head Layer 1: u=0, v=0, w=8, h=8, d=8)
        const helmGeo = new THREE.BoxGeometry(8.9, 8.9, 8.9);
        setMinecraftUVs(helmGeo, 0, 0, 8, 8, 8, 64, 32);
        const helmMesh = new THREE.Mesh(helmGeo, mat);
        helmMesh.position.set(0, 4.0, 0);
        group.add(helmMesh);

        // Внешний слой налобника / забрала (Head Overlay Layer 2: u=32, v=0, w=8, h=8, d=8)
        const overlayGeo = new THREE.BoxGeometry(9.4, 9.4, 9.4);
        setMinecraftUVs(overlayGeo, 32, 0, 8, 8, 8, 64, 32);
        const overlayMesh = new THREE.Mesh(overlayGeo, mat);
        overlayMesh.position.set(0, 4.0, 0);
        group.add(overlayMesh);

        return group;
    }

    // ── 🎽 НАГРУДНИК ──
    buildChestplate(textureUrl, target, options = {}) {
        const group = new THREE.Group();
        group.name = `ARMOR_CHEST_${options.id || 'custom'}`;
        const mat = this.createMaterial(textureUrl);

        const isRig = !!(target && target.torso);

        // Торс нагрудника (Body Layer 1: u=16, v=16, w=8, h=12, d=4)
        const bodyGeo = new THREE.BoxGeometry(8.9, 12.5, 4.8);
        setMinecraftUVs(bodyGeo, 16, 16, 8, 12, 4, 64, 32);
        const bodyMesh = new THREE.Mesh(bodyGeo, mat);
        bodyMesh.name = `ARMOR_BODY_${options.id || 'custom'}`;
        bodyMesh.position.set(0, isRig ? -6.0 : 0, 0);

        if (isRig) {
            target.torso.add(bodyMesh);
        } else if (target && target.body) {
            target.body.add(bodyMesh);
        }

        // Наплечник правый (Right Arm Layer 1: u=40, v=16, w=4, h=12, d=4)
        const pauldronGeoR = new THREE.BoxGeometry(4.8, isRig ? 6.5 : 12.5, 4.8);
        setMinecraftUVs(pauldronGeoR, 40, 16, 4, isRig ? 6 : 12, 4, 64, 32);

        if (isRig && target.rightUpperArm) {
            const pauldronR = new THREE.Mesh(pauldronGeoR, mat);
            pauldronR.name = `ARMOR_PAULDRON_R_${options.id || 'custom'}`;
            pauldronR.position.set(0, -3.0, 0);
            target.rightUpperArm.add(pauldronR);
        } else if (target && target.rightArm) {
            const pauldronR = new THREE.Mesh(pauldronGeoR, mat);
            pauldronR.name = `ARMOR_PAULDRON_R_${options.id || 'custom'}`;
            pauldronR.position.set(-1.0, -4.0, 0);
            target.rightArm.add(pauldronR);
        }

        // Наплечник левый (Left Arm Layer 1: u=40, v=16 mirrored в 64x32)
        const pauldronGeoL = new THREE.BoxGeometry(4.8, isRig ? 6.5 : 12.5, 4.8);
        setMinecraftUVs(pauldronGeoL, 40, 16, 4, isRig ? 6 : 12, 4, 64, 32);

        if (isRig && target.leftUpperArm) {
            const pauldronL = new THREE.Mesh(pauldronGeoL, mat);
            pauldronL.name = `ARMOR_PAULDRON_L_${options.id || 'custom'}`;
            pauldronL.position.set(0, -3.0, 0);
            target.leftUpperArm.add(pauldronL);
        } else if (target && target.leftArm) {
            const pauldronL = new THREE.Mesh(pauldronGeoL, mat);
            pauldronL.name = `ARMOR_PAULDRON_L_${options.id || 'custom'}`;
            pauldronL.position.set(1.0, -4.0, 0);
            target.leftArm.add(pauldronL);
        }

        return group;
    }

    // ── 👖 ПОНОЖИ (Layer 2) ──
    buildLeggings(textureUrl, target, options = {}) {
        const mat = this.createMaterial(textureUrl);
        const isRig = !!(target && target.torso);

        // Пояс на теле (Body Layer 2: u=16, v=16, w=8, h=12, d=4)
        const beltGeo = new THREE.BoxGeometry(8.6, 5.0, 4.6);
        setMinecraftUVs(beltGeo, 16, 16, 8, 12, 4, 64, 32);
        const beltMesh = new THREE.Mesh(beltGeo, mat);
        beltMesh.name = `ARMOR_BELT_${options.id || 'custom'}`;
        beltMesh.position.set(0, isRig ? -9.8 : -3.8, 0);

        if (isRig && target.torso) {
            target.torso.add(beltMesh);
        } else if (target && target.body) {
            target.body.add(beltMesh);
        }

        // Правая штанина (Leg Layer 2: u=0, v=16, w=4, h=12, d=4)
        const legGeoR = new THREE.BoxGeometry(4.6, isRig ? 6.2 : 12.2, 4.6);
        setMinecraftUVs(legGeoR, 0, 16, 4, isRig ? 6 : 12, 4, 64, 32);

        if (isRig && target.rightUpperLeg) {
            const legR = new THREE.Mesh(legGeoR, mat);
            legR.name = `ARMOR_LEGS_R_${options.id || 'custom'}`;
            legR.position.set(0, -3.0, 0);
            target.rightUpperLeg.add(legR);
        } else if (target && target.rightLeg) {
            const legR = new THREE.Mesh(legGeoR, mat);
            legR.name = `ARMOR_LEGS_R_${options.id || 'custom'}`;
            legR.position.set(0, -6.0, 0);
            target.rightLeg.add(legR);
        }

        // Левая штанина (Leg Layer 2: u=0, v=16, w=4, h=12, d=4)
        const legGeoL = new THREE.BoxGeometry(4.6, isRig ? 6.2 : 12.2, 4.6);
        setMinecraftUVs(legGeoL, 0, 16, 4, isRig ? 6 : 12, 4, 64, 32);

        if (isRig && target.leftUpperLeg) {
            const legL = new THREE.Mesh(legGeoL, mat);
            legL.name = `ARMOR_LEGS_L_${options.id || 'custom'}`;
            legL.position.set(0, -3.0, 0);
            target.leftUpperLeg.add(legL);
        } else if (target && target.leftLeg) {
            const legL = new THREE.Mesh(legGeoL, mat);
            legL.name = `ARMOR_LEGS_L_${options.id || 'custom'}`;
            legL.position.set(0, -6.0, 0);
            target.leftLeg.add(legL);
        }
    }

    // ── 👢 БОТИНКИ (Layer 1) ──
    buildBoots(textureUrl, target, options = {}) {
        const mat = this.createMaterial(textureUrl);
        const isRig = !!(target && target.torso);

        // Правый ботинок (Boot Layer 1: u=0, v=16, w=4, h=12, d=4)
        const bootGeoR = new THREE.BoxGeometry(4.8, isRig ? 6.2 : 12.2, 4.8);
        setMinecraftUVs(bootGeoR, 0, 16, 4, isRig ? 6 : 12, 4, 64, 32);

        if (isRig && target.rightLowerLeg) {
            const bootR = new THREE.Mesh(bootGeoR, mat);
            bootR.name = `ARMOR_BOOTS_R_${options.id || 'custom'}`;
            bootR.position.set(0, -3.0, 0);
            target.rightLowerLeg.add(bootR);
        } else if (target && target.rightLeg) {
            const bootR = new THREE.Mesh(bootGeoR, mat);
            bootR.name = `ARMOR_BOOTS_R_${options.id || 'custom'}`;
            bootR.position.set(0, -6.0, 0);
            target.rightLeg.add(bootR);
        }

        // Левый ботинок (Boot Layer 1: u=0, v=16, w=4, h=12, d=4)
        const bootGeoL = new THREE.BoxGeometry(4.8, isRig ? 6.2 : 12.2, 4.8);
        setMinecraftUVs(bootGeoL, 0, 16, 4, isRig ? 6 : 12, 4, 64, 32);

        if (isRig && target.leftLowerLeg) {
            const bootL = new THREE.Mesh(bootGeoL, mat);
            bootL.name = `ARMOR_BOOTS_L_${options.id || 'custom'}`;
            bootL.position.set(0, -3.0, 0);
            target.leftLowerLeg.add(bootL);
        } else if (target && target.leftLeg) {
            const bootL = new THREE.Mesh(bootGeoL, mat);
            bootL.name = `ARMOR_BOOTS_L_${options.id || 'custom'}`;
            bootL.position.set(0, -6.0, 0);
            target.leftLeg.add(bootL);
        }
    }
}

export const armorMeshBuilder = new ArmorMeshBuilder();
