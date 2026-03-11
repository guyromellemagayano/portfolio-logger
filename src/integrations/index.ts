/**
 * Logger Integrations
 * Comprehensive integrations for popular logging services and platforms
 */

import { type CloudWatchConfig, CloudWatchIntegration } from "./aws-cloudwatch";
import {
  type AzureMonitorConfig,
  AzureMonitorIntegration,
} from "./azure-monitor";
import { type DatadogConfig, DatadogIntegration } from "./datadog";
import {
  type ElasticsearchConfig,
  ElasticsearchIntegration,
} from "./elasticsearch";
import { type GoogleCloudConfig, GoogleCloudIntegration } from "./google-cloud";
import { type LogRocketConfig, LogRocketIntegration } from "./logrocket";
import { type NewRelicConfig, NewRelicIntegration } from "./newrelic";
import { type PapertrailConfig, PapertrailIntegration } from "./papertrail";
import { type SentryConfig, SentryIntegration } from "./sentry";
import { type SplunkConfig, SplunkIntegration } from "./splunk";

// Core integrations
export { DatadogIntegration } from "./datadog";
export { LogRocketIntegration } from "./logrocket";
export { NewRelicIntegration } from "./newrelic";
export { SentryIntegration } from "./sentry";

// Cloud provider integrations
export { CloudWatchIntegration } from "./aws-cloudwatch";
export { AzureMonitorIntegration } from "./azure-monitor";
export { GoogleCloudIntegration } from "./google-cloud";

// Platform integrations
export { ElasticsearchIntegration } from "./elasticsearch";
export { PapertrailIntegration } from "./papertrail";
export { SplunkIntegration } from "./splunk";

// Integration utilities
export { createIntegration, type IntegrationConfig } from "./base";

// Integration factory
export const integrations = {
  sentry: (config?: SentryConfig) => new SentryIntegration(config),
  datadog: (config?: DatadogConfig) => new DatadogIntegration(config),
  newrelic: (config?: NewRelicConfig) => new NewRelicIntegration(config),
  logrocket: (config?: LogRocketConfig) => new LogRocketIntegration(config),
  cloudwatch: (config?: CloudWatchConfig) => new CloudWatchIntegration(config),
  googleCloud: (config?: GoogleCloudConfig) =>
    new GoogleCloudIntegration(config),
  azureMonitor: (config?: AzureMonitorConfig) =>
    new AzureMonitorIntegration(config),
  elasticsearch: (config?: ElasticsearchConfig) =>
    new ElasticsearchIntegration(config),
  splunk: (config?: SplunkConfig) => new SplunkIntegration(config),
  papertrail: (config?: PapertrailConfig) => new PapertrailIntegration(config),
};
