import type { LookupType } from '@shared/types';

/** ConflictType (class diagram): Elephant Sighting, Crop-Raiding, Animal Entering Farmland, Animal Near Settlement. */
export class ConflictType {
  readonly typeId: number;
  readonly typeName: string;

  constructor(typeId: number, typeName: string) {
    this.typeId = typeId;
    this.typeName = typeName;
  }

  getTypeName(): string {
    return this.typeName;
  }

  static fromLookup(t: LookupType): ConflictType {
    return new ConflictType(t.type_id, t.type_name);
  }
}
