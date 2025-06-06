import 'dotenv/config';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import * as opentelemetry from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import config from 'src/configuration/config';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
} from '@opentelemetry/core';
import { B3InjectEncoding, B3Propagator } from '@opentelemetry/propagator-b3';

const appConfig = config();

const traceExporter = new OTLPTraceExporter({
  url: appConfig.tracing.url,
  headers: {
    authorization: appConfig.tracing.apiKey,
  },
  compression: 'gzip' as any,
});

const sdk = new opentelemetry.NodeSDK({
  // traceExporter,
  resource: new Resource({
    [ATTR_SERVICE_NAME]: appConfig.serviceName,
  }),
  spanProcessor: new BatchSpanProcessor(traceExporter),
  contextManager: new AsyncLocalStorageContextManager(),
  textMapPropagator: new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
      new W3CBaggagePropagator(),
      new B3Propagator(),
      new B3Propagator({
        injectEncoding: B3InjectEncoding.MULTI_HEADER,
      }),
    ],
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

if (appConfig.tracing.enable) {
  console.log('Tracing enabled', appConfig.tracing);
  sdk.start();
  // gracefully shut down the SDK on process exit
  process.on('SIGTERM', () => {
    sdk.shutdown().then(() => console.log('Tracing terminated'));
  });
}
 
export default sdk;
 