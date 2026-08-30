import * as THREE from 'three';

/**
 * ArmorMeshBuilder
 * Строит 3D меши брони Minecraft (шлем, нагрудник, поножи, ботинки)
 * с точным позиционированием под скелет skinview3d и наложением текстур (NearestFilter).
 */

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
        return new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.15,
            roughness: 0.4,
            metalness: 0.3
        });
    }

    setBoxUV(geometry, uvsMap, texW = 64, texH = 32) {
        const uvAttr = geometry.attributes.uv;
        if (!uvAttr) return;
        const uvs = uvAttr.array;

        // Порядок граней BoxGeometry: 0: East(+X), 1: West(-X), 2: Up(+Y), 3: Down(-Y), 4: South(+Z), 5: North(-Z)
        const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];

        faceOrder.forEach((faceName, idx) => {
            const data = uvsMap[faceName];
            if (data) {
                const [u, v, uw, uh] = data;
                const u0 = u / texW;
                const v0 = 1.0 - (v + uh) / texH;
                const u1 = (u + uw) / texW;
                const v1 = 1.0 - v / texH;

                const base = idx * 8;
                uvs[base + 0] = u0; uvs[base + 1] = v1;
                uvs[base + 2] = u1; uvs[base + 3] = v1;
                uvs[base + 4] = u0; uvs[base + 5] = v0;
                uvs[base + 6] = u1; uvs[base + 7] = v0;
            }
        });

        uvAttr.needsUpdate = true;
    }

    // ── 🪖 ШЛЕМ ──
    buildHelmet(textureUrl, options = {}) {
        const group = new THREE.Group();
        group.name = `ARMOR_HELMET_${options.id || 'custom'}`;
        const mat = this.createMaterial(textureUrl);

        // Основной шлем (точно поверх головы headMesh y=4)
        const helmGeo = new THREE.BoxGeometry(8.9, 8.9, 8.9);
        this.setBoxUV(helmGeo, {
            east: [0, 8, 8, 8],
            south: [8, 8, 8, 8],
            west: [16, 8, 8, 8],
            north: [24, 8, 8, 8],
            up: [8, 0, 8, 8],
            down: [16, 0, 8, 8]
        });

        const helmMesh = new THREE.Mesh(helmGeo, mat);
        helmMesh.position.set(0, 4.0, 0);
        group.add(helmMesh);

        // Внешний слой налобника / забрала (Overlay)
        const overlayGeo = new THREE.BoxGeometry(9.4, 9.4, 9.4);
        this.setBoxUV(overlayGeo, {
            east: [32, 8, 8, 8],
            south: [40, 8, 8, 8],
            west: [48, 8, 8, 8],
            north: [56, 8, 8, 8],
            up: [40, 0, 8, 8],
            down: [48, 0, 8, 8]
        });

        const overlayMesh = new THREE.Mesh(overlayGeo, mat);
        overlayMesh.position.set(0, 4.0, 0);
        group.add(overlayMesh);

        // Дополнительные 3D рога для Cataclysm Игнития / Левиафана
        if (options.hasHorns) {
            const hornGeo = new THREE.ConeGeometry(1.0, 4.2, 4);
            const hornMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3, metalness: 0.6 });

            const hornL = new THREE.Mesh(hornGeo, hornMat);
            hornL.rotation.set(-0.2, 0, -0.5);
            hornL.position.set(-4.5, 8.2, -0.5);
            group.add(hornL);

            const hornR = new THREE.Mesh(hornGeo, hornMat);
            hornR.rotation.set(-0.2, 0, 0.5);
            hornR.position.set(4.5, 8.2, -0.5);
            group.add(hornR);
        }

        return group;
    }

    // ── 🎽 НАГРУДНИК ──
    buildChestplate(textureUrl, skin, options = {}) {
        const group = new THREE.Group();
        group.name = `ARMOR_CHEST_${options.id || 'custom'}`;
        const mat = this.createMaterial(textureUrl);

        // Торс нагрудника (поверх bodyMesh y=0 в skin.body)
        const bodyGeo = new THREE.BoxGeometry(8.9, 12.5, 4.8);
        this.setBoxUV(bodyGeo, {
            east: [16, 20, 4, 12],
            south: [20, 20, 8, 12],
            west: [28, 20, 4, 12],
            north: [32, 20, 8, 12],
            up: [20, 16, 8, 4],
            down: [28, 16, 8, 4]
        });

        const bodyMesh = new THREE.Mesh(bodyGeo, mat);
        bodyMesh.position.set(0, 0, 0);
        group.add(bodyMesh);

        // Наплечники: в skinview3d rightArmPivot x=-1, y=-4; leftArmPivot x=1, y=-4
        const pauldronGeo = new THREE.BoxGeometry(4.8, 12.5, 4.8);
        this.setBoxUV(pauldronGeo, {
            east: [40, 20, 4, 12],
            south: [44, 20, 4, 12],
            west: [48, 20, 4, 12],
            north: [52, 20, 4, 12],
            up: [44, 16, 4, 4],
            down: [48, 16, 4, 4]
        });

        if (skin.rightArm) {
            const pauldronR = new THREE.Mesh(pauldronGeo, mat);
            pauldronR.name = `ARMOR_PAULDRON_R_${options.id || 'custom'}`;
            pauldronR.position.set(-1.0, -4.0, 0);
            skin.rightArm.add(pauldronR);
        }

        if (skin.leftArm) {
            const pauldronL = new THREE.Mesh(pauldronGeo, mat);
            pauldronL.name = `ARMOR_PAULDRON_L_${options.id || 'custom'}`;
            pauldronL.position.set(1.0, -4.0, 0);
            skin.leftArm.add(pauldronL);
        }

        return group;
    }

    // ── 👖 ПОНОЖИ (Layer 2) ──
    buildLeggings(textureUrl, skin, options = {}) {
        const mat = this.createMaterial(textureUrl);

        // Пояс на торсе
        if (skin.body) {
            const beltGeo = new THREE.BoxGeometry(8.6, 4.8, 4.6);
            this.setBoxUV(beltGeo, {
                east: [16, 20, 4, 6],
                south: [20, 20, 8, 6],
                west: [28, 20, 4, 6],
                north: [32, 20, 8, 6],
                up: [20, 16, 8, 4],
                down: [28, 16, 8, 4]
            });
            const beltMesh = new THREE.Mesh(beltGeo, mat);
            beltMesh.name = `ARMOR_BELT_${options.id || 'custom'}`;
            beltMesh.position.set(0, -3.8, 0);
            skin.body.add(beltMesh);
        }

        // Штанины: в skinview3d rightLegPivot y=-6, leftLegPivot y=-6
        const legGeo = new THREE.BoxGeometry(4.6, 12.2, 4.6);
        this.setBoxUV(legGeo, {
            east: [0, 20, 4, 12],
            south: [4, 20, 4, 12],
            west: [8, 20, 4, 12],
            north: [12, 20, 4, 12],
            up: [4, 16, 4, 4],
            down: [8, 16, 4, 4]
        });

        if (skin.rightLeg) {
            const legR = new THREE.Mesh(legGeo, mat);
            legR.name = `ARMOR_LEGS_R_${options.id || 'custom'}`;
            legR.position.set(0, -6.0, 0);
            skin.rightLeg.add(legR);
        }

        if (skin.leftLeg) {
            const legL = new THREE.Mesh(legGeo, mat);
            legL.name = `ARMOR_LEGS_L_${options.id || 'custom'}`;
            legL.position.set(0, -6.0, 0);
            skin.leftLeg.add(legL);
        }
    }

    // ── 👢 БОТИНКИ (Layer 1) ──
    buildBoots(textureUrl, skin, options = {}) {
        const mat = this.createMaterial(textureUrl);

        // Ботинки на нижнюю часть ног (y=-9.5)
        const bootGeo = new THREE.BoxGeometry(4.8, 5.2, 4.8);
        this.setBoxUV(bootGeo, {
            east: [0, 26, 4, 6],
            south: [4, 26, 4, 6],
            west: [8, 26, 4, 6],
            north: [12, 26, 4, 6],
            up: [4, 16, 4, 4],
            down: [8, 16, 4, 4]
        });

        if (skin.rightLeg) {
            const bootR = new THREE.Mesh(bootGeo, mat);
            bootR.name = `ARMOR_BOOTS_R_${options.id || 'custom'}`;
            bootR.position.set(0, -9.5, 0);
            skin.rightLeg.add(bootR);
        }

        if (skin.leftLeg) {
            const bootL = new THREE.Mesh(bootGeo, mat);
            bootL.name = `ARMOR_BOOTS_L_${options.id || 'custom'}`;
            bootL.position.set(0, -9.5, 0);
            skin.leftLeg.add(bootL);
        }
    }
}

export const armorMeshBuilder = new ArmorMeshBuilder();
