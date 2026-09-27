import { loadLookups } from '@shared/lookups/useLookups';

/** IncidentType (class diagram): typeId, typeName; getTypeName(). */
export class IncidentType {
  constructor(
    readonly typeId: number,
    readonly typeName: string,
  ) {}

  getTypeName(): string {
    return this.typeName;
  }

  /** getAvailableTypes() - UC-01 step 2: display the available incident types. */
  static async getAvailableTypes(): Promise<IncidentType[]> {
    const lookups = await loadLookups();
    return lookups.incidentTypes.map((t) => new IncidentType(t.type_id, t.type_name));
  }
}
