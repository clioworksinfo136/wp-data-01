import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

/** Timestamps are days elapsed from this instant (UTC). */
const BASE_TIME = Date.parse('2024-10-25T00:00:00Z');
const MS_PER_DAY = 86_400_000;

/** Each track carries a single utility type, which becomes the vendor index. */
const VENDOR_BY_TYPE: Record<string, number> = {
  water: 0,
  wastewater: 1,
  stormwater: 2,
  pavement: 3,
};

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface LocationRow {
  id: string;
  date?: string | null;
  time?: string | null;
  track?: number | null;
  type?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface Trip {
  trackId: string;
  vendor: number;
  path: [number, number][];
  timestamps: number[];
}

/**
 * Days from BASE_TIME, kept fractional so time of day survives the conversion.
 * `time` is stored as HH:MM, which Date.parse needs padded to HH:MM:SS.
 */
function elapsedDays(row: LocationRow): number {
  const raw = row.time ?? '00:00:00';
  const time = /^\d{2}:\d{2}$/.test(raw) ? `${raw}:00` : raw;
  const at = Date.parse(`${row.date}T${time}Z`);
  if (Number.isNaN(at)) return 0;
  return Math.round(((at - BASE_TIME) / MS_PER_DAY) * 100_000) / 100_000;
}

async function scanAll(tableName: string): Promise<LocationRow[]> {
  const rows: LocationRow[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await docClient.send(new ScanCommand({
      TableName: tableName,
      ProjectionExpression: 'id, #d, #t, track, #ty, lat, lng',
      ExpressionAttributeNames: { '#d': 'date', '#t': 'time', '#ty': 'type' },
      ExclusiveStartKey: startKey,
    }));
    rows.push(...((page.Items ?? []) as LocationRow[]));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return rows;
}

export function toTrips(rows: LocationRow[]): Trip[] {
  const byTrack = new Map<number, LocationRow[]>();
  for (const row of rows) {
    if (row.lat == null || row.lng == null || row.date == null) continue;
    const track = Number(row.track ?? 0);
    const group = byTrack.get(track);
    if (group) group.push(row);
    else byTrack.set(track, [row]);
  }

  return [...byTrack.keys()].sort((a, b) => a - b).map((track) => {
    const ordered = byTrack.get(track)!
      .map((row) => ({ row, at: elapsedDays(row) }))
      .sort((a, b) => a.at - b.at);
    return {
      trackId: `track_${String(track).padStart(2, '0')}`,
      vendor: VENDOR_BY_TYPE[ordered[0].row.type ?? ''] ?? 0,
      path: ordered.map(({ row }): [number, number] => [Number(row.lng), Number(row.lat)]),
      timestamps: ordered.map(({ at }) => at),
    };
  });
}

export const handler = async () => {
  const tableName = process.env.LOCATION_TABLE_NAME;
  if (!tableName) {
    return { statusCode: 500, body: JSON.stringify({ error: 'LOCATION_TABLE_NAME is not set' }) };
  }
  try {
    const trips = toTrips(await scanAll(tableName));
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(trips),
    };
  } catch (error) {
    console.error('Failed to build trips:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to build trips' }) };
  }
};
