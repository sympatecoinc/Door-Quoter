# ClickUp Authentication - Detailed Reference

## Overview

ClickUp API supports two authentication methods:
1. **Personal API Token** - For personal use and internal tools
2. **OAuth 2.0** - For building applications that other users will authorize

## Personal API Token

### Getting Your Token

1. Log into ClickUp
2. Navigate to **Settings** → **My Apps**
3. Click **Generate** to create a personal API token
4. Copy and securely store your token

### Using Personal Tokens

Include your token in the `Authorization` header of all API requests:

```
Authorization: YOUR_API_TOKEN
```

**Example Request (cURL):**
```bash
curl "https://api.clickup.com/api/v2/team" \
  -H "Authorization: YOUR_API_TOKEN"
```

**Example Request (JavaScript):**
```javascript
fetch('https://api.clickup.com/api/v2/team', {
  headers: {
    'Authorization': 'YOUR_API_TOKEN',
    'Content-Type': 'application/json'
  }
})
```

### Personal Token Characteristics

- ✅ Simple to implement
- ✅ No expiration
- ✅ Full access to your personal Workspace(s)
- ❌ Not suitable for apps used by others
- ❌ If compromised, requires manual regeneration
- ❌ Single user access only

---

## OAuth 2.0 Authentication

### Overview

OAuth allows users to authorize your application to access their ClickUp Workspaces without sharing their password or personal token.

### OAuth Flow Diagram

```
1. User clicks "Connect ClickUp" in your app
   ↓
2. Your app redirects to ClickUp authorization URL
   ↓
3. User logs in and authorizes your app
   ↓
4. ClickUp redirects back to your app with authorization code
   ↓
5. Your app exchanges code for access token
   ↓
6. Your app uses access token to make API requests
```

---

## Setting Up OAuth Application

### 1. Create OAuth App

1. Log into ClickUp as Workspace Owner or Admin
2. Navigate to **Workspace Settings** → **Integrations** → **API**
3. Click **Create an App**
4. Fill in application details:
   - **App Name**: User-visible name
   - **Redirect URL(s)**: Where users return after authorization
   - **Description**: What your app does

### 2. Obtain Credentials

After creating your app, you'll receive:

- **Client ID**: Public identifier for your application
- **Client Secret**: Private key (never share or expose publicly)

**Example:**
```
Client ID: 5QKR1M5TF0XW7PT6EFGH
Client Secret: ABC123DEF456GHI789JKL012MNO345PQR678STU
```

---

## OAuth Authorization Flow

### Step 1: Redirect User to Authorization URL

Construct the authorization URL and redirect the user:

**Authorization URL Format:**
```
https://app.clickup.com/api?client_id={client_id}&redirect_uri={redirect_uri}
```

**Parameters:**
- `client_id` (required): Your application's Client ID
- `redirect_uri` (required): Must match one of your registered redirect URLs

**Example (JavaScript):**
```javascript
const clientId = '5QKR1M5TF0XW7PT6EFGH';
const redirectUri = 'https://yourapp.com/callback';

const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

// Redirect user
window.location.href = authUrl;
```

### Step 2: User Authorizes Application

On the ClickUp authorization page, users:
1. Log in to ClickUp (if not already)
2. Select which Workspace(s) to authorize
3. Review permissions your app is requesting
4. Click **Authorize** or **Deny**

### Step 3: Handle Authorization Callback

After authorization, ClickUp redirects to your `redirect_uri` with an authorization code:

**Success Redirect:**
```
https://yourapp.com/callback?code=AUTHORIZATION_CODE
```

**Example (Express.js):**
```javascript
app.get('/callback', (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.status(400).send('Authorization denied or failed');
  }
  
  // Exchange code for access token (next step)
  exchangeCodeForToken(code);
});
```

### Step 4: Exchange Code for Access Token

**Endpoint:** `POST https://api.clickup.com/api/v2/oauth/token`

**Request Body:**
```json
{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "code": "AUTHORIZATION_CODE"
}
```

**Example Request (Node.js):**
```javascript
const axios = require('axios');

async function exchangeCodeForToken(code) {
  try {
    const response = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
      client_id: 'YOUR_CLIENT_ID',
      client_secret: 'YOUR_CLIENT_SECRET',
      code: code
    });
    
    const accessToken = response.data.access_token;
    // Store access token securely
    
    return accessToken;
  } catch (error) {
    console.error('Token exchange failed:', error);
  }
}
```

