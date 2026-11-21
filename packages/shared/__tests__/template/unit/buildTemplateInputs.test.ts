import { describe, expect, test } from 'vite-plus/test';
import {
  buildTemplateInputs,
  type TemplateValues,
} from '../../../src/template/buildTemplateInputs';
import { TemplateFieldTypeEnum } from '../../../src/template/TemplateFieldTypeEnum';

const Values: TemplateValues = {
  [TemplateFieldTypeEnum.ParticipantName]: 'María José Núñez',
  [TemplateFieldTypeEnum.IssueDate]: 'November 19, 2026',
  [TemplateFieldTypeEnum.QrCode]: 'https://certs.example.org/c/ABCD-EFGH-JK',
};

describe('buildTemplateInputs', () => {
  test('GIVEN one field per type WHEN building THEN each field gets the value of its type', () => {
    const inputs = buildTemplateInputs(
      [
        [
          { name: 'Name', type: 'participantName' },
          { name: 'Date', type: 'issueDate' },
          { name: 'QR', type: 'qrcode' },
        ],
      ],
      Values,
    );

    expect(inputs).toEqual([
      {
        Name: 'María José Núñez',
        Date: 'November 19, 2026',
        QR: 'https://certs.example.org/c/ABCD-EFGH-JK',
      },
    ]);
  });

  test('GIVEN renamed and repeated fields WHEN building THEN binds them by type, not name', () => {
    const inputs = buildTemplateInputs(
      [
        [
          { name: 'Top date', type: 'issueDate' },
          { name: 'Bottom date', type: 'issueDate' },
        ],
      ],
      Values,
    );

    expect(inputs).toEqual([
      { 'Top date': 'November 19, 2026', 'Bottom date': 'November 19, 2026' },
    ]);
  });

  test('GIVEN a field of an unknown type WHEN building THEN gives it an empty value', () => {
    const inputs = buildTemplateInputs(
      [[{ name: 'Other', type: 'text' }]],
      Values,
    );

    expect(inputs).toEqual([{ Other: '' }]);
  });

  test('GIVEN no fields WHEN building THEN gives one empty input', () => {
    expect(buildTemplateInputs([[]], Values)).toEqual([{}]);
  });
});
