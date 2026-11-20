import type { StaticImageData } from 'next/image';
import A from './A.png';
import B from './B.png';
import C from './C.png';
import D from './D.png';
import S from './S.png';
import SS from './SS.png';

export const terrainAffinityImages: Record<string, StaticImageData> = {
  A,
  B,
  C,
  D,
  S,
  SS,
};

export function getTerrainAffinityImage(rank?: string): StaticImageData {
  if (!rank) return B;
  const upper = rank.trim().toUpperCase();
  return terrainAffinityImages[upper] || B;
}

export function getTerrainAffinityUrl(rank?: string): string {
  const upper = (rank || 'B').trim().toUpperCase();
  return `https://api.plan4ai.fyi/uploads/misc/${upper}.webp`;
}

export default terrainAffinityImages;
