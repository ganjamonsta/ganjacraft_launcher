/**
 * Ganj4Craft Launcher - Sakura Preset (Весна)
 * Векторные лепестки сакуры без эмодзи
 */

export const sakuraPreset = {
    id: 'sakura',
    name: 'Весна (Сакура)',
    symbols: ['🌸'], // Для burst откликов

    maxParticles: { low: 25, medium: 55, high: 90 },

    createParticle(width, height) {
        const isPetal = Math.random() > 0.25;
        const size = isPetal ? Math.random() * 8 + 6 : Math.random() * 2.5 + 1.5;
        
        // Palette: Soft Rose, Magenta Pink, White Rose
        const colors = [
            'rgba(255, 183, 197, ',
            'rgba(255, 154, 180, ',
            'rgba(248, 200, 220, '
        ];

        return {
            x: Math.random() * width,
            y: Math.random() * height - height,
            size: size,
            isPetal: isPetal,
            speedY: isPetal ? Math.random() * 1.3 + 0.6 : Math.random() * 0.8 + 0.3,
            speedX: Math.random() * 0.9 + 0.3, // Mild breeze right
            swaySpeed: Math.random() * 0.03 + 0.01,
            swayAmp: Math.random() * 2.5 + 0.5,
            angle: Math.random() * Math.PI * 2,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.04,
            flipSpeed: Math.random() * 0.03 + 0.01,
            flipAngle: Math.random() * Math.PI * 2,
            opacity: Math.random() * 0.4 + 0.5,
            colorBase: colors[Math.floor(Math.random() * colors.length)]
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
        if (p.x > width + 30) p.x = -30;
    },

    drawParticle(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);

        if (p.isPetal) {
            ctx.rotate(p.rotation);
            // 3D flip effect using scale
            const scaleY = Math.cos(p.flipAngle);
            ctx.scale(1, scaleY);

            const s = p.size;
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.bezierCurveTo(s * 0.8, -s * 0.6, s * 0.9, s * 0.4, 0, s);
            ctx.bezierCurveTo(-s * 0.9, s * 0.4, -s * 0.8, -s * 0.6, 0, -s);

            ctx.fillStyle = `${p.colorBase}${p.opacity})`;
            ctx.fill();

            // Highlight line in center of petal
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.7);
            ctx.lineTo(0, s * 0.7);
            ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity * 0.4})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            // Floating pollen glowing orb
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 220, 235, ${p.opacity})`;
            ctx.shadowColor = '#ffb3c1';
            ctx.shadowBlur = 6;
            ctx.fill();
        }

        ctx.restore();
    }
};
