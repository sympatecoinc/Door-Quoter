# ClickUp Rate Limits & Error Handling

## Rate Limits

### Overview

The ClickUp API enforces rate limits per token (both personal and OAuth tokens). Rate limits vary based on the Workspace Plan of the Workspace hosting the token.

### Rate Limit Tiers

| Workspace Plan | Requests per Minute |
|----------------|---------------------|
| Free Forever | 100 |
| Unlimited | 100 |
| Business | 100 |
| Business Plus | 1,000 |
| Enterprise | 10,000 |

**Important Notes:**
- Rate limits are per token, not per IP address
- Limits apply to all API requests using that token
- Both successful and failed requests count toward the limit

### Rate Limit Headers

Every API response includes rate limit information in headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699123456
```

**Header Definitions:**

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Current rate limit for the token |
| `X-RateLimit-Remaining` | Number of requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when rate limit will reset |

### Rate Limit Exceeded Response

When you exceed the rate limit, the API returns:

**HTTP Status Code:** `429 Too Many Requests`

**Response Body:**
```json
{
  "err": "Rate limit exceeded",
  "ECODE": "RATE_LIMIT_EXCEEDED"
}
```

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699123520
Retry-After: 64
```

The `Retry-After` header indicates seconds to wait before retrying.

---

## Handling Rate Limits

### Basic Retry Logic

**Example (JavaScript):**
```javascript
async function makeRequestWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
        
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
        await sleep(waitTime);
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Exponential Backoff

**Example (Python):**
```python
import time
import requests
from typing import Optional

def make_request_with_backoff(
    url: str,
    headers: dict,
    max_retries: int = 5
) -> Optional[requests.Response]:
    base_wait = 1  # Start with 1 second
    
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)
        
        if response.status_code == 429:
            if attempt == max_retries - 1:
                raise Exception("Max retries exceeded")
            
            # Exponential backoff: 1s, 2s, 4s, 8s, 16s
            wait_time = base_wait * (2 ** attempt)
            
            # Use Retry-After header if available
            retry_after = response.headers.get('Retry-After')
            if retry_after:
                wait_time = int(retry_after)
            
            print(f"Rate limited. Waiting {wait_time}s...")
            time.sleep(wait_time)
            continue
        
        return response
    
    return None
```

### Proactive Rate Limit Management

**Monitor Remaining Requests:**
```javascript
class RateLimitManager {
  constructor() {
    this.limit = 100;
    this.remaining = 100;
    this.resetTime = Date.now() + 60000;
  }
  
  updateFromHeaders(headers) {
    this.limit = parseInt(headers.get('X-RateLimit-Limit'));
    this.remaining = parseInt(headers.get('X-RateLimit-Remaining'));
    this.resetTime = parseInt(headers.get('X-RateLimit-Reset')) * 1000;
  }
  
  async waitIfNeeded(threshold = 10) {
    // If close to limit, wait for reset
    if (this.remaining < threshold) {
      const waitTime = this.resetTime - Date.now();
      if (waitTime > 0) {
        console.log(`Approaching rate limit. Waiting ${waitTime}ms...`);
        await sleep(waitTime);
      }
    }
  }
  
  async makeRequest(url, options) {
    await this.waitIfNeeded();
    
    const response = await fetch(url, options);
    this.updateFromHeaders(response.headers);
    
    return response;
  }
}
```

### Request Queuing

**Example (Node.js with Queue):**
```javascript
const Queue = require('bull');

class ClickUpAPIClient {
  constructor(apiToken, requestsPerMinute = 100) {
    this.apiToken = apiToken;
    this.queue = new Queue('clickup-requests');
    
    // Process queue with rate limiting
    this.queue.process(async (job) => {
      return await this.executeRequest(job.data);
    });
    
    // Limit concurrent requests
    this.queue.limiter = {
      max: requestsPerMinute,
      duration: 60000
    };
  }
  
  async queueRequest(endpoint, options) {
    return this.queue.add({
      endpoint,
      options
    });
  }
  
