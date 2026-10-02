import {
  CircleAlertIcon,
  FootprintsIcon,
  ShieldAlertIcon,
  SkullIcon,
  TentIcon,
  type LucideIcon,
} from 'lucide-react-native';

const BY_NAME: Record<string, { icon: LucideIcon; hint: string }> = {
  snare: { icon: ShieldAlertIcon, hint: 'Wire snares, traps and other poaching devices' },
  carcass: { icon: SkullIcon, hint: 'Dead wildlife, suspected poaching or natural' },
  'illegal campsite': { icon: TentIcon, hint: 'Fire pits, shelters, waste left by intruders' },
  footprints: { icon: FootprintsIcon, hint: 'Human tracks or signs of illegal entry' },
};

export function incidentTypeVisual(typeName: string): { icon: LucideIcon; hint: string } {
  return BY_NAME[typeName.trim().toLowerCase()] ?? { icon: CircleAlertIcon, hint: 'Record this incident type' };
}
