/** Verify IDs from an explicitly supported data provider before using them in filters. */
export function isSupportedNbaId(value: string): boolean {
  return /^(?:sportapi|bdl):[1-9][0-9]{0,15}$/.test(value);
}
