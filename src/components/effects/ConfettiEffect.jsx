import { useEffect, useRef } from "react";

const COLORS = [
  "#6382e6", "#e05c8a", "#f0c040", "#40c97a",
  "#a78bfa", "#38bdf8", "#fb923c", "#f472b6",
  "#34d399", "#fbbf24", "#ffffff"
];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function ConfettiEffect({ active, onDone }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create 200 particles from the top
    particlesRef.current = Array.from({ length: 200 }, () => ({
      x: randomBetween(0, canvas.width),
      y: randomBetween(-120, -10),
      w: randomBetween(8, 16),
      h: randomBetween(4, 10),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: randomBetween(-3, 3),
      vy: randomBetween(3, 9),
      rotation: randomBetween(0, 360),
      rotationSpeed: randomBetween(-5, 5),
      opacity: 1,
      wobble: randomBetween(0, Math.PI * 2),
      wobbleSpeed: randomBetween(0.03, 0.09),
    }));

    let startTime = null;
    const DURATION = 3500; // ms

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((p) => {
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 1.5;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, 1 - (elapsed / DURATION) * 1.4);

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (elapsed < DURATION) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (onDone) onDone();
      }
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active, onDone]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}

export default ConfettiEffect;
