export interface ParsedEmobilityIdentifier {
  countryCode: string;
  partyId: string;
  emobilityId: string;
}

// TODO: replace this local parser with juherr/mobilityid once the TypeScript package is released.
export function parseEmobilityIdentifierInput(value: string): ParsedEmobilityIdentifier | null {
  const input = value.trim().toUpperCase();
  const separated = /^([A-Z]{2})[-*]([A-Z0-9]{3})$/.exec(input);
  const compact = separated ?? /^([A-Z]{2})([A-Z0-9*]{3})$/.exec(input);
  if (!compact) return null;

  const countryCode = compact[1] as string;
  const partyId = compact[2] as string;
  return {
    countryCode,
    partyId,
    emobilityId: `${countryCode}${partyId}`,
  };
}
