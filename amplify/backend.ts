import { defineBackend } from '@aws-amplify/backend';
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { imagesStorage } from './storage/resource';
import { trips } from './functions/trips/resource';

const backend = defineBackend({
  auth,
  data,
  imagesStorage,
  trips
});

// The trips function reads the Location table directly rather than going
// back through AppSync.
const locationTable = backend.data.resources.tables['Location'];
locationTable.grantReadData(backend.trips.resources.lambda);
backend.trips.addEnvironment('LOCATION_TABLE_NAME', locationTable.tableName);

// Public GET endpoint: no auth, so a map client can fetch it directly.
const tripsUrl = backend.trips.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.GET],
  },
});

// Surfaces the URL in amplify_outputs.json under custom.tripsUrl.
backend.addOutput({
  custom: {
    tripsUrl: tripsUrl.url,
  },
});
