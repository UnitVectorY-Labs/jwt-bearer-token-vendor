import * as core from '@actions/core'
import { HttpClient } from '@actions/http-client'

/**
 * The main function for the action.
 * Requests an access token from an external OAuth 2.0 server using the
 * jwt-bearer grant type authenticated with a GitHub OIDC token.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const githubAudience = core.getInput('github-audience', { required: true })
    const requestTokenUrl = core.getInput('request-token-url', {
      required: true
    })
    const requestClientId = core.getInput('request-client-id', {
      required: true
    })
    const requestAudience = core.getInput('request-audience')
    const requestScope = core.getInput('request-scope')

    // Get the OIDC token (JWT assertion) from GitHub Actions
    core.info('Requesting GitHub OIDC token...')
    const githubIdToken = await core.getIDToken(githubAudience)
    core.info('GitHub OIDC token acquired.')

    // Prepare the request to the token endpoint using the jwt-bearer grant type
    const params = new URLSearchParams()
    params.append(
      'grant_type',
      'urn:ietf:params:oauth:grant-type:jwt-bearer'
    )
    params.append('assertion', githubIdToken)
    params.append('client_id', requestClientId)
    if (requestAudience) {
      params.append('audience', requestAudience)
    }
    if (requestScope) {
      params.append('scope', requestScope)
    }

    // Send the request to the token endpoint
    core.info(
      'Requesting access token from the token endpoint on the specified server using jwt-bearer flow.'
    )
    const httpClient = new HttpClient()
    const response = await httpClient.post(
      requestTokenUrl,
      params.toString(),
      {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    )

    const responseBody = await response.readBody()
    const data = JSON.parse(responseBody)
    const accessToken: string | undefined = data.access_token
    const tokenType: string | undefined = data.token_type
    const expiresIn: number | undefined = data.expires_in
    if (!accessToken) {
      throw new Error('Access token not found in the response')
    } else if (!tokenType) {
      throw new Error('Token type not found in the response')
    }

    // The purpose of this GitHub action is this, getting the access token and setting it as an output
    core.setSecret(accessToken)
    core.setOutput('access-token', accessToken)
    core.setOutput('token-type', tokenType)
    if (expiresIn) {
      core.setOutput('expires-in', expiresIn)
    }

    core.info('Access token acquired and set as output.')
  } catch (error) {
    // Log the error message and set the action status to failed to assist with troubleshooting
    if (error instanceof Error) {
      core.error(`Error message: ${error.message}`)
      core.setFailed(`Action failed with error: ${error.message}`)
    } else {
      core.setFailed(`Action failed with an unknown error`)
    }
  }
}
