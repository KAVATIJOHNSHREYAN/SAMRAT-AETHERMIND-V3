'use client';

import React, { useRef, useEffect } from 'react';

interface VortexVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
}

export const VortexVisualizer: React.FC<VortexVisualizerProps> = ({ isListening, isSpeaking }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = 320);
    let height = (canvas.height = 320);

    // Track resize
    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.width = canvas.parentElement?.clientWidth || 320;
        height = canvas.height = canvas.parentElement?.clientHeight || 320;
      }
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Particle class
    class Particle {
      angle: number;
      radius: number;
      speed: number;
      color: string;
      size: number;
      baseRadius: number;

      constructor() {
        this.angle = Math.random() * Math.PI * 2;
        this.baseRadius = 40 + Math.random() * 80;
        this.radius = this.baseRadius;
        this.speed = 0.01 + Math.random() * 0.015;
        this.size = 1 + Math.random() * 1.8;

        // Dynamic colors: neon pinks, purples, cyans
        const colors = [
          'rgba(236, 72, 153, 0.75)', // pink
          'rgba(139, 92, 246, 0.75)', // violet
          'rgba(6, 182, 212, 0.75)',  // cyan
          'rgba(99, 102, 241, 0.75)'  // indigo
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update(time: number, multiplier: number) {
        // Spiral motion around the center
        this.angle += this.speed * multiplier;

        // Wave modulation
        const wave = Math.sin(this.angle * 3 + time * 0.005) * 12 * multiplier;
        this.radius = this.baseRadius + wave;
      }

      draw(c: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const x = centerX + Math.cos(this.angle) * this.radius;
        const y = centerY + Math.sin(this.angle) * this.radius;

        c.beginPath();
        c.arc(x, y, this.size, 0, Math.PI * 2);
        c.fillStyle = this.color;

        // Add subtle neon shadows
        c.shadowColor = this.color;
        c.shadowBlur = 8;

        c.fill();
        c.shadowBlur = 0; // reset
      }
    }

    const particles: Particle[] = Array.from({ length: 180 }, () => new Particle());
    let time = 0;

    const render = () => {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.08)'; // trails effect
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Pulse multiplier based on audio activity
      let multiplier = 1.0;
      if (isListening) {
        multiplier = 2.0 + Math.sin(time * 0.05) * 0.4;
      } else if (isSpeaking) {
        multiplier = 1.6 + Math.cos(time * 0.08) * 0.3;
      }

      // Draw center core
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 5,
        centerX, centerY, 60 * multiplier
      );
      gradient.addColorStop(0, 'rgba(124, 58, 237, 0.25)'); // purple core
      gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)'); // cyan outer
      gradient.addColorStop(1, 'rgba(9, 13, 22, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, 70 * multiplier, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Render and update particles
      particles.forEach((p) => {
        p.update(time, multiplier);
        p.draw(ctx, centerX, centerY);
      });

      time += 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [isListening, isSpeaking]);

  return (
    <div className="w-80 h-80 relative rounded-full flex items-center justify-center overflow-hidden border border-slate-800/40 bg-slate-950/40 backdrop-blur-md shadow-2xl">
      <div className="absolute inset-0 bg-radial-gradient from-violet-900/10 via-transparent to-transparent"></div>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

