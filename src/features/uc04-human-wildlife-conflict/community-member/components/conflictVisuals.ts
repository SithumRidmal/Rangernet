import { FenceIcon, HouseIcon, PawPrintIcon, TriangleAlertIcon, WheatIcon, type LucideIcon } from 'lucide-react-native';

type ConflictVisual = { icon: LucideIcon; hint: string };

const VISUALS: Record<number, ConflictVisual> = {
  1: { icon: PawPrintIcon, hint: 'Elephants seen near homes, roads or fields' },
  2: { icon: WheatIcon, hint: 'Animals eating or trampling crops' },
  3: { icon: FenceIcon, hint: 'Animal broke in or is inside a farm' },
  4: { icon: HouseIcon, hint: 'Wild animal close to houses or a school' },
};

const FALLBACK: ConflictVisual = { icon: TriangleAlertIcon, hint: 'Human-wildlife conflict' };

export function conflictVisual(typeId: number | null | undefined): ConflictVisual {
  return (typeId ? VISUALS[typeId] : undefined) ?? FALLBACK;
}
