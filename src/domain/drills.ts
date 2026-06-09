export type SkillCategory = 'technique' | 'prehab';

export interface Drill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  cues: string[];
}

export const DRILLS: Drill[] = [
  {
    id: 'drill-footwork-silent',
    name: 'Silent feet',
    category: 'technique',
    description: 'Place each foot precisely with no sound. Repeat until silent.',
    cues: ['Watch your feet land', 'Slow down the placement', 'No scuffing'],
  },
  {
    id: 'drill-footwork-deadpoint',
    name: 'Deadpoint practice',
    category: 'technique',
    description: 'Find a lock-off move; practice hitting the hold at the apex of motion.',
    cues: ['Stretch through the toe', 'One smooth motion', 'Catch and stick'],
  },
  {
    id: 'drill-technique-smear',
    name: 'Smear & trust',
    category: 'technique',
    description: 'Climb a slab or vertical section focusing on smearing.',
    cues: ['Rubber to wall', 'Hips in', 'Weight over the foot'],
  },
  {
    id: 'drill-prehab-ecu',
    name: 'ECU pronation',
    category: 'prehab',
    description: 'Wrist-strengthening for TFCC: pronation with a light band or bottle.',
    cues: ['Slow eccentric', 'Full range of motion', 'No pain'],
  },
  {
    id: 'drill-prehab-shoulder',
    name: 'Band pull-apart',
    category: 'prehab',
    description: 'Standing band pull-apart for rear delt and scapular control.',
    cues: ['Squeeze shoulder blades', 'Straight arms', 'Slow return'],
  },
  {
    id: 'drill-prehab-finger',
    name: 'Tendon glide',
    category: 'prehab',
    description: 'Finger tendon glide sequence: straight hook to full fist to straight.',
    cues: ['Slow and controlled', 'Full extension each rep', 'No pain'],
  },
];

export function getDrillsByCategory(category: SkillCategory): Drill[] {
  return DRILLS.filter((d) => d.category === category);
}

export function getDrill(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}
