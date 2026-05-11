import React, { useEffect, useRef } from 'react';

const ParticleBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width, height;
    let particles = [];
    const particleCount = 2000; 
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2, targetX: window.innerWidth / 2, targetY: window.innerHeight / 2 };
    
    // Config tuned for "Clumped Orb/Nebula" look
    const config = {
      speed: 0.8,
      dieSpeed: 0.005,
      radius: 1.5,
      curlSize: 0.02,
      attraction: 0.5,
      baseColor: '#00a9bc',
      backgroundColor: '#1E232F'
    };

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    class Particle {
      constructor() {
        this.init(true);
      }

      init(firstTime = false) {
        if (firstTime) {
          this.x = Math.random() * width;
          this.y = Math.random() * height;
        } else {
          // Respawn near the center to keep the "cloud" density
          this.x = center.x + (Math.random() - 0.5) * 50;
          this.y = center.y + (Math.random() - 0.5) * 50;
        }
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.life = 0.5 + Math.random() * 0.5;
        this.friction = 0.94;
      }

      update() {
        // Strong attraction to center
        const dx = center.x - this.x;
        const dy = center.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Attraction force increases with distance to keep them clumped
        const force = dist * 0.02 * config.attraction;
        this.vx += (dx / dist) * force;
        this.vy += (dy / dist) * force;

        // Curl/Turbulence
        this.vx += Math.sin(this.y * config.curlSize) * config.speed;
        this.vy += Math.cos(this.x * config.curlSize) * config.speed;
        
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        this.x += this.vx;
        this.y += this.vy;

        this.life -= config.dieSpeed;
        if (this.life <= 0) {
          this.init();
        }
      }

      draw() {
        ctx.fillStyle = config.baseColor;
        // Increase alpha for the "core" of the cloud
        ctx.globalAlpha = this.life * 0.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, config.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const init = () => {
      resize();
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    // Snail-like movement for the entire cloud
    let angle = 0;
    const updateCenter = () => {
      angle += 0.002;
      // Winding path
      center.targetX = (width / 2) + Math.cos(angle) * (width * 0.3) + Math.sin(angle * 2) * 100;
      center.targetY = (height / 2) + Math.sin(angle * 1.5) * (height * 0.25);
    };

    const animate = () => {
      updateCenter();
      center.x += (center.targetX - center.x) * 0.05;
      center.y += (center.targetY - center.y) * 0.05;

      // Dark fade for trails
      ctx.fillStyle = config.backgroundColor;
      ctx.globalAlpha = 0.18; 
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      ctx.globalCompositeOperation = 'lighter';
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      ctx.globalCompositeOperation = 'source-over';

      animationFrameId = requestAnimationFrame(animate);
    };

    init();
    animate();

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        background: '#1E232F'
      }}
    />
  );
};

export default ParticleBackground;
