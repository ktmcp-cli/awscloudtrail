> "Six months ago, everyone was talking about MCPs. And I was like, screw MCPs. Every MCP would be better as a CLI."
>
> — [Peter Steinberger](https://twitter.com/steipete), Founder of OpenClaw
> [Watch on YouTube (~2:39:00)](https://www.youtube.com/@lexfridman) | [Lex Fridman Podcast #491](https://lexfridman.com/peter-steinberger/)

# AWS CloudTrail CLI

Production-ready CLI for the AWS CloudTrail Audit Logging API. Manage trails, look up API events, and configure Insights from your terminal.

## Installation

```bash
npm install -g @ktmcp-cli/awscloudtrail
```

## Configuration

```bash
awscloudtrail config set --access-key-id YOUR_ACCESS_KEY_ID \
  --secret-access-key YOUR_SECRET_ACCESS_KEY \
  --region us-east-1
```

## Usage

### Config

```bash
# Set AWS credentials
awscloudtrail config set --access-key-id <id> --secret-access-key <secret> --region us-east-1

# Get a config value
awscloudtrail config get region

# List all config
awscloudtrail config list
```

### Trails

```bash
# List all trails
awscloudtrail trails list

# Get trail details
awscloudtrail trails get my-audit-trail

# Get trail logging status
awscloudtrail trails status my-audit-trail

# Create a new trail
awscloudtrail trails create \
  --name production-audit-trail \
  --s3-bucket my-cloudtrail-logs \
  --multi-region \
  --log-validation

# Start logging
awscloudtrail trails start-logging my-audit-trail

# Stop logging
awscloudtrail trails stop-logging my-audit-trail

# Delete a trail
awscloudtrail trails delete my-audit-trail

# JSON output
awscloudtrail trails list --json
```

### Events

```bash
# Look up recent events (last 90 days)
awscloudtrail events lookup

# Filter by time range
awscloudtrail events lookup \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z

# Filter by event name
awscloudtrail events lookup \
  --attribute-key EventName \
  --attribute-value DeleteBucket

# Filter by username
awscloudtrail events lookup \
  --attribute-key Username \
  --attribute-value john.doe

# Filter by access key
awscloudtrail events lookup \
  --attribute-key AccessKeyId \
  --attribute-value AKIAIOSFODNN7EXAMPLE

# Get event selectors
awscloudtrail events selectors my-audit-trail

# JSON output
awscloudtrail events lookup --json
```

### Insights

```bash
# Get insight configuration for a trail
awscloudtrail insights get my-audit-trail

# Enable API call rate insights
awscloudtrail insights enable my-audit-trail --type ApiCallRateInsight

# Enable API error rate insights
awscloudtrail insights enable my-audit-trail --type ApiErrorRateInsight

# List recent insight events
awscloudtrail insights list
awscloudtrail insights list --max-results 50 --json
```

## Event Attribute Keys

Use these with `--attribute-key` for filtering events:

- `EventId` — Unique event ID
- `EventName` — API call name (e.g. `DescribeInstances`)
- `ReadOnly` — `true` or `false`
- `Username` — IAM user or role name
- `ResourceType` — AWS resource type
- `ResourceName` — AWS resource name or ARN
- `EventSource` — AWS service (e.g. `s3.amazonaws.com`)
- `AccessKeyId` — The access key used

## JSON Output

All commands support `--json`:

```bash
# Get all events as JSON and filter with jq
awscloudtrail events lookup --json | jq '.[] | {time: .EventTime, name: .EventName, user: .Username}'

# Find all DeleteBucket events
awscloudtrail events lookup --attribute-key EventName --attribute-value DeleteBucket --json
```

## License

MIT


---

## Support KTMCP

If you find this CLI useful, we'd greatly appreciate your support! Share your experience on:
- Reddit
- Twitter/X
- Hacker News

**Incentive:** Users who can demonstrate that their support/advocacy helped advance KTMCP will have their feature requests and issues prioritized.

Just be mindful - these are real accounts and real communities. Authentic mentions and genuine recommendations go a long way!

## Support This Project

If you find this CLI useful, we'd appreciate support across Reddit, Twitter, Hacker News, or Moltbook. Please be mindful - these are real community accounts. Contributors who can demonstrate their support helped advance KTMCP will have their PRs and feature requests prioritized.
