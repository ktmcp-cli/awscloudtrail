import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, setConfig, isConfigured, getAllConfig } from './config.js';
import {
  listTrails, getTrail, createTrail, deleteTrail, getTrailStatus, startLogging, stopLogging,
  lookupEvents, getEventSelectors,
  getInsightSelectors, putInsightSelectors, listInsights
} from './api.js';

const program = new Command();

// ============================================================
// Helpers
// ============================================================

function printSuccess(message) {
  console.log(chalk.green('✓') + ' ' + message);
}

function printError(message) {
  console.error(chalk.red('✗') + ' ' + message);
}

function printTable(data, columns) {
  if (!data || data.length === 0) {
    console.log(chalk.yellow('No results found.'));
    return;
  }

  const widths = {};
  columns.forEach(col => {
    widths[col.key] = col.label.length;
    data.forEach(row => {
      const val = String(col.format ? col.format(row[col.key], row) : (row[col.key] ?? ''));
      if (val.length > widths[col.key]) widths[col.key] = val.length;
    });
    widths[col.key] = Math.min(widths[col.key], 50);
  });

  const header = columns.map(col => col.label.padEnd(widths[col.key])).join('  ');
  console.log(chalk.bold(chalk.cyan(header)));
  console.log(chalk.dim('─'.repeat(header.length)));

  data.forEach(row => {
    const line = columns.map(col => {
      const val = String(col.format ? col.format(row[col.key], row) : (row[col.key] ?? ''));
      return val.substring(0, widths[col.key]).padEnd(widths[col.key]);
    }).join('  ');
    console.log(line);
  });

  console.log(chalk.dim(`\n${data.length} result(s)`));
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

async function withSpinner(message, fn) {
  const spinner = ora(message).start();
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

function requireAuth() {
  if (!isConfigured()) {
    printError('AWS credentials not configured.');
    console.log('\nRun the following to configure:');
    console.log(chalk.cyan('  awscloudtrail config set --access-key-id <id> --secret-access-key <secret> --region <region>'));
    process.exit(1);
  }
}

// ============================================================
// Program metadata
// ============================================================

program
  .name('awscloudtrail')
  .description(chalk.bold('AWS CloudTrail CLI') + ' - Audit logging from your terminal')
  .version('1.0.0');

// ============================================================
// CONFIG
// ============================================================

const configCmd = program.command('config').description('Manage CLI configuration');

configCmd
  .command('set')
  .description('Set configuration values')
  .option('--access-key-id <id>', 'AWS Access Key ID')
  .option('--secret-access-key <secret>', 'AWS Secret Access Key')
  .option('--session-token <token>', 'AWS Session Token (for temporary credentials)')
  .option('--region <region>', 'AWS Region (e.g. us-east-1, eu-west-1)')
  .action((options) => {
    if (options.accessKeyId) { setConfig('accessKeyId', options.accessKeyId); printSuccess('Access Key ID set'); }
    if (options.secretAccessKey) { setConfig('secretAccessKey', options.secretAccessKey); printSuccess('Secret Access Key set'); }
    if (options.sessionToken) { setConfig('sessionToken', options.sessionToken); printSuccess('Session Token set'); }
    if (options.region) { setConfig('region', options.region); printSuccess(`Region set to ${options.region}`); }
    if (!options.accessKeyId && !options.secretAccessKey && !options.sessionToken && !options.region) {
      printError('No options provided. Use --access-key-id, --secret-access-key, or --region');
    }
  });

configCmd
  .command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key')
  .action((key) => {
    const value = getConfig(key);
    if (value === undefined) {
      printError(`Key '${key}' not found`);
    } else {
      console.log(value);
    }
  });

configCmd
  .command('list')
  .description('List all configuration values')
  .action(() => {
    const all = getAllConfig();
    console.log(chalk.bold('\nAWS CloudTrail CLI Configuration\n'));
    console.log('Access Key ID:     ', all.accessKeyId ? chalk.green(all.accessKeyId) : chalk.red('not set'));
    console.log('Secret Access Key: ', all.secretAccessKey ? chalk.green('*'.repeat(8)) : chalk.red('not set'));
    console.log('Session Token:     ', all.sessionToken ? chalk.green('set') : chalk.dim('not set'));
    console.log('Region:            ', all.region ? chalk.green(all.region) : chalk.yellow('not set (default: us-east-1)'));
    console.log('');
  });

// ============================================================
// TRAILS
// ============================================================

const trailsCmd = program.command('trails').description('Manage CloudTrail trails');

trailsCmd
  .command('list')
  .description('List all CloudTrail trails')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const trails = await withSpinner('Fetching trails...', () => listTrails());

      if (options.json) { printJson(trails); return; }

      printTable(trails, [
        { key: 'Name', label: 'Name' },
        { key: 'TrailARN', label: 'ARN', format: (v) => v ? v.split('/').pop() : '' },
        { key: 'HomeRegion', label: 'Home Region' }
      ]);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

trailsCmd
  .command('get <trail-name>')
  .description('Get details of a specific trail')
  .option('--json', 'Output as JSON')
  .action(async (trailName, options) => {
    requireAuth();
    try {
      const trail = await withSpinner('Fetching trail...', () => getTrail(trailName));

      if (options.json) { printJson(trail); return; }

      if (!trail) { printError('Trail not found'); process.exit(1); }

      console.log(chalk.bold('\nTrail Details\n'));
      console.log('Name:                  ', chalk.bold(trail.Name));
      console.log('ARN:                   ', chalk.cyan(trail.TrailARN));
      console.log('S3 Bucket:             ', trail.S3BucketName || 'N/A');
      console.log('Home Region:           ', trail.HomeRegion);
      console.log('Multi-Region:          ', trail.IsMultiRegionTrail ? chalk.green('Yes') : 'No');
      console.log('Global Service Events: ', trail.IncludeGlobalServiceEvents ? chalk.green('Yes') : 'No');
      console.log('Log Validation:        ', trail.LogFileValidationEnabled ? chalk.green('Enabled') : chalk.yellow('Disabled'));
      if (trail.CloudWatchLogsLogGroupArn) {
        console.log('CloudWatch Logs:       ', trail.CloudWatchLogsLogGroupArn);
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

trailsCmd
  .command('create')
  .description('Create a new CloudTrail trail')
  .requiredOption('--name <name>', 'Trail name')
  .requiredOption('--s3-bucket <bucket>', 'S3 bucket name for log storage')
  .option('--multi-region', 'Enable multi-region trail', false)
  .option('--global-events', 'Include global service events', true)
  .option('--log-validation', 'Enable log file validation', true)
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const trail = await withSpinner('Creating trail...', () =>
        createTrail({
          name: options.name,
          s3BucketName: options.s3Bucket,
          isMultiRegionTrail: options.multiRegion,
          includeGlobalServiceEvents: options.globalEvents,
          enableLogFileValidation: options.logValidation
        })
      );

      if (options.json) { printJson(trail); return; }

      printSuccess(`Trail '${options.name}' created`);
      console.log('Trail ARN:  ', chalk.cyan(trail.TrailARN));
      console.log('S3 Bucket:  ', trail.S3BucketName);
      console.log('\nStart logging with:');
      console.log(chalk.cyan(`  awscloudtrail trails start-logging ${options.name}`));
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

trailsCmd
  .command('delete <trail-name>')
  .description('Delete a CloudTrail trail')
  .action(async (trailName) => {
    requireAuth();
    try {
      await withSpinner(`Deleting trail '${trailName}'...`, () => deleteTrail(trailName));
      printSuccess(`Trail '${trailName}' deleted`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

trailsCmd
  .command('status <trail-name>')
  .description('Get trail logging status')
  .option('--json', 'Output as JSON')
  .action(async (trailName, options) => {
    requireAuth();
    try {
      const status = await withSpinner('Fetching trail status...', () => getTrailStatus(trailName));

      if (options.json) { printJson(status); return; }

      console.log(chalk.bold('\nTrail Status\n'));
      const isLogging = status.IsLogging;
      console.log('Logging:      ', isLogging ? chalk.green('Active') : chalk.red('Stopped'));
      if (status.LatestDeliveryTime) {
        console.log('Last Delivery:', new Date(status.LatestDeliveryTime).toLocaleString());
      }
      if (status.LatestDeliveryError) {
        console.log('Last Error:   ', chalk.red(status.LatestDeliveryError));
      }
      if (status.StartLoggingTime) {
        console.log('Started:      ', new Date(status.StartLoggingTime).toLocaleString());
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

trailsCmd
  .command('start-logging <trail-name>')
  .description('Start logging for a trail')
  .action(async (trailName) => {
    requireAuth();
    try {
      await withSpinner(`Starting logging for '${trailName}'...`, () => startLogging(trailName));
      printSuccess(`Logging started for trail '${trailName}'`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

trailsCmd
  .command('stop-logging <trail-name>')
  .description('Stop logging for a trail')
  .action(async (trailName) => {
    requireAuth();
    try {
      await withSpinner(`Stopping logging for '${trailName}'...`, () => stopLogging(trailName));
      printSuccess(`Logging stopped for trail '${trailName}'`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

// ============================================================
// EVENTS
// ============================================================

const eventsCmd = program.command('events').description('Look up CloudTrail events');

eventsCmd
  .command('lookup')
  .description('Look up recent API events')
  .option('--start-time <datetime>', 'Start time (ISO 8601, e.g. 2024-01-01T00:00:00Z)')
  .option('--end-time <datetime>', 'End time (ISO 8601)')
  .option('--attribute-key <key>', 'Filter attribute key (EventId|EventName|ReadOnly|Username|ResourceType|ResourceName|EventSource|AccessKeyId)')
  .option('--attribute-value <value>', 'Filter attribute value')
  .option('--max-results <n>', 'Maximum results', '20')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const events = await withSpinner('Looking up events...', () =>
        lookupEvents({
          startTime: options.startTime,
          endTime: options.endTime,
          attributeKey: options.attributeKey,
          attributeValue: options.attributeValue,
          maxResults: parseInt(options.maxResults)
        })
      );

      if (options.json) { printJson(events); return; }

      printTable(events, [
        { key: 'EventTime', label: 'Time', format: (v) => v ? new Date(v).toLocaleString() : 'N/A' },
        { key: 'EventName', label: 'Event Name' },
        { key: 'EventSource', label: 'Service' },
        { key: 'Username', label: 'User' },
        { key: 'AwsRegion', label: 'Region' },
        { key: 'SourceIPAddress', label: 'Source IP' }
      ]);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

eventsCmd
  .command('selectors <trail-name>')
  .description('Get event selectors for a trail')
  .option('--json', 'Output as JSON')
  .action(async (trailName, options) => {
    requireAuth();
    try {
      const result = await withSpinner('Fetching event selectors...', () => getEventSelectors(trailName));

      if (options.json) { printJson(result); return; }

      console.log(chalk.bold('\nEvent Selectors\n'));
      const selectors = result.EventSelectors || [];
      if (selectors.length === 0) {
        console.log(chalk.yellow('No event selectors configured.'));
        return;
      }
      selectors.forEach((sel, i) => {
        console.log(`Selector ${i + 1}:`);
        console.log('  Read/Write Type:   ', sel.ReadWriteType);
        console.log('  Include Mgmt:      ', sel.IncludeManagementEvents ? 'Yes' : 'No');
        if (sel.DataResources?.length) {
          console.log('  Data Resources:');
          sel.DataResources.forEach(dr => console.log(`    ${dr.Type}: ${(dr.Values || []).join(', ')}`));
        }
      });
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

// ============================================================
// INSIGHTS
// ============================================================

const insightsCmd = program.command('insights').description('Manage CloudTrail Insights');

insightsCmd
  .command('get <trail-name>')
  .description('Get insight selectors for a trail')
  .option('--json', 'Output as JSON')
  .action(async (trailName, options) => {
    requireAuth();
    try {
      const result = await withSpinner('Fetching insight selectors...', () => getInsightSelectors(trailName));

      if (options.json) { printJson(result); return; }

      console.log(chalk.bold('\nInsight Selectors\n'));
      const selectors = result.InsightSelectors || [];
      if (selectors.length === 0) {
        console.log(chalk.yellow('No insight selectors configured.'));
        return;
      }
      selectors.forEach(sel => {
        console.log('Insight Type: ', chalk.cyan(sel.InsightType));
      });
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

insightsCmd
  .command('enable <trail-name>')
  .description('Enable CloudTrail Insights for a trail')
  .option('--type <type>', 'Insight type (ApiCallRateInsight|ApiErrorRateInsight)', 'ApiCallRateInsight')
  .action(async (trailName, options) => {
    requireAuth();
    try {
      await withSpinner('Enabling insights...', () =>
        putInsightSelectors(trailName, [{ InsightType: options.type }])
      );
      printSuccess(`Insights (${options.type}) enabled for trail '${trailName}'`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

insightsCmd
  .command('list')
  .description('List recent CloudTrail Insights events')
  .option('--max-results <n>', 'Maximum results', '20')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const insights = await withSpinner('Fetching insights...', () =>
        listInsights({ maxResults: parseInt(options.maxResults) })
      );

      if (options.json) { printJson(insights); return; }

      if (insights.length === 0) {
        console.log(chalk.yellow('No insight events found.'));
        return;
      }

      printTable(insights, [
        { key: 'EventTime', label: 'Time', format: (v) => v ? new Date(v).toLocaleString() : 'N/A' },
        { key: 'EventName', label: 'Event Name' },
        { key: 'EventSource', label: 'Service' },
        { key: 'Username', label: 'User' }
      ]);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

// ============================================================
// Parse
// ============================================================

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
