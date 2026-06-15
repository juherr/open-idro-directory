export interface PartyCursor {
  countryCode: string;
  partyId: string;
}

export interface KeyCursor {
  key: string;
}

export function encodeCursor(cursor: PartyCursor | KeyCursor | null) {
  if (!cursor) return null;
  return btoa(JSON.stringify(cursor));
}

export function decodeCursor<T extends PartyCursor | KeyCursor>(
  value: string | undefined,
): T | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(atob(value)) as unknown;
    if (decoded && typeof decoded === "object") return decoded as T;
  } catch {
    return null;
  }
  return null;
}
