import { describe, expect, test } from 'vite-plus/test';
import { hasParticipantNameField } from '../../../src/template/hasParticipantNameField';

describe('hasParticipantNameField', () => {
  test('GIVEN a name field WHEN checking THEN answers true', () => {
    expect(
      hasParticipantNameField({
        schemas: [[{ type: 'qrcode' }, { type: 'participantName' }]],
      }),
    ).toBe(true);
  });

  test.each([
    { schemas: [[]] },
    { schemas: [[{ type: 'issueDate' }, { type: 'qrcode' }]] },
  ])('GIVEN no name field WHEN checking THEN answers false', (template) => {
    expect(hasParticipantNameField(template)).toBe(false);
  });
});
