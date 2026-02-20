import * as core from '@actions/core'
import { HttpClient } from '@actions/http-client'
import type { HttpClientResponse } from '@actions/http-client'
import { run } from '../src/main'

jest.mock('@actions/core')
jest.mock('@actions/http-client')

const mockCore = jest.mocked(core)
const MockHttpClient = jest.mocked(HttpClient)

describe('run', () => {
  let mockPost: jest.Mock

  function setupInputs(inputs: Record<string, string>): void {
    mockCore.getInput.mockImplementation((name: string) => {
      return inputs[name] || ''
    })
  }

  function setupHttpResponse(body: string): void {
    mockPost = jest.fn().mockResolvedValue({
      readBody: jest.fn().mockResolvedValue(body)
    } as unknown as HttpClientResponse)
    MockHttpClient.mockImplementation(
      () =>
        ({
          post: mockPost
        }) as unknown as HttpClient
    )
  }

  beforeEach(() => {
    setupInputs({
      'github-audience': 'test-audience',
      'request-token-url': 'https://token.example.com/oauth/token',
      'request-client-id': 'client-123'
    })
    mockCore.getIDToken.mockResolvedValue('mock-oidc-token')
    setupHttpResponse(
      JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      })
    )
  })

  it('successfully acquires token with all parameters', async () => {
    setupInputs({
      'github-audience': 'test-audience',
      'request-token-url': 'https://token.example.com/oauth/token',
      'request-client-id': 'client-123',
      'request-audience': 'api-audience',
      'request-scope': 'read write'
    })

    await run()

    expect(mockCore.getIDToken).toHaveBeenCalledWith('test-audience')
    expect(mockCore.setSecret).toHaveBeenCalledWith('mock-access-token')
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'access-token',
      'mock-access-token'
    )
    expect(mockCore.setOutput).toHaveBeenCalledWith('token-type', 'Bearer')
    expect(mockCore.setOutput).toHaveBeenCalledWith('expires-in', 3600)
    expect(mockCore.info).toHaveBeenCalledWith(
      'Access token acquired and set as output.'
    )
    expect(mockCore.setFailed).not.toHaveBeenCalled()

    // Verify the HTTP request body includes audience and scope
    const postCall = mockPost.mock.calls[0]
    expect(postCall[0]).toBe('https://token.example.com/oauth/token')
    const body = new URLSearchParams(postCall[1])
    expect(body.get('grant_type')).toBe(
      'urn:ietf:params:oauth:grant-type:jwt-bearer'
    )
    expect(body.get('assertion')).toBe('mock-oidc-token')
    expect(body.get('client_id')).toBe('client-123')
    expect(body.get('audience')).toBe('api-audience')
    expect(body.get('scope')).toBe('read write')
    expect(postCall[2]).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded'
    })
  })

  it('successfully acquires token without optional parameters', async () => {
    await run()

    expect(mockCore.setSecret).toHaveBeenCalledWith('mock-access-token')
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'access-token',
      'mock-access-token'
    )
    expect(mockCore.setOutput).toHaveBeenCalledWith('token-type', 'Bearer')
    expect(mockCore.setOutput).toHaveBeenCalledWith('expires-in', 3600)
    expect(mockCore.setFailed).not.toHaveBeenCalled()

    // Verify the HTTP request body does not include audience or scope
    const body = new URLSearchParams(mockPost.mock.calls[0][1])
    expect(body.get('audience')).toBeNull()
    expect(body.get('scope')).toBeNull()
  })

  it('does not set expires-in output when not in response', async () => {
    setupHttpResponse(
      JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'Bearer'
      })
    )

    await run()

    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'access-token',
      'mock-access-token'
    )
    expect(mockCore.setOutput).toHaveBeenCalledWith('token-type', 'Bearer')
    expect(mockCore.setOutput).not.toHaveBeenCalledWith(
      'expires-in',
      expect.anything()
    )
    expect(mockCore.setFailed).not.toHaveBeenCalled()
  })

  it('fails when access token is not in response', async () => {
    setupHttpResponse(
      JSON.stringify({
        token_type: 'Bearer'
      })
    )

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Action failed with error: Access token not found in the response'
    )
  })

  it('fails when token type is not in response', async () => {
    setupHttpResponse(
      JSON.stringify({
        access_token: 'mock-access-token'
      })
    )

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Action failed with error: Token type not found in the response'
    )
  })

  it('fails when getIDToken throws an error', async () => {
    mockCore.getIDToken.mockRejectedValue(
      new Error('Unable to get OIDC token')
    )

    await run()

    expect(mockCore.error).toHaveBeenCalledWith(
      'Error message: Unable to get OIDC token'
    )
    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Action failed with error: Unable to get OIDC token'
    )
  })

  it('fails when HTTP request throws an error', async () => {
    mockPost = jest.fn().mockRejectedValue(new Error('Network error'))
    MockHttpClient.mockImplementation(
      () =>
        ({
          post: mockPost
        }) as unknown as HttpClient
    )

    await run()

    expect(mockCore.error).toHaveBeenCalledWith(
      'Error message: Network error'
    )
    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Action failed with error: Network error'
    )
  })

  it('fails when response body is not valid JSON', async () => {
    setupHttpResponse('not valid json')

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Action failed with error:')
    )
  })

  it('handles non-Error exceptions', async () => {
    mockCore.getIDToken.mockRejectedValue('string error')

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Action failed with an unknown error'
    )
  })

  it('logs info messages during execution', async () => {
    await run()

    expect(mockCore.info).toHaveBeenCalledWith(
      'Requesting GitHub OIDC token...'
    )
    expect(mockCore.info).toHaveBeenCalledWith('GitHub OIDC token acquired.')
    expect(mockCore.info).toHaveBeenCalledWith(
      'Requesting access token from the token endpoint on the specified server using jwt-bearer flow.'
    )
    expect(mockCore.info).toHaveBeenCalledWith(
      'Access token acquired and set as output.'
    )
  })
})
