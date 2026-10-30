import { defineBackend } from '@aws-amplify/backend';
import { Cors, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
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

// Served through API Gateway rather than a Lambda Function URL: this account
// blocks public function URLs, which answer 403 even with an open resource
// policy.
const apiStack = backend.createStack('trips-api');
const tripsApi = new LambdaRestApi(apiStack, 'TripsApi', {
  handler: backend.trips.resources.lambda,
  proxy: true,
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: ['GET', 'OPTIONS'],
  },
});

// Surfaces the URL in amplify_outputs.json under custom.tripsUrl.
backend.addOutput({
  custom: {
    tripsUrl: tripsApi.url,
  },
});
