export interface RaidBoss {
  id: string;
  name: string;
  iconUrl: string;
  defenseType: string;
}

export interface RaidPartyMember {
  studentId: number | null;
  // We can add minimum required specs later (e.g. minStars, minLevel)
}

export interface SubParty {
  name?: string;
  strikers: (number | null)[];
  specials: (number | null)[];
}

export interface RaidParty {
  id: number | string; // backend uses Int, static uses string
  bossId?: string;
  terrain?: string;
  difficulty?: string;
  name: string;
  parties: SubParty[];
  tags: string[];
  tactics: string;
  clearTime?: string;
  imagePath?: string;
  author?: { id: number; nickname: string | null; username: string };
  likeCount?: number;
}

export interface RaidSeasonData {
  bossId: string;
  terrain: 'Urban' | 'Outdoor' | 'Indoor';
  difficulty: string; // e.g. "Insane", "Torment"
  parties: RaidParty[];
}
