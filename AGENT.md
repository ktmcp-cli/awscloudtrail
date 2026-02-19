# AGENT.md — AWS CloudTrail CLI for AI Agents

## Overview

The `awscloudtrail` CLI provides access to the AWS CloudTrail Audit Logging API. Use it to manage audit trails, look up API events, and configure CloudTrail Insights.

## Prerequisites

Configure AWS credentials before use:

```bash
awscloudtrail config set --access-key-id <id> --secret-access-key <secret> --region us-east-1
awscloudtrail config list
```

## All Commands

### Config

```bash
awscloudtrail config set --access-key-id <id> --secret-access-key <secret> --region us-east-1
awscloudtrail config get region
awscloudtrail config list
```

### Trails

```bash
awscloudtrail trails list
awscloudtrail trails get <trail-name>
awscloudtrail trails status <trail-name>
awscloudtrail trails create --name <name> --s3-bucket <bucket>
awscloudtrail trails create --name <name> --s3-bucket <bucket> --multi-region --log-validation
awscloudtrail trails start-logging <trail-name>
awscloudtrail trails stop-logging <trail-name>
awscloudtrail trails delete <trail-name>
```

### Events

```bash
awscloudtrail events lookup
awscloudtrail events lookup --max-results 50
awscloudtrail events lookup --start-time 2024-01-01T00:00:00Z --end-time 2024-01-31T23:59:59Z
awscloudtrail events lookup --attribute-key EventName --attribute-value DeleteBucket
awscloudtrail events lookup --attribute-key Username --attribute-value john.doe
awscloudtrail events lookup --attribute-key AccessKeyId --attribute-value AKIAIOSFODNN7EXAMPLE
awscloudtrail events lookup --attribute-key EventSource --attribute-value s3.amazonaws.com
awscloudtrail events selectors <trail-name>
```

Attribute keys: EventId, EventName, ReadOnly, Username, ResourceType, ResourceName, EventSource, AccessKeyId

### Insights

```bash
awscloudtrail insights get <trail-name>
awscloudtrail insights enable <trail-name> --type ApiCallRateInsight
awscloudtrail insights enable <trail-name> --type ApiErrorRateInsight
awscloudtrail insights list
awscloudtrail insights list --max-results 50
```

## JSON Output

Always use `--json` when parsing results:

```bash
awscloudtrail trails list --json
awscloudtrail events lookup --json
awscloudtrail events lookup --attribute-key EventName --attribute-value DeleteBucket --json
```

## Security Investigation Workflow

```bash
# Find all API calls from a specific user in the last hour
awscloudtrail events lookup \
  --attribute-key Username \
  --attribute-value suspicious-user \
  --json | jq '.[] | {time: .EventTime, action: .EventName, ip: .SourceIPAddress}'

# Find all S3 deletions
awscloudtrail events lookup \
  --attribute-key EventSource \
  --attribute-value s3.amazonaws.com \
  --json | jq '.[] | select(.EventName | startswith("Delete"))'
```

## Error Handling

CLI exits with code 1 on error. Common errors:
- `Authentication failed` — Check AWS credentials and region
- `Resource not found` — Trail name is case-sensitive
- `Rate limit exceeded` — CloudTrail LookupEvents has a 2 TPS limit
