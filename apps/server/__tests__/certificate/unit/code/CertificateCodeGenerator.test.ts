import { describe, expect, test } from 'vite-plus/test';
import { CertificateCodeGenerator } from '../../../../src/certificate/code/CertificateCodeGenerator';

const CodePattern = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/;

describe('CertificateCodeGenerator (generate)', () => {
  test('GIVEN the default random source WHEN generating codes THEN each has the XXXX-XXXX-XX format without ambiguous characters', () => {
    const generator = new CertificateCodeGenerator();

    for (let i = 0; i < 1_000; i += 1) {
      expect(generator.generate()).toMatch(CodePattern);
    }
  });

  test('GIVEN the default random source WHEN generating many codes THEN they are all different', () => {
    const generator = new CertificateCodeGenerator();
    const codes = new Set(
      Array.from({ length: 10_000 }, () => generator.generate()),
    );

    expect(codes.size).toBe(10_000);
  });

  test('GIVEN fixed random bytes WHEN generating THEN maps each byte to the alphabet modulo its length', () => {
    const bytes = Uint8Array.from([0, 1, 2, 3, 31, 32, 33, 255, 8, 30]);
    const generator = new CertificateCodeGenerator({ random: () => bytes });

    expect(generator.generate()).toBe('ABCD-9AB9-J8');
  });

  test('GIVEN the alphabet WHEN checked THEN has 32 distinct symbols without 0, O, 1 or I', () => {
    const { Alphabet } = CertificateCodeGenerator;

    expect(new Set(Alphabet).size).toBe(32);
    expect(Alphabet).not.toMatch(/[0O1I]/);
  });
});