**Response:**
```json
{
  "access_token": "ACCESS_TOKEN_STRING"
}
```

### Step 5: Use Access Token

Include the access token in the `Authorization` header with `Bearer` prefix:

```
Authorization: Bearer ACCESS_TOKEN_STRING
```

**Example Request:**
```javascript
fetch('https://api.clickup.com/api/v2/team', {
  headers: {
    'Authorization': 'Bearer ACCESS_TOKEN_STRING',
    'Content-Type': 'application/json'
  }
})
```

---

## Get Access Token Endpoint

**Endpoint:** `POST /oauth/token`

Exchange an authorization code for an access token.

**Request Body:**
```json
{
  "client_id": "string",
  "client_secret": "string",
  "code": "string"
}
```

**Response:**
```json
{
  "access_token": "string"
}
```

**Important Notes:**
- Authorization codes are single-use only
- Codes expire after a short period (typically 10 minutes)
- Access tokens **currently do not expire** (subject to change)

---

## Get Authorized Workspaces

**Endpoint:** `GET /team` or `GET /v3/workspaces`

Retrieve which Workspaces the authenticated user has authorized.

**Headers:**
```
Authorization: Bearer ACCESS_TOKEN
```

**Response:**
```json
{
  "teams": [
    {
      "id": "123",
      "name": "My Workspace",
      "color": "#7b68ee",
      "avatar": null,
      "members": [
        {
          "user": {
            "id": 183,
            "username": "John Doe",
            "email": "john@example.com"
          }
        }
      ]
    }
  ]
}
```

**Use Cases:**
- Verify which Workspaces user has authorized
- Display Workspace selection to user
- Validate authorization before making requests

---

## Managing Authorization

### Reauthorization

To modify which Workspaces are authorized:

1. Redirect user back to authorization URL
2. User can add or remove Workspace access
3. Obtain new authorization code
4. Exchange for new access token

**Note:** Previous access tokens remain valid for originally authorized Workspaces.

### Revoking Access

Users can revoke access to your application:
- In ClickUp: **Workspace Settings** → **Integrations** → **Authorized Apps**
- After revocation, API requests return `OAUTH_023` or similar error

Your application should:
1. Handle revocation errors gracefully
2. Clear stored tokens
3. Prompt user to reauthorize if needed

---

## Token Management

### Storing Tokens Securely

**Best Practices:**

1. **Never expose tokens in:**
   - Client-side JavaScript
   - Public repositories
   - URLs or query parameters
   - Browser local storage (without encryption)

2. **Store tokens:**
   - In encrypted databases
   - Using secure environment variables
   - In server-side sessions with secure flags
   - With access control restrictions

3. **Associate tokens with users:**
   - Store user-token relationship in your database
   - Implement per-user token retrieval

**Example Database Schema:**
```sql
CREATE TABLE clickup_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  workspace_ids TEXT[], -- Array of authorized workspace IDs
  UNIQUE(user_id)
);
```

### Token Expiration

**Current Behavior:**
- Access tokens **do not expire**
- This may change in the future

**Future-Proof Your Application:**
- Monitor for authentication errors
- Implement token refresh handling
- Store token creation timestamp
- Plan for potential token expiration

---

## Common OAuth Errors

### Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| `OAUTH_023` | Workspace not authorized | User needs to reauthorize |
| `OAUTH_026` | Authorization revoked | Prompt user to reauthorize |
| `OAUTH_027` | Invalid authorization code | Code expired or already used |
| `OAUTH_029` - `OAUTH_045` | Various authorization errors | Check error message details |
| `TOKEN_INVALID` | Invalid access token | Verify token format and validity |
| `AUTHORIZATION_ERROR` | Missing Authorization header | Include Authorization header |

### Handling OAuth Errors

**Example Error Handler (Node.js):**
```javascript
async function makeAuthenticatedRequest(url, token) {
  try {
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      const errorCode = error.response.data.err;
      
      if (['OAUTH_023', 'OAUTH_026'].includes(errorCode)) {
        // Authorization revoked or workspace not authorized
        console.log('User needs to reauthorize');
        // Redirect to reauthorization flow
        return redirectToAuth();
      }
      
      if (errorCode === 'TOKEN_INVALID') {
        console.log('Invalid token');
        // Clear stored token, prompt for reauth
      }
    }
    throw error;
  }
}
```

