import * as THREE from 'three';

/**
 * Procedural Joint Pose & Animation Engine for BedrockPlayerRig
 * 
 * Управляет анатомически реалистичными сгибами локтей и коленей,
 * тактическими боевыми стойками для любого оружия TACZ/GeckoLib,
 * процедурным дыханием и слежением за курсором.
 */

export class PoseAnimator {
    constructor() {
        this.currentPose = 'idle';
    }

    /**
     * Обновление позы и суставов скелета
     * @param {BedrockPlayerRig} rig 
     * @param {string} weaponId 
     * @param {number} t Time/progress
     * @param {object} cursor { headX, headY, bodyY }
     */
    update(rig, weaponId, t, cursor = { headX: 0, headY: 0, bodyY: 0.38 }) {
        if (!rig || !rig.bones) return;

        const breath = Math.sin(t * 0.8) * 0.018;
        const breathSlow = Math.sin(t * 0.4) * 0.012;

        // 1. Поворот торса и головы (слежение за курсором)
        if (rig.bones.torso) {
            rig.bones.torso.rotation.y = cursor.bodyY + breathSlow * 0.5;
            rig.bones.torso.position.y = breath * 0.5;
        }

        if (rig.bones.head) {
            rig.bones.head.rotation.y = cursor.headY + Math.sin(t * 0.5) * 0.03;
            rig.bones.head.rotation.x = cursor.headX + Math.sin(t * 0.3) * 0.02;
        }

        // 2. Ноги (устойчивая боевая стойка)
        if (rig.bones.rightUpperLeg && rig.bones.leftUpperLeg) {
            rig.bones.rightUpperLeg.rotation.set(0.04, -0.05, 0.04);
            rig.bones.rightKnee.rotation.set(-0.08, 0, 0); // Легкий сгиб в колене

            rig.bones.leftUpperLeg.rotation.set(-0.04, 0.05, -0.04);
            rig.bones.leftKnee.rotation.set(-0.06, 0, 0);
        }

        // 3. Руки и тактические позы в зависимости от типа оружия
        const hasWeapon = weaponId && weaponId !== 'none';

        if (weaponId === 'tacz_minigun') {
            // ── ТЯЖЕЛЫЙ МИНИГАН M134 (ХВАТ ОТ БЕДРА + ВЕРХНЯЯ РУКОЯТЬ) ──
            // Правая рука на задней гашетке
            rig.bones.rightShoulder.rotation.set(-0.35 + breath, -0.12, 0.08);
            rig.bones.rightElbow.rotation.set(-0.48, 0, 0); // Согнутый локоть

            // Левая рука держит верхнюю ручку
            rig.bones.leftShoulder.rotation.set(-0.62 + breath, 0.48, -0.18);
            rig.bones.leftElbow.rotation.set(-0.75, 0.22, 0);

        } else if (weaponId === 'tacz_rpg7') {
            // ── РПГ-7 НА ПЛЕЧЕ ──
            rig.bones.rightShoulder.rotation.set(-1.18 + breath, -0.18, 0.10);
            rig.bones.rightElbow.rotation.set(-0.32, 0, 0);

            rig.bones.leftShoulder.rotation.set(-0.82 + breath, 0.52, -0.15);
            rig.bones.leftElbow.rotation.set(-0.65, 0.15, 0);

        } else if (weaponId === 'tacz_glock17' || weaponId === 'tacz_deagle') {
            // ── ТАКТИЧЕСКИЙ ДВУРУЧНЫЙ ХВАТ ПИСТОЛЕТА ──
            rig.bones.rightShoulder.rotation.set(-1.05 + breath, -0.06, 0.04);
            rig.bones.rightElbow.rotation.set(-0.38, 0, 0);

            rig.bones.leftShoulder.rotation.set(-1.02 + breath, 0.32, -0.06);
            rig.bones.leftElbow.rotation.set(-0.45, 0.10, 0);

        } else if (hasWeapon) {
            // ── ВИНТОВКИ / АВТОМАТЫ / СНАЙПЕРКИ (АК-47, AWP, VECTOR, SPAS-12) ──
            // Правая рука: приклад у плеча, локоть согнут на ~55°
            rig.bones.rightShoulder.rotation.set(-0.68 + breath, -0.22, 0.10);
            rig.bones.rightElbow.rotation.set(-0.85, 0, 0); // Идеальный анатомический сгиб локтя

            // Левая рука: тянется поперек груди к цевью, локоть согнут на ~68°
            rig.bones.leftShoulder.rotation.set(-0.48 + breath, 0.62, -0.16);
            rig.bones.leftElbow.rotation.set(-1.05, 0.32, -0.10);

        } else {
            // ── СВОБОДНЫЙ IDLE РЕЖИМ ──
            rig.bones.rightShoulder.rotation.set(Math.sin(t * 0.6) * 0.05, 0, 0.04);
            rig.bones.rightElbow.rotation.set(-0.10, 0, 0);

            rig.bones.leftShoulder.rotation.set(-Math.sin(t * 0.6) * 0.05, 0, -0.04);
            rig.bones.leftElbow.rotation.set(-0.10, 0, 0);
        }
    }
}

export const poseAnimator = new PoseAnimator();
