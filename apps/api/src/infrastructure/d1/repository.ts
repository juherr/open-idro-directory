import type {
  ConflictRow,
  DatasetRelease,
  ObservationRow,
  PartyRoleRow,
  PartyRow,
  SourceRow,
} from "./types.js";

export interface ListResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PartyFilters {
  country?: string | undefined;
  partyId?: string | undefined;
  emobilityId?: string | undefined;
  role?: string | undefined;
  status?: string | undefined;
  authority?: string | undefined;
  source?: string | undefined;
  hasConflict?: boolean | undefined;
  q?: string | undefined;
  cursor?: { countryCode: string; partyId: string } | null;
  limit: number;
}

export interface ObservationFilters {
  role?: string | undefined;
  status?: string | undefined;
  source?: string | undefined;
  authority?: string | undefined;
  observationType?: string | undefined;
  cursor?: { key: string } | null;
  limit: number;
}

export interface ConflictFilters {
  country?: string | undefined;
  role?: string | undefined;
  type?: string | undefined;
  severity?: string | undefined;
  source?: string | undefined;
  cursor?: { key: string } | null;
  limit: number;
}

export class RegistryRepository {
  constructor(private readonly db: D1Database) {}

  async activeRelease() {
    return this.first<DatasetRelease>(
      `SELECT r.*
       FROM active_dataset a
       JOIN dataset_releases r ON r.id = a.dataset_release_id
       WHERE a.singleton = 1`,
    );
  }

