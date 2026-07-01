import { describe, it, expect } from 'vitest';
import { parseGitHubRepo } from '../github';

describe('parseGitHubRepo', () => {
  it('parses a standard https github URL', () => {
    expect(parseGitHubRepo('https://github.com/brett-buskirk/helm')).toEqual({ owner: 'brett-buskirk', repo: 'helm' });
  });

  it('parses URLs with extra path, query, or hash', () => {
    expect(parseGitHubRepo('https://github.com/facebook/react/tree/main')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubRepo('github.com/vercel/next.js/issues?q=open')).toEqual({ owner: 'vercel', repo: 'next.js' });
  });

  it('strips a trailing .git and www', () => {
    expect(parseGitHubRepo('https://www.github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('returns null for non-GitHub or empty URLs', () => {
    expect(parseGitHubRepo('https://gitlab.com/owner/repo')).toBeNull();
    expect(parseGitHubRepo('https://console.cloud.google.com')).toBeNull();
    expect(parseGitHubRepo('')).toBeNull();
    expect(parseGitHubRepo(undefined)).toBeNull();
    expect(parseGitHubRepo('github.com/owner')).toBeNull();
  });
});
