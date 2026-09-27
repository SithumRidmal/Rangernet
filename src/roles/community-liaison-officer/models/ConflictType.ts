import type { ConflictTypeRow } from '../services/rows';

export class ConflictType {
  constructor(
    public typeId: number,
    public typeName: string,
  ) {}

  static fromRow(row: ConflictTypeRow | null, fallbackId: number): ConflictType {
    return new ConflictType(row?.type_id ?? fallbackId, row?.type_name ?? 'Conflict');
  }

  getTypeName(): string {
    return this.typeName;
  }
}
