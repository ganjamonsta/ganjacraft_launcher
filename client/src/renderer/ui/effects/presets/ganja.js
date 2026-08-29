/**
 * Ganj4Craft Launcher - Ganja Special Preset (Фирменный Стиль)
 * Векторные стилизованные неоновые каннабис-листики и яркие искорки без эмодзи
 */

export const ganjaPreset = {
    id: 'ganja',
    name: 'Ganja Special 🌿',
    symbols: ['🌿'], // Для burst откликов

    maxParticles: { low: 25, medium: 55, high: 85 },

    createParticle(width, height) {
        const isLeaf = Math.random() > 0.4;
        const size = isLeaf ? Math.random() * 8 + 8 : Math.random() * 3 + 1.5;

        return {
            x: Math.random() * width,
            y: Math.random() * height - height,
            size: size,
            isLeaf: isLeaf,
            speedY: Math.random() * 1.5 + 0.8,
            speedX: Math.random() * 0.8 - 0.4,
            swaySpeed: Math.random() * 0.03 + 0.015,
            swayAmp: Math.random() * 2.8 + 0.8,
            angle: Math.random() * Math.PI * 2,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.035,
            flipAngle: Math.random() * Math.PI * 2,
            flipSpeed: Math.random() * 0.03 + 0.01,
            opacity: Math.random() * 0.4 + 0.5,
            color: Math.random() > 0.3 ? '#2ecc71' : '#27ae60', // Emerald Neon Green
            glowColor: '#2ecc71'
        };
    },

    updateParticle(p, width, height, dt, mousePos) {
        p.y += p.speedY;
        p.angle += p.swaySpeed;
        p.x += Math.sin(p.angle) * p.swayAmp + p.speedX;
        p.rotation += p.rotSpeed;
        p.flipAngle += p.flipSpeed;

        if (p.y > height + 25) {
            p.y = -25;
            p.x = Math.random() * width;
        }
        if (p.x < -25) p.x = width + 25;
        if (p.x > width + 25) p.x = -25;
    },

    drawParticle(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);

        if (p.isLeaf) {
            ctx.rotate(p.rotation);
            const scaleX = Math.cos(p.flipAngle);
            ctx.scale(scaleX, 1);

            const s = p.size;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.glowColor;
            ctx.shadowBlur = 10;
            ctx.globalAlpha = p.opacity;

            // Draw 5-Point Leaf
            ctx.beginPath();
            // Center blade
            ctx.moveTo(0, -s * 1.3);
            ctx.bezierCurveTo(s * 0.3, -s * 0.6, s * 0.3, -s * 0.2, 0, 0);
            ctx.bezierCurveTo(-s * 0.3, -s * 0.2, -s * 0.3, -s * 0.6, 0, -s * 1.3);

            // Left top blade
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-s * 0.8, -s * 0.9, -s * 0.9, -s * 0.3, 0, 0);

            // Right top blade
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(s * 0.8, -s * 0.9, s * 0.9, -s * 0.3, 0, 0);

            // Left bottom blade
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.7, s * 0.4, 0, 0);

            // Right bottom blade
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.7, s * 0.4, 0, 0);

            ctx.fill();

            // Center stem line
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.1);
            ctx.lineTo(0, s * 0.4);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();

        } else {
            // Neon glowing spark orb
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.glowColor;
            ctx.shadowBlur = 12;
            ctx.globalAlpha = p.opacity;
            ctx.fill();
        }

        ctx.restore();
    }
};
