/**
 * Ganj4Craft Launcher - Snow Preset (Зима)
 * Кристаллический снег и мягкая снежная пыль
 */

export const snowPreset = {
    id: 'snow',
    name: 'Зима (Снежинки)',
    symbols: ['❄', '❅', '❆'],
    
    maxParticles: { low: 25, medium: 55, high: 90 },

    createParticle(width, height) {
        const isCrystal = Math.random() > 0.4;
        const symbol = this.symbols[Math.floor(Math.random() * this.symbols.length)];
        return {
            x: Math.random() * width,
            y: Math.random() * height - height,
            size: isCrystal ? Math.random() * 10 + 8 : Math.random() * 2.5 + 1.5,
            isCrystal: isCrystal,
            speedY: Math.random() * 1.5 + 0.8,
            speedX: Math.random() * 0.6 - 0.3,
            swaySpeed: Math.random() * 0.02 + 0.01,
            swayAmp: Math.random() * 2 + 0.5,
            angle: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.02,
            rotation: Math.random() * Math.PI * 2,
            opacity: Math.random() * 0.6 + 0.3,
            symbol: symbol,
            color: `rgba(235, 245, 255, ${Math.random() * 0.3 + 0.7})`
        };
    },

    updateParticle(p, width, height, dt, mousePos) {
        p.y += p.speedY;
        p.angle += p.swaySpeed;
        p.x += Math.sin(p.angle) * p.swayAmp * 0.3 + p.speedX;
        p.rotation += p.rotSpeed;

        if (p.y > height + 20) {
            p.y = -20;
            p.x = Math.random() * width;
        }
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
    },

    drawParticle(ctx, p) {
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);

        if (p.isCrystal) {
            ctx.rotate(p.rotation);
            ctx.font = `${p.size}px sans-serif`;
            ctx.fillStyle = p.color;
            ctx.shadowColor = '#80d4ff';
            ctx.shadowBlur = 4;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.symbol, 0, 0);
        } else {
            // Soft snow dust orb
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#b3e5fc';
            ctx.shadowBlur = 6;
            ctx.fill();
        }
        
        ctx.restore();
    }
};
