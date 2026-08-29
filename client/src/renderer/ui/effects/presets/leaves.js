/**
 * Ganj4Craft Launcher - Leaves Preset (Осень)
 * Векторный реалистичный листопад без эмодзи
 */

export const leavesPreset = {
    id: 'leaves',
    name: 'Осень (Листопад)',
    symbols: ['🍂'], // Для burst откликов

    maxParticles: { low: 20, medium: 45, high: 75 },

    createParticle(width, height) {
        // Vibrant Autumn Color Palette
        const palette = [
            'rgba(230, 92, 45, ',   // Crimson Orange
            'rgba(217, 131, 37, ',  // Amber Gold
            'rgba(192, 57, 43, ',   // Deep Autumn Red
            'rgba(241, 196, 15, ',  // Golden Yellow
            'rgba(160, 64, 0, '     // Chestnut Brown
        ];

        const leafType = Math.floor(Math.random() * 3); // 0: Maple, 1: Oak/Birch, 2: Oval Leaf

        return {
            x: Math.random() * width,
            y: Math.random() * height - height,
            size: Math.random() * 8 + 8,
            leafType: leafType,
            speedY: Math.random() * 1.6 + 0.9,
            speedX: Math.random() * 1.2 - 0.4,
            swaySpeed: Math.random() * 0.035 + 0.015,
            swayAmp: Math.random() * 3.5 + 1.0,
            angle: Math.random() * Math.PI * 2,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.04,
            flipAngle: Math.random() * Math.PI * 2,
            flipSpeed: Math.random() * 0.03 + 0.01,
            opacity: Math.random() * 0.35 + 0.65,
            colorBase: palette[Math.floor(Math.random() * palette.length)]
        };
    },

    updateParticle(p, width, height, dt, mousePos) {
        p.y += p.speedY;
        p.angle += p.swaySpeed;
        p.x += Math.sin(p.angle) * p.swayAmp + p.speedX;
        p.rotation += p.rotSpeed;
        p.flipAngle += p.flipSpeed;

        if (p.y > height + 30) {
            p.y = -30;
            p.x = Math.random() * width;
        }
        if (p.x < -30) p.x = width + 30;
        if (p.x > width + 30) p.x = -30;
    },

    drawParticle(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // 3D swaying flip effect
        const scaleX = Math.cos(p.flipAngle);
        ctx.scale(scaleX, 1);

        const s = p.size;
        ctx.fillStyle = `${p.colorBase}${p.opacity})`;

        if (p.leafType === 0) {
            // Maple Leaf (5 lobes)
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.2);
            ctx.lineTo(s * 0.3, -s * 0.5);
            ctx.lineTo(s * 1.1, -s * 0.7);
            ctx.lineTo(s * 0.6, 0);
            ctx.lineTo(s * 0.8, s * 0.8);
            ctx.lineTo(s * 0.2, s * 0.4);
            ctx.lineTo(0, s * 1.1); // Stem
            ctx.lineTo(-s * 0.2, s * 0.4);
            ctx.lineTo(-s * 0.8, s * 0.8);
            ctx.lineTo(-s * 0.6, 0);
            ctx.lineTo(-s * 1.1, -s * 0.7);
            ctx.lineTo(-s * 0.3, -s * 0.5);
            ctx.closePath();
            ctx.fill();
        } else if (p.leafType === 1) {
            // Birch/Beech Leaf (Teardrop serrated)
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.1);
            ctx.bezierCurveTo(s * 0.9, -s * 0.5, s * 0.9, s * 0.5, 0, s);
            ctx.bezierCurveTo(-s * 0.9, s * 0.5, -s * 0.9, -s * 0.5, 0, -s * 1.1);
            ctx.fill();

            // Leaf Stem & Veins
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.9);
            ctx.lineTo(0, s * 1.1);
            ctx.strokeStyle = `rgba(0, 0, 0, ${p.opacity * 0.25})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            // Oval Leaf
            ctx.beginPath();
            ctx.ellipse(0, 0, s * 0.55, s * 1.0, 0, 0, Math.PI * 2);
            ctx.fill();

            // Center vein
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.9);
            ctx.lineTo(0, s * 1.1);
            ctx.strokeStyle = `rgba(0, 0, 0, ${p.opacity * 0.3})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    }
};
