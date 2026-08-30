import * as THREE from 'three';

/**
 * BackpackMeshBuilder
 * Строит детальную 3D модель Sophisticated Backpacks с оригинальными текстурами мода:
 * - backpack_cloth.png
 * - backpack_border.png
 * - netherite_clips.png / diamond_clips.png / gold_clips.png / leather_clips.png
 */

class BackpackMeshBuilder {
    constructor() {
        this.textureCache = new Map();
        this.loader = new THREE.TextureLoader();
    }

    loadTexture(url) {
        if (this.textureCache.has(url)) return this.textureCache.get(url);
        const tex = this.loader.load(url);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        this.textureCache.set(url, tex);
        return tex;
    }

    buildBackpack(item = {}) {
        const group = new THREE.Group();
        group.name = `EQ_BACK_${item.id || 'backpack'}`;

        const clothTex = this.loadTexture('assets/equipment/backpacks/backpack_cloth.png');
        const borderTex = this.loadTexture('assets/equipment/backpacks/backpack_border.png');
        
        let clipsTexUrl = 'assets/equipment/backpacks/leather_clips.png';
        let tierColor = 0x854d0e; // Leather / Bronze

        if (item.id && item.id.includes('netherite')) {
            clipsTexUrl = 'assets/equipment/backpacks/netherite_clips.png';
            tierColor = 0x312e38;
        } else if (item.id && item.id.includes('diamond')) {
            clipsTexUrl = 'assets/equipment/backpacks/diamond_clips.png';
            tierColor = 0x164e63;
        } else if (item.id && item.id.includes('gold')) {
            clipsTexUrl = 'assets/equipment/backpacks/gold_clips.png';
            tierColor = 0xb45309;
        }

        const clipsTex = this.loadTexture(clipsTexUrl);

        // Материалы
        const clothMat = new THREE.MeshStandardMaterial({
            map: clothTex,
            color: new THREE.Color(item.color || tierColor),
            roughness: 0.8
        });

        const borderMat = new THREE.MeshStandardMaterial({
            map: borderTex,
            roughness: 0.6
        });

        const clipsMat = new THREE.MeshStandardMaterial({
            map: clipsTex,
            metalness: 0.6,
            roughness: 0.3
        });

        // 1. Основной корпус рюкзака (Body)
        const bodyGeo = new THREE.BoxGeometry(8.6, 11.2, 5.2);
        const bodyMesh = new THREE.Mesh(bodyGeo, clothMat);
        bodyMesh.position.set(0, 0, -2.6);
        group.add(bodyMesh);

        // 2. Рамка и отделка (Border)
        const borderGeo = new THREE.BoxGeometry(8.9, 11.4, 5.4);
        const borderMesh = new THREE.Mesh(borderGeo, borderMat);
        borderMesh.position.set(0, 0, -2.6);
        group.add(borderMesh);

        // 3. Верхний клапан (Top Flap)
        const flapGeo = new THREE.BoxGeometry(9.0, 3.2, 5.6);
        const flapMesh = new THREE.Mesh(flapGeo, clothMat);
        flapMesh.position.set(0, 4.2, -2.6);
        group.add(flapMesh);

        // 4. Верхняя ручка (Handle)
        const handleGeo = new THREE.BoxGeometry(4.2, 1.4, 1.2);
        const handleMesh = new THREE.Mesh(handleGeo, clipsMat);
        handleMesh.position.set(0, 6.2, -2.6);
        group.add(handleMesh);

        // 5. Передний карман (Front Pouch)
        const pouchGeo = new THREE.BoxGeometry(6.8, 5.8, 2.0);
        const pouchMesh = new THREE.Mesh(pouchGeo, clothMat);
        pouchMesh.position.set(0, -2.4, -6.0);
        group.add(pouchMesh);

        // 6. Замки и пряжки (Buckles / Clips)
        const buckleGeoL = new THREE.BoxGeometry(1.2, 2.8, 0.6);
        const buckleL = new THREE.Mesh(buckleGeoL, clipsMat);
        buckleL.position.set(-2.2, 2.0, -5.6);
        group.add(buckleL);

        const buckleR = new THREE.Mesh(buckleGeoL, clipsMat);
        buckleR.position.set(2.2, 2.0, -5.6);
        group.add(buckleR);

        // 7. Боковые карманы (Side Pouches)
        const sidePouchGeo = new THREE.BoxGeometry(1.8, 6.4, 3.8);
        const sidePouchL = new THREE.Mesh(sidePouchGeo, clothMat);
        sidePouchL.position.set(-5.0, -2.2, -2.6);
        group.add(sidePouchL);

        const sidePouchR = new THREE.Mesh(sidePouchGeo, clothMat);
        sidePouchR.position.set(5.0, -2.2, -2.6);
        group.add(sidePouchR);

        // 8. Лямки через плечи (Shoulder Straps)
        const strapGeo = new THREE.BoxGeometry(1.4, 12.0, 5.2);
        const strapL = new THREE.Mesh(strapGeo, clipsMat);
        strapL.position.set(-2.8, 0, 0.4);
        group.add(strapL);

        const strapR = new THREE.Mesh(strapGeo, clipsMat);
        strapR.position.set(2.8, 0, 0.4);
        group.add(strapR);

        return group;
    }
}

export const backpackMeshBuilder = new BackpackMeshBuilder();
