import type React from 'react';

/** Contract every role folder exports from its index.ts. */
export type RoleModule = {
  /** Root navigator for the role (bottom tabs + detail screens). */
  Navigator: React.ComponentType;
  /** Registers the role's offline synchronization handlers. */
  registerSync?: () => void;
  /** Show the one-time location / camera field setup after first sign-in. */
  needsFieldSetup: boolean;
};
