[![GitHub release](https://img.shields.io/github/release/UnitVectorY-Labs/jwt-bearer-token-vendor.svg)](https://github.com/UnitVectorY-Labs/jwt-bearer-token-vendor/releases/latest) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![Active](https://img.shields.io/badge/Status-Active-green)](https://guide.unitvectorylabs.com/bestpractices/status/#active)

# jwt-bearer-token-vendor

A GitHub Action used to request an access tokens from an external OAuth 2.0 server that supports the jwt-bearer grant type authenticated to with a GitHub OIDC token.

## How It Works

1. **GitHub OIDC Token**: The action first obtains the GitHub OIDC token, which serves as the JWT assertion to authenticate the request to your API.
2. **Token Request**: The action then makes a request to your API's token endpoint, using the JWT Bearer OAuth 2.0 flow, to exchange the JWT for an access token optionally specifying an audience and scope parameters.
3. **Output**: The access token is exposed as an output (secret) of the action, which can be used in subsequent steps in your workflow for authenticating API calls.

## Usage Example

```yaml
jobs:
  obtain-access-token:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Obtain Access Token
        id: get-token
        uses: UnitVectorY-Labs/jwt-bearer-token-vendor@v1
        with:
          github-audience: 'your-client-audience'
          request-token-url: 'https://issuer.example.com/token'
          request-client-id: 'your-client-id'
          request-audience: 'https://client.example.com/'
          request-scope: 'read write'

      - name: Use Access Token
        run: |
          echo "Access token: ${{ steps.get-token.outputs['access-token'] }}"
          echo "Token type: ${{ steps.get-token.outputs['token-type'] }}"
          echo "Expires in: ${{ steps.get-token.outputs['expires-in'] }}"
```

## Inputs

- **`github-audience`** (required): The audience for the GitHub OIDC token that will be sent to the server in the assertion.
- **`request-token-url`** (required): The token endpoint URL of your API that supports the jwt-bearer grant type.
- **`request-client-id`** (required): The client ID for your service that will be sent in the jwt-bearer request.
- **`request-audience`** (optional): The audience parameter included in the jwt-bearer request.
- **`request-scope`** (optional): The scope parameter included in the jwt-bearer request.

## Outputs

- **`access-token`**: The access token obtained from your API.
- **`token-type`**: The type of token issued (e.g., `Bearer`).
- **`expires-in`**: The number of seconds until the access token expires.
