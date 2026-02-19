import axios from 'axios';
import crypto from 'crypto';
import { getConfig } from './config.js';

const SERVICE = 'cloudtrail';

// ============================================================
// AWS SigV4 Request Signing
// ============================================================

function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(key, dateStamp, region, service) {
  const kDate = sign('AWS4' + key, dateStamp);
  const kRegion = sign(kDate, region);
  const kService = sign(kRegion, service);
  return sign(kService, 'aws4_request');
}

function getAmzDate() {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function buildSignedHeaders({ method, path, body, region, accessKeyId, secretAccessKey, sessionToken, target }) {
  const host = `cloudtrail.${region}.amazonaws.com`;
  const amzDate = getAmzDate();
  const dateStamp = amzDate.substring(0, 8);

  const bodyStr = body ? JSON.stringify(body) : '{}';
  const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

  const headers = {
    'content-type': 'application/x-amz-json-1.1',
    'host': host,
    'x-amz-date': amzDate,
    'x-amz-target': target,
    'x-amz-content-sha256': contentHash
  };
  if (sessionToken) headers['x-amz-security-token'] = sessionToken;

  const signedHeaderNames = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaderNames, contentHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, SERVICE);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`;

  return { host, headers: { ...headers, authorization }, bodyStr };
}

// ============================================================
// API Client
// ============================================================

async function apiRequest(target, body = {}) {
  const region = getConfig('region') || 'us-east-1';
  const accessKeyId = getConfig('accessKeyId');
  const secretAccessKey = getConfig('secretAccessKey');
  const sessionToken = getConfig('sessionToken');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured. Run: awscloudtrail config set --access-key-id <id> --secret-access-key <secret>');
  }

  const { host, headers, bodyStr } = buildSignedHeaders({
    method: 'POST', path: '/', body, region, accessKeyId, secretAccessKey, sessionToken, target
  });

  try {
    const response = await axios.post(`https://${host}/`, bodyStr, { headers });
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

function handleApiError(error) {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    if (status === 401 || status === 403) throw new Error('Authentication failed. Check your AWS credentials and permissions.');
    if (status === 404) throw new Error('Resource not found.');
    if (status === 429) throw new Error('Rate limit exceeded. Please wait before retrying.');
    const message = data?.message || data?.Message || data?.__type || JSON.stringify(data);
    throw new Error(`API Error (${status}): ${message}`);
  } else if (error.request) {
    throw new Error('No response from AWS CloudTrail API. Check your internet connection and region.');
  } else {
    throw error;
  }
}

// ============================================================
// TRAILS
// ============================================================

export async function listTrails() {
  const data = await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.ListTrails', {});
  return data.Trails || [];
}

export async function getTrail(trailName) {
  const data = await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.GetTrail', {
    Name: trailName
  });
  return data.Trail || null;
}

export async function createTrail({ name, s3BucketName, includeGlobalServiceEvents = true, isMultiRegionTrail = false, enableLogFileValidation = true }) {
  return await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.CreateTrail', {
    Name: name,
    S3BucketName: s3BucketName,
    IncludeGlobalServiceEvents: includeGlobalServiceEvents,
    IsMultiRegionTrail: isMultiRegionTrail,
    EnableLogFileValidation: enableLogFileValidation
  });
}

export async function deleteTrail(trailName) {
  return await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.DeleteTrail', {
    Name: trailName
  });
}

export async function getTrailStatus(trailName) {
  return await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.GetTrailStatus', {
    Name: trailName
  });
}

export async function startLogging(trailName) {
  return await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.StartLogging', {
    Name: trailName
  });
}

export async function stopLogging(trailName) {
  return await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.StopLogging', {
    Name: trailName
  });
}

// ============================================================
// EVENTS
// ============================================================

export async function lookupEvents({ startTime, endTime, maxResults = 20, attributeKey, attributeValue } = {}) {
  const body = { MaxResults: maxResults };
  if (startTime) body.StartTime = startTime;
  if (endTime) body.EndTime = endTime;
  if (attributeKey && attributeValue) {
    body.LookupAttributes = [{ AttributeKey: attributeKey, AttributeValue: attributeValue }];
  }
  const data = await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.LookupEvents', body);
  return data.Events || [];
}

export async function getEventSelectors(trailName) {
  return await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.GetEventSelectors', {
    TrailName: trailName
  });
}

// ============================================================
// INSIGHTS
// ============================================================

export async function getInsightSelectors(trailName) {
  return await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.GetInsightSelectors', {
    TrailName: trailName
  });
}

export async function putInsightSelectors(trailName, insightSelectors) {
  return await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.PutInsightSelectors', {
    TrailName: trailName,
    InsightSelectors: insightSelectors
  });
}

export async function listInsights({ maxResults = 20, insightType } = {}) {
  const body = { MaxResults: maxResults };
  if (insightType) body.InsightType = insightType;
  const data = await apiRequest('com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.LookupEvents', {
    ...body,
    LookupAttributes: [{ AttributeKey: 'EventSource', AttributeValue: 'insight.cloudtrail.amazonaws.com' }]
  });
  return data.Events || [];
}
