import React from "react";

/**
 * Fixed backdrop: the owner's landscape photo (public/bg-home.jpg), lightly
 * blurred and darkened with a slow zoom, a vignette and a faint lime glow so
 * the glass UI stays readable over it.
 */
export const Backdrop: React.FC = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#121316]">
    <div
      className="kenburns absolute -inset-[6%] bg-cover bg-[position:68%_center] sm:bg-center"
      style={{ backgroundImage: "url('/bg-home.jpg')", filter: "blur(1px) saturate(1) brightness(0.85)" }}
    />
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/55" />
    <div className="aurora-c absolute -bottom-[25%] left-[10%] h-[50vmax] w-[50vmax] rounded-full bg-[#e8f047]/[0.05] blur-[120px]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.35)_100%)]" />
  </div>
);