---

## OAuth Security Best Practices

### 1. Redirect URI Validation

- Register exact redirect URIs with ClickUp
- Validate redirect_uri parameter matches registered URIs
- Use HTTPS for all redirect URIs in production

### 2. State Parameter (CSRF Protection)

While not required by ClickUp's OAuth flow, implement state parameter for security:

**Authorization URL with State:**
```javascript
const state = generateRandomString(32);
sessionStorage.setItem('oauth_state', state);

const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
```

**Validate State in Callback:**
```javascript
app.get('/callback', (req, res) => {
  const { code, state } = req.query;
  const savedState = req.session.oauth_state;
  
  if (state !== savedState) {
    return res.status(400).send('Invalid state parameter');
  }
  
  // Continue with token exchange
});
```

### 3. Client Secret Protection

- Never expose Client Secret in client-side code
- Use environment variables for secrets
- Rotate secrets if compromised
- Implement server-side token exchange only

### 4. Token Storage Security

- Encrypt tokens at rest
- Use secure, HTTP-only cookies for web apps
- Implement proper access controls
- Regular security audits

---

## Multi-Workspace Authorization

Users can authorize your application for multiple Workspaces:

### Handling Multiple Workspaces

**Get All Authorized Workspaces:**
```javascript
async function getAuthorizedWorkspaces(accessToken) {
  const response = await axios.get('https://api.clickup.com/api/v2/team', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  return response.data.teams;
}
```

**Store Multiple Workspace Associations:**
```javascript
async function storeWorkspaceAuthorizations(userId, accessToken) {
  const workspaces = await getAuthorizedWorkspaces(accessToken);
  
  await db.query(`
    UPDATE clickup_tokens 
    SET workspace_ids = $1 
    WHERE user_id = $2
  `, [workspaces.map(w => w.id), userId]);
}
```

---

## Testing OAuth Flow

### Development Environment

1. **Use ngrok for local testing:**
```bash
ngrok http 3000
```

2. **Register ngrok URL as redirect URI:**
```
https://abc123.ngrok.io/callback
```

3. **Test authorization flow:**
```javascript
const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=https://abc123.ngrok.io/callback`;
```

### OAuth Testing Checklist

- [ ] Authorization URL redirects correctly
- [ ] User can select Workspaces
- [ ] Callback receives authorization code
- [ ] Code exchanges successfully for token
- [ ] Token works for API requests
- [ ] Error handling works (deny, cancel, revoke)
- [ ] Multiple Workspace authorization works
- [ ] Reauthorization updates permissions correctly

---

## Migration from Personal Tokens to OAuth

If migrating an existing application:

1. **Create OAuth application** in ClickUp
2. **Implement OAuth flow** alongside existing token auth
3. **Prompt users to authorize** via OAuth
4. **Gradual migration** - support both methods temporarily
5. **Deprecate personal tokens** once all users migrated
6. **Update documentation** to reflect OAuth-only support

---

## API v2 vs v3 Authentication

Both API versions use the same authentication methods:

**API v2:**
```
Authorization: YOUR_TOKEN
# or
Authorization: Bearer ACCESS_TOKEN
```

**API v3:**
```
Authorization: YOUR_TOKEN
# or
Authorization: Bearer ACCESS_TOKEN
```

No difference in authentication headers between versions.

---

## Troubleshooting

### "Invalid client_id" Error

- Verify Client ID is correct
- Ensure OAuth app is properly configured
- Check for typos or extra spaces

### "Redirect URI mismatch" Error

- Verify redirect_uri exactly matches registered URI
- Check for trailing slashes
- Ensure using correct protocol (http vs https)

### "Invalid authorization code" Error

- Code already used (single-use only)
- Code expired (typically 10-minute expiration)
- Code from different OAuth app

### Token Not Working for API Requests

- Verify token format (Personal: just token, OAuth: Bearer {token})
- Check authorization header spelling
- Ensure Workspace is authorized
- Verify token hasn't been revoked

---

## Additional Resources

- **Authentication Docs**: https://developer.clickup.com/docs/authentication
- **Get Access Token**: https://developer.clickup.com/reference/getaccesstoken
- **Common Errors**: https://developer.clickup.com/docs/common_errors

