import { defineFunction } from '@aws-amplify/backend';

/**
 * Serves the Location table as deck.gl TripsLayer trips, one per track.
 * Exposed as a public Lambda Function URL in backend.ts.
 */
export const trips = defineFunction({
  name: 'trips',
  entry: './handler.ts',
  timeoutSeconds: 30,
});
