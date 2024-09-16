import * as core from '@actions/core';
import { HttpClient } from '@actions/http-client';

async function run() {
  try {
    const githubAudience = core.getInput('github-audience', { required: true });
    const requestTokenUrl = core.getInput('request-token-url', { required: true });
    const requestClientId = core.getInput('request-client-id', { required: true });
    const requestAudience = core.getInput('request-audience');
    const requestScope = core.getInput('request-scope');

    // Get the OIDC token (JWT assertion) from GitHub Actions
    core.info('Requesting GitHub OIDC token...');
    const githubIdToken = await core.getIDToken(githubAudience);
    core.info('GitHub OIDC token acquired.');

    // Prepare the request to the token endpoint using the jwt-bearer grant type
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    params.append('assertion', githubIdToken);
    params.append('client_id', requestClientId);
    if(requestAudience) {
      params.append('audience', requestAudience);
    } 
    if (requestScope) {
      params.append('scope', requestScope);
    }

    // Send the request to the token endpoint
    core.info('Requesting access token from the token endpoint on the specified server using jwt-bearer flow.');
    const httpClient = new HttpClient();
    const response = await httpClient.post(requestTokenUrl, params.toString(), {
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    const responseBody = await response.readBody();
    const data = JSON.parse(responseBody);
    const accessToken = data.access_token;
    const tokenType = data.token_type;
    const expiresIn = data.expires_in;
    if (!accessToken) {
      throw new Error('Access token not found in the response');
    } else if (!tokenType) {
      throw new Error('Token type not found in the response');
    }

    // The purpose of this GitHub action is this, getting the access token and setting it as an output
    core.setSecret(accessToken);
    core.setOutput('access-token', accessToken);
    core.setOutput('token-type', tokenType);
    if (expiresIn) {
      core.setOutput('expires-in', expiresIn);
    }
    
    core.info('Access token acquired and set as output.');
  } catch (error) {
    // Log the error message and set the action status to failed to assist with troubleshooting
    if (error.response) {
      core.error(`API response data: ${JSON.stringify(error.response.data)}`);
      core.error(`API response status: ${error.response.status}`);
      core.error(`API response headers: ${JSON.stringify(error.response.headers)}`);
    } else {
      core.error(`Error message: ${error.message}`);
    }
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

run();