  async executeRequest({ endpoint, options }) {
    const response = await fetch(
      `https://api.clickup.com/api/v2${endpoint}`,
      {
        ...options,
        headers: {
          'Authorization': this.apiToken,
          ...options.headers
        }
      }
    );
    
    return response.json();
  }
}
```

---

## Common HTTP Status Codes

### Success Codes (2xx)

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Successful request with no response body |

### Client Error Codes (4xx)

| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Invalid or missing authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |

### Server Error Codes (5xx)

| Code | Status | Description |
|------|--------|-------------|
| 500 | Internal Server Error | ClickUp server error |
| 502 | Bad Gateway | Gateway or proxy error |
| 503 | Service Unavailable | Service temporarily unavailable |
| 504 | Gateway Timeout | Request timeout |

---

## Common API Errors

### Authentication Errors

**TOKEN_INVALID**
```json
{
  "err": "Token invalid",
  "ECODE": "TOKEN_INVALID"
}
```
**Cause:** Invalid or malformed API token
**Solution:** Verify token format and regenerate if necessary

**AUTHORIZATION_ERROR**
```json
{
  "err": "Authorization header not found",
  "ECODE": "AUTHORIZATION_ERROR"
}
```
**Cause:** Missing Authorization header
**Solution:** Include `Authorization: YOUR_TOKEN` header

### OAuth Errors

**OAUTH_023, OAUTH_026, OAUTH_027, OAUTH_029-OAUTH_045**
```json
{
  "err": "Team was not authorized",
  "ECODE": "OAUTH_023"
}
```
**Causes:**
- Workspace not authorized for this token
- Authorization revoked by user
- Invalid OAuth configuration

**Solution:** Prompt user to reauthorize

**OAUTH_027**
```json
{
  "err": "Invalid authorization code",
  "ECODE": "OAUTH_027"
}
```
**Cause:** Authorization code expired or already used
**Solution:** Restart OAuth flow with new code

### Resource Errors

**RESOURCE_NOT_FOUND**
```json
{
  "err": "Task not found",
  "ECODE": "RESOURCE_NOT_FOUND"
}
```
**Cause:** Requested resource doesn't exist or user lacks access
**Solution:** Verify resource ID and user permissions

**INVALID_PARAMS**
```json
{
  "err": "Invalid parameters",
  "ECODE": "INVALID_PARAMS"
}
```
**Cause:** Invalid or missing required parameters
**Solution:** Check API documentation for required parameters

### Storage Errors

**GBUSED_005**
```json
{
  "err": "Storage limit exceeded",
  "ECODE": "GBUSED_005"
}
```
**Cause:** Workspace storage limit exceeded (attachments)
**Solution:** User needs to upgrade plan or free up storage

### Custom Field Errors

**CUSTOM_FIELD_LIMIT**
```json
{
  "err": "Custom field usage limit reached",
  "ECODE": "CUSTOM_FIELD_LIMIT"
}
```
**Cause:** Free plan's custom field usage limit (60 uses) reached
**Solution:** Upgrade Workspace plan or cannot set more custom fields

---

## Error Handling Best Practices

### Comprehensive Error Handler

**Example (TypeScript):**
```typescript
interface APIError {
  err: string;
  ECODE: string;
}

class ClickUpAPIError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    public errorMessage: string
  ) {
    super(errorMessage);
    this.name = 'ClickUpAPIError';
  }
}