  async listParties(releaseId: string, filters: PartyFilters): Promise<ListResult<PartyRow>> {
    const clauses = ["p.dataset_release_id = ?"];
    const params: D1PreparedStatement["bind"] extends (...args: infer P) => unknown
      ? P
      : unknown[] = [releaseId];
    if (filters.country) add(clauses, params, "p.country_code = ?", filters.country);
    if (filters.partyId) add(clauses, params, "p.party_id = ?", filters.partyId);
    if (filters.emobilityId) add(clauses, params, "p.emobility_id = ?", filters.emobilityId);
    if (filters.status) add(clauses, params, "p.consolidated_status = ?", filters.status);
    if (filters.authority) add(clauses, params, "p.highest_authority_level = ?", filters.authority);
    if (filters.hasConflict !== undefined)
      add(clauses, params, "p.has_conflict = ?", filters.hasConflict ? 1 : 0);
    if (filters.cursor) {
      clauses.push("(p.country_code > ? OR (p.country_code = ? AND p.party_id > ?))");
      params.push(filters.cursor.countryCode, filters.cursor.countryCode, filters.cursor.partyId);
    }
    if (filters.q) {
      clauses.push(
        "(p.normalized_name LIKE ? ESCAPE '\\' OR p.emobility_id LIKE ? OR p.party_id LIKE ?)",
      );
      const pattern = `%${filters.q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      const prefix = `${filters.q.toUpperCase()}%`;
      params.push(pattern, prefix, prefix);
    }
    if (filters.role) {
      clauses.push(
        "EXISTS (SELECT 1 FROM party_roles pr WHERE pr.dataset_release_id = p.dataset_release_id AND pr.party_key = p.key AND pr.role = ?)",
      );
      params.push(filters.role);
    }
    if (filters.source) {
      clauses.push(
        "EXISTS (SELECT 1 FROM observations o WHERE o.dataset_release_id = p.dataset_release_id AND o.party_key = p.key AND o.source_id = ?)",
      );
      params.push(filters.source);
    }
    const limit = filters.limit + 1;
    params.push(limit);
    const rows = await this.all<PartyRow>(
      `SELECT p.*
       FROM parties p
       WHERE ${clauses.join(" AND ")}
       ORDER BY p.country_code ASC, p.party_id ASC
       LIMIT ?`,
      params,
    );
    return page(rows, filters.limit, (row) => ({
      countryCode: row.country_code,
      partyId: row.party_id,
    }));
  }

  async getParty(releaseId: string, countryCode: string, partyId: string) {
    return this.first<PartyRow>(
      `SELECT *
       FROM parties
       WHERE dataset_release_id = ? AND country_code = ? AND party_id = ?`,
      [releaseId, countryCode, partyId],
    );
  }

  async getPartyRoles(releaseId: string, partyKey: string) {
    return this.all<PartyRoleRow>(
      `SELECT *
       FROM party_roles
       WHERE dataset_release_id = ? AND party_key = ?
       ORDER BY role ASC`,
      [releaseId, partyKey],
    );
  }

  async listPartyObservations(releaseId: string, partyKey: string, filters: ObservationFilters) {
    return this.listObservations(releaseId, { ...filters, partyKey });
  }

  async listObservations(
    releaseId: string,
    filters: ObservationFilters & { partyKey?: string },
  ): Promise<ListResult<ObservationRow>> {
    const clauses = ["dataset_release_id = ?"];
    const params: unknown[] = [releaseId];
    if (filters.partyKey) add(clauses, params, "party_key = ?", filters.partyKey);
    if (filters.role) add(clauses, params, "role = ?", filters.role);
    if (filters.status) add(clauses, params, "status = ?", filters.status);
    if (filters.source) add(clauses, params, "source_id = ?", filters.source);
    if (filters.authority) add(clauses, params, "authority_level = ?", filters.authority);
    if (filters.observationType)
      add(clauses, params, "observation_type = ?", filters.observationType);
    if (filters.cursor) add(clauses, params, "key > ?", filters.cursor.key);
    params.push(filters.limit + 1);
    const rows = await this.all<ObservationRow>(
      `SELECT *
       FROM observations
       WHERE ${clauses.join(" AND ")}
       ORDER BY key ASC
       LIMIT ?`,
      params,
    );
    return page(rows, filters.limit, (row) => ({ key: row.key }));
  }

  async listPartyConflicts(
    releaseId: string,
    partyKey: string,
    filters: Omit<ConflictFilters, "country" | "source">,
  ) {
    return this.listConflicts(releaseId, { ...filters, partyKey });
  }

  async listConflicts(
    releaseId: string,
    filters: ConflictFilters & { partyKey?: string },
  ): Promise<ListResult<ConflictRow>> {
    const clauses = ["dataset_release_id = ?"];
    const params: unknown[] = [releaseId];
    if (filters.partyKey) add(clauses, params, "party_key = ?", filters.partyKey);
    if (filters.role) add(clauses, params, "role = ?", filters.role);
    if (filters.type) add(clauses, params, "conflict_type = ?", filters.type);
    if (filters.severity) add(clauses, params, "severity = ?", filters.severity);
    if (filters.country) add(clauses, params, "party_key LIKE ?", `${filters.country}:%`);
    if (filters.source) add(clauses, params, "source_ids_json LIKE ?", `%"${filters.source}"%`);
    if (filters.cursor) add(clauses, params, "key > ?", filters.cursor.key);
    params.push(filters.limit + 1);
    const rows = await this.all<ConflictRow>(
      `SELECT *
       FROM conflicts
       WHERE ${clauses.join(" AND ")}
       ORDER BY key ASC
       LIMIT ?`,
      params,
    );
    return page(rows, filters.limit, (row) => ({ key: row.key }));
  }

  async listSources(releaseId: string) {
    return this.all<SourceRow>(
      `SELECT *
       FROM sources
       WHERE dataset_release_id = ?
       ORDER BY id ASC`,
      [releaseId],
    );
  }

  async getSource(releaseId: string, sourceId: string) {
    return this.first<SourceRow>(
      `SELECT *
       FROM sources
       WHERE dataset_release_id = ? AND id = ?`,
      [releaseId, sourceId],
    );
  }

  async stats(releaseId: string) {
    const [
      countries,
      identifierCountries,
      roles,
      statuses,
      authorityLevels,
      sources,
      conflicts,
      totals,
    ] = await Promise.all([
      this.all<{ key: string; count: number }>(
        "SELECT country_code AS key, COUNT(*) AS count FROM parties WHERE dataset_release_id = ? GROUP BY country_code ORDER BY country_code",
        [releaseId],
      ),
      this.all<{ key: string; count: number }>(
        "SELECT country_code AS key, COUNT(*) AS count FROM observations WHERE dataset_release_id = ? GROUP BY country_code ORDER BY country_code",
        [releaseId],
      ),
      this.all<{ key: string; count: number }>(
        "SELECT role AS key, COUNT(*) AS count FROM party_roles WHERE dataset_release_id = ? GROUP BY role ORDER BY role",
        [releaseId],
      ),
      this.all<{ key: string; count: number }>(
        "SELECT consolidated_status AS key, COUNT(*) AS count FROM parties WHERE dataset_release_id = ? GROUP BY consolidated_status ORDER BY consolidated_status",
        [releaseId],
      ),
      this.all<{ key: string; count: number }>(
        "SELECT highest_authority_level AS key, COUNT(*) AS count FROM parties WHERE dataset_release_id = ? GROUP BY highest_authority_level ORDER BY highest_authority_level",
        [releaseId],
      ),
      this.all<{ key: string; count: number }>(
        "SELECT id AS key, record_count AS count FROM sources WHERE dataset_release_id = ? ORDER BY id",
        [releaseId],
      ),
      this.all<{ key: string; count: number }>(
        "SELECT severity AS key, COUNT(*) AS count FROM conflicts WHERE dataset_release_id = ? GROUP BY severity ORDER BY severity",
        [releaseId],
      ),
      this.first<{ parties: number; observations: number; conflicts: number }>(
        `SELECT
          (SELECT COUNT(*) FROM parties WHERE dataset_release_id = ?) AS parties,
          (SELECT COUNT(*) FROM observations WHERE dataset_release_id = ?) AS observations,
          (SELECT COUNT(*) FROM conflicts WHERE dataset_release_id = ?) AS conflicts`,
        [releaseId, releaseId, releaseId],
      ),
    ]);
    return {
      countries,
      identifierCountries,
      roles,
      statuses,
      authorityLevels,
      sources,
      conflicts,
      totals,
    };
  }

  async first<T>(sql: string, params: unknown[] = []) {
    return (
      (await this.db
        .prepare(sql)
        .bind(...params)
        .first<T>()) ?? null
    );
  }

  async all<T>(sql: string, params: unknown[] = []) {
    return (
      (
        await this.db
          .prepare(sql)
          .bind(...params)
          .all<T>()
      ).results ?? []
    );
  }
}

function add(clauses: string[], params: unknown[], clause: string, value: unknown) {
  clauses.push(clause);
  params.push(value);
}

function page<T, C>(rows: T[], limit: number, cursorOf: (row: T) => C): ListResult<T> {
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? JSON.stringify(cursorOf(items.at(-1) as T)) : null;
  return { items, nextCursor };
}
