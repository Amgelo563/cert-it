import { describe, expect, test } from 'vite-plus/test';
import { LinkedInProfileLink } from '../../../../src/certificate/page/LinkedInProfileLink';

const certification = {
  name: 'Applied Statistics',
  issueDate: '2026-03-09',
  code: 'ABCD-2345',
  url: 'https://example.org/certs/c/ABCD-2345',
};

function build(overrides: Partial<typeof certification> = {}): URL {
  const link = new LinkedInProfileLink({ organizationId: '1234567' });
  return new URL(link.build({ ...certification, ...overrides }));
}

describe('LinkedInProfileLink', () => {
  test('GIVEN a certification WHEN building its link THEN opens the certification form on LinkedIn', () => {
    const url = build();

    expect(url.origin + url.pathname).toBe(
      'https://www.linkedin.com/profile/add',
    );
    expect(url.searchParams.get('startTask')).toBe('CERTIFICATION_NAME');
  });

  test('GIVEN a certification WHEN building its link THEN fills in its name, issuer, date, code and URL', () => {
    const url = build();

    expect(Object.fromEntries(url.searchParams)).toEqual({
      startTask: 'CERTIFICATION_NAME',
      name: 'Applied Statistics',
      organizationId: '1234567',
      issueYear: '2026',
      issueMonth: '3',
      certUrl: 'https://example.org/certs/c/ABCD-2345',
      certId: 'ABCD-2345',
    });
  });

  test('GIVEN a December date WHEN building the link THEN the month is 12', () => {
    expect(
      build({ issueDate: '2026-12-31' }).searchParams.get('issueMonth'),
    ).toBe('12');
  });

  test('GIVEN a name with spaces, a plus and an ampersand WHEN building the link THEN encodes them', () => {
    const url = build({ name: 'C++ & Data Science' });

    expect(url.search).toContain('name=C%2B%2B%20%26%20Data%20Science');
    expect(url.search).not.toContain('+');
    expect(url.searchParams.get('name')).toBe('C++ & Data Science');
  });
});