async function handleClickUpRequest<T>(
  requestFn: () => Promise<Response>
): Promise<T> {
  try {
    const response = await requestFn();
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new ClickUpAPIError(
        429,
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded. Retry after ${retryAfter}s`
      );
    }
    
    // Handle other errors
    if (!response.ok) {
      const error: APIError = await response.json();
      throw new ClickUpAPIError(
        response.status,
        error.ECODE,
        error.err
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ClickUpAPIError) {
      // Handle specific error codes
      switch (error.errorCode) {
        case 'TOKEN_INVALID':
          console.error('Invalid token, please reauthorize');
          // Redirect to auth flow
          break;
        
        case 'OAUTH_023':
        case 'OAUTH_026':
          console.error('Authorization revoked, please reauthorize');
          // Prompt reauthorization
          break;
        
        case 'RESOURCE_NOT_FOUND':
          console.error('Resource not found');
          // Handle missing resource
          break;
        
        case 'RATE_LIMIT_EXCEEDED':
          console.error('Rate limit exceeded');
          // Implement backoff
          break;
        
        default:
          console.error('API error:', error.errorMessage);
      }
    }
    
    throw error;
  }
}
```

### Error Logging

**Example (with Winston):**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

async function makeAPIRequest(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      logger.error('API request failed', {
        url,
        status: response.status,
        errorCode: error.ECODE,
        errorMessage: error.err,
        timestamp: new Date().toISOString()
      });
      
      throw new Error(error.err);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Request exception', {
      url,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
}
```

### User-Friendly Error Messages

**Example:**
```javascript
function getUserFriendlyError(error) {
  const errorMessages = {
    'TOKEN_INVALID': 'Your ClickUp connection has expired. Please reconnect.',
    'OAUTH_023': 'This workspace is no longer authorized. Please reauthorize.',
    'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again in a moment.',
    'RESOURCE_NOT_FOUND': 'The requested item could not be found.',
    'GBUSED_005': 'Storage limit exceeded. Please free up space or upgrade.',
    'CUSTOM_FIELD_LIMIT': 'Custom field limit reached. Upgrade plan to continue.'
  };
  
  return errorMessages[error.ECODE] || 'An unexpected error occurred. Please try again.';
}

// Usage in UI
try {
  await updateTask(taskId, updates);
} catch (error) {
  displayToast(getUserFriendlyError(error), 'error');
}
```

---

## Retry Strategies

### Fixed Delay Retry

```javascript
async function retryWithFixedDelay(fn, maxRetries = 3, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Don't retry client errors (except rate limit)
      if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        throw error;
      }
      
      await sleep(delayMs);
    }
  }
}
```

### Exponential Backoff with Jitter

```javascript
async function retryWithBackoff(fn, maxRetries = 5) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) throw error;
      
      // Don't retry client errors (except rate limit)
      if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      
      console.log(`Retry attempt ${attempt} after ${delay}ms`);
      await sleep(delay);
    }
  }
}
```

---

## Circuit Breaker Pattern

Prevent cascading failures by implementing circuit breaker:

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureThreshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.log(`Circuit breaker opened. Next attempt at ${new Date(this.nextAttempt)}`);
    }
  }
}

// Usage
const breaker = new CircuitBreaker(5, 60000);

async function makeRequest(url, options) {
  return breaker.execute(async () => {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  });
}
```

---

## Monitoring & Alerting

### Rate Limit Monitoring

```javascript
class RateLimitMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      rateLimitHits: 0,
      averageRemaining: []
    };
  }
  
  record(headers) {
    this.metrics.totalRequests++;
    
    const remaining = parseInt(headers.get('X-RateLimit-Remaining'));
    this.metrics.averageRemaining.push(remaining);
    
    if (remaining === 0) {
      this.metrics.rateLimitHits++;
    }
    
    // Alert if frequently hitting limit
    if (this.metrics.rateLimitHits > 10) {
      this.sendAlert('Frequently hitting rate limit');
    }
    
    // Alert if consistently low remaining
    const avgRemaining = this.metrics.averageRemaining.slice(-10)
      .reduce((a, b) => a + b, 0) / 10;
    
    if (avgRemaining < 10) {
      this.sendAlert('Consistently low rate limit remaining');
    }
  }
  
  sendAlert(message) {
    console.error('ALERT:', message);
    // Implement your alerting logic (email, Slack, PagerDuty, etc.)
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      hitRate: (this.metrics.rateLimitHits / this.metrics.totalRequests * 100).toFixed(2) + '%'
    };
  }
}
```

---

## Best Practices Summary

1. **Always check rate limit headers** before making additional requests
2. **Implement exponential backoff** for rate limit errors
3. **Use request queuing** for high-volume applications
4. **Cache responses** when appropriate to reduce API calls
5. **Log all errors** with context for debugging
6. **Implement circuit breakers** to prevent cascading failures
7. **Monitor rate limit usage** and set up alerts
8. **Handle errors gracefully** with user-friendly messages
9. **Don't retry client errors** (4xx) except 429
10. **Batch requests** when possible to reduce total request count

---

## Additional Resources

- **Rate Limits Documentation**: https://developer.clickup.com/docs/rate-limits
- **Common Errors**: https://developer.clickup.com/docs/common_errors
- **API Status**: https://status.clickup.com

