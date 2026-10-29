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
      style={{ backgroundImage: "url('/bg-home.jpg')", filter: "blur(2px) saturate(.72) brightness(.5)" }}
    />
    <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/65" />
    <div className="aurora-c absolute -bottom-[25%] left-[10%] h-[50vmax] w-[50vmax] rounded-full bg-[#e8f047]/[0.035] blur-[120px]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.45)_100%)]" />
  </div>
);
