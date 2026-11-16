import { describe, it, expect } from 'vitest';
import { appBaseUrl } from './authRedirect.js';

const at = (href) => { const u = new URL(href); return { origin: u.origin, pathname: u.pathname }; };

describe('appBaseUrl', () => {
  it('GitHub Pages project path', () => {
    expect(appBaseUrl(at('https://skatehappy.github.io/IceBooks-Pro/'))).toBe('https://skatehappy.github.io/IceBooks-Pro/');
  });
  it('drops index.html', () => {
    expect(appBaseUrl(at('https://skatehappy.github.io/IceBooks-Pro/index.html'))).toBe('https://skatehappy.github.io/IceBooks-Pro/');
  });
  it('adds trailing slash to directory-like path', () => {
    expect(appBaseUrl(at('https://skatehappy.github.io/IceBooks-Pro'))).toBe('https://skatehappy.github.io/IceBooks-Pro/');
  });
  it('localhost dev', () => {
    expect(appBaseUrl(at('http://localhost:5173/'))).toBe('http://localhost:5173/');
    expect(appBaseUrl(at('http://localhost:5173'))).toBe('http://localhost:5173/');
  });
  it('strips query and hash', () => {
    expect(appBaseUrl(at('https://skatehappy.github.io/IceBooks-Pro/?x=1#access_token=abc&type=signup')))
      .toBe('https://skatehappy.github.io/IceBooks-Pro/');
    expect(appBaseUrl(at('http://localhost:5173/index.html?a=b#c'))).toBe('http://localhost:5173/');
  });
  it('never returns the bare origin for the Pages app', () => {
    expect(appBaseUrl(at('https://skatehappy.github.io/IceBooks-Pro/index.html#x'))).not.toBe('https://skatehappy.github.io/');
  });
});
