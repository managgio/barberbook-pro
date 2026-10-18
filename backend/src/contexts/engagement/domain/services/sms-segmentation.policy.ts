const GSM_7_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM_7_EXTENSION = new Set('^{}\\[~]|€');

export const SMS_MAX_STANDARD_SEGMENTS = 3;

export type SmsSegmentation = {
  encoding: 'GSM-7' | 'UCS-2';
  units: number;
  segments: number;
  singleSegmentLimit: number;
  concatenatedSegmentLimit: number;
};

export const countGsm7CharacterSeptets = (character: string) => {
  if (GSM_7_BASIC.has(character)) return 1;
  if (GSM_7_EXTENSION.has(character)) return 2;
  return null;
};

export const countGsm7Septets = (value: string) => {
  let count = 0;
  for (const character of value) {
    const characterSeptets = countGsm7CharacterSeptets(character);
    if (characterSeptets === null) return null;
    count += characterSeptets;
  }
  return count;
};

const countSegments = (units: number, singleLimit: number, concatenatedLimit: number) => {
  if (units === 0) return 0;
  return units <= singleLimit ? 1 : Math.ceil(units / concatenatedLimit);
};

export const analyzeSmsSegmentation = (value: string): SmsSegmentation => {
  const gsmSeptets = countGsm7Septets(value);
  if (gsmSeptets !== null) {
    return {
      encoding: 'GSM-7',
      units: gsmSeptets,
      segments: countSegments(gsmSeptets, 160, 153),
      singleSegmentLimit: 160,
      concatenatedSegmentLimit: 153,
    };
  }

  // Providers encode non-GSM messages as UCS-2 and bill by UTF-16 code unit.
  const codeUnits = value.length;
  return {
    encoding: 'UCS-2',
    units: codeUnits,
    segments: countSegments(codeUnits, 70, 67),
    singleSegmentLimit: 70,
    concatenatedSegmentLimit: 67,
  };
};
