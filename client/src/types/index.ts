export interface EnumValue {
  key: string;
  label: string;
}

export interface EnumDef {
  label: string;
  values: EnumValue[];
}

export interface StatField {
  key: string;
  label: string;
  required: boolean;
}

export interface Oopart {
  key: string;
  label: string;
  tiers: { name: string; iconUrl: string }[];
}

export interface Equipment {
  key: string;
  label: string;
  tiers: { name: string; iconUrl: string }[];
}

export interface Gift {
  key: string;
  name: string;
  tier: 'Normal' | 'HighGrade';
  description: string;
  iconUrl: string;
  affinity: {
    level2: number[];
    level3: number[];
    level4: number[];
  };
}

export interface SchemaConfig {
  enums: Record<string, EnumDef>;
  ooparts?: Oopart[];
  equipments?: Equipment[];
  gifts?: Gift[];
  statFields: StatField[];
  resourceIcons?: {
    Credit: string;
    SecretTechSheet: string;
    Eleph?: string;
    ExpReports?: string[];
    WeaponParts?: Record<string, string[]>;
    TechNotes: Record<string, string[]>;
    BDs: Record<string, string[]>;
    Affinity?: { level2: string; level3: string; level4: string; };
    WBs?: Record<string, string>;
  };
}

export interface Skill {
  name: string;
  descriptionTemplate: string;
  parameters: Record<string, string[]>;
  iconUrl: string;
}

export interface StudentMaster {
  id: number;
  studentNumber?: number;
  name: string;
  school: string;
  club?: string;
  fieldType: string;
  Role: string;
  Role2?: string;
  attackType: string;
  armorType: string;
  weaponType: string;
  position: string;
  position2?: string;
  starNum: number;
  hasFavoriteItem: boolean;
  equipmentSlot1: string;
  equipmentSlot2: string;
  equipmentSlot3: string;
  portraitUrl: string;
  secondaryPortraitUrl?: string;
  fullIllustUrl?: string;
  primaryOopart?: string;
  secondaryOopart?: string;
  terrainAffinity?: { urban: string; outdoor: string; indoor: string };
  uniqueWeaponEffects?: { star2: string; star3: string; star4: string };
  uniqueWeaponUrl?: string;
  uniqueWeaponName?: string;
  favoriteItemUrl?: string;
  favoriteItemEffects?: { t1: string; t2: string };
  skills: {
    ex: Skill;
    normal: Skill;
    passive: Skill;
    sub: Skill;
    normalPlus?: Skill;
    passivePlus?: Skill;
  };
}

export interface ArchiveRecord {
  studentId: number;
  level: number;
  currentStars: number;
  bondRank?: number;
  skillLevels: { ex: number; normal: number; passive: number; sub: number };
  equipment: {
    slot1: { tier: number; level: number } | null;
    slot2: { tier: number; level: number } | null;
    slot3: { tier: number; level: number } | null;
    slot4: { tier: number; level: number } | null;
  };
  uniqueWeapon: { stars: number; level: number } | null;
  stats: Record<string, number | null>;
  potentialLevels?: Record<string, number | null>;
  capturedAt: string;
}

export interface ArchiveData {
  master: StudentMaster;
  archive: ArchiveRecord | null;
  warning: { message: string } | null;
}
