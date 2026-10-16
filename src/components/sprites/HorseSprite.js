import React from "react";

// Simple original cartoon horse, facing right (matches Scratch's default direction 90).
export default function HorseSprite({ width = 110, height = 100 }) {
  const stroke = { stroke: "#3B2314", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 110 100">
      {/* tail */}
      <path d="M20 42 C8 44 4 58 8 72 C12 64 14 56 22 50 Z" fill="#5A3A22" {...stroke} />
      {/* back legs */}
      <rect x="24" y="58" width="9" height="34" rx="4" fill="#A0673C" {...stroke} />
      <rect x="35" y="60" width="9" height="32" rx="4" fill="#B97A47" {...stroke} />
      {/* front legs */}
      <rect x="62" y="60" width="9" height="32" rx="4" fill="#A0673C" {...stroke} />
      <rect x="73" y="58" width="9" height="34" rx="4" fill="#B97A47" {...stroke} />
      {/* hooves */}
      <rect x="23" y="88" width="11" height="6" rx="2" fill="#3B2314" />
      <rect x="34" y="88" width="11" height="6" rx="2" fill="#3B2314" />
      <rect x="61" y="88" width="11" height="6" rx="2" fill="#3B2314" />
      <rect x="72" y="88" width="11" height="6" rx="2" fill="#3B2314" />
      {/* body */}
      <ellipse cx="53" cy="54" rx="34" ry="17" fill="#C68650" {...stroke} />
      {/* neck */}
      <path d="M72 46 L80 18 L94 22 L88 52 Z" fill="#C68650" {...stroke} />
      {/* head */}
      <path d="M80 12 C86 6 96 8 104 20 C108 26 106 32 100 32 C94 32 90 28 84 28 C78 26 76 18 80 12 Z" fill="#C68650" {...stroke} />
      {/* muzzle */}
      <ellipse cx="101" cy="27" rx="6" ry="5" fill="#E2B48A" {...stroke} />
      <circle cx="103" cy="26" r="1.2" fill="#3B2314" />
      {/* ear */}
      <path d="M82 12 L84 2 L89 10 Z" fill="#A0673C" {...stroke} />
      {/* eye */}
      <circle cx="90" cy="16" r="2.6" fill="#FFFFFF" {...stroke} />
      <circle cx="90.6" cy="16" r="1.3" fill="#1A0F08" />
      {/* mane */}
      <path d="M80 10 C74 16 74 24 72 32 C70 40 70 44 72 48 C76 40 78 32 80 26 C82 20 84 14 80 10 Z" fill="#5A3A22" {...stroke} />
    </svg>
  );
}
