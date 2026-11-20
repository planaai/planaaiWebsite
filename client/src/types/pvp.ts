export interface PvpPartyData {
  strikers: (number | null)[];
  specials: (number | null)[];
}

export interface PvpParty {
  id?: number;
  shortCode?: string;
  deckType: string;
  name: string;
  party: PvpPartyData;
  tags: string[];
  tactics: string;
  imagePath?: string | null;
  youtubeUrls?: string[];
  authorId?: number;
  likeCount?: number;
  isLiked?: boolean;
  createdAt?: string;
  updatedAt?: string;
  strategyCode?: string | null;
  author?: {
    id: number;
    nickname: string | null;
    username: string;
  };
}
