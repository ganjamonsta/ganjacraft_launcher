/**
 * GanjaCraft Launcher - Fireflies Preset (Лето - Неоновые Светлячки)
 * Векторные светящиеся частицы без использования эмодзи
 */

export const firefliesPreset = {
    id: 'fireflies',
    name: 'Лето (Светлячки)',
    symbols: ['✨'], // Для burst откликов

    maxParticles: { low: 25, medium: 50, high: 80 },

    createParticle(width, height) {
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 3 + 2,
            vx: (Math.random() - 0.5) * 0.7,
            vy: (Math.random() - 0.5) * 0.7,
            pulseSpeed: Math.random() * 0.04 + 0.02,
            pulseAngle: Math.random() * Math.PI * 2,
            baseOpacity: Math.random() * 0.5 + 0.4,
            opacity: 0.5,
            // Warm Gold / Emerald Light
            isGold: Math.random() > 0.4
        };
    },

    updateParticle(p, width, height, dt, mousePos) {
        p.x += p.vx;
        p.y += p.vy;
        
        p.pulseAngle += p.pulseSpeed;
        p.opacity = p.baseOpacity + Math.sin(p.pulseAngle) * 0.35;
        if (p.opacity < 0.1) p.opacity = 0.1;
        if (p.opacity > 1) p.opacity = 1;

        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
    },

    drawParticle(ctx, p) {
        ctx.save();
        
        const outerRadius = p.radius * 5;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, outerRadius);

        if (p.isGold) {
            grad.addColorStop(0, `rgba(255, 240, 150, ${p.opacity})`);
            grad.addColorStop(0.3, `rgba(240, 190, 60, ${p.opacity * 0.6})`);
            grad.addColorStop(1, 'rgba(240, 190, 60, 0)');
        } else {
            grad.addColorStop(0, `rgba(180, 255, 170, ${p.opacity})`);
            grad.addColorStop(0.3, `rgba(76, 217, 100, ${p.opacity * 0.6})`);
            grad.addColorStop(1, 'rgba(76, 217, 100, 0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, outerRadius, 0, Math.PI * 2);
        ctx.fill();

        // Core bright center
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();

        ctx.restore();
    }
};
