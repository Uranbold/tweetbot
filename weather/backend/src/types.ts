/**
 * Single import point for the shared API contract. Type-only: erased at build
 * time, so the runtime bundle never references ../shared.
 */
export type * from '../../shared/contract.js';
