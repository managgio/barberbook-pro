const GSM_7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
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

const countGsm7Septets = (value: string) => {
  let units = 0;
  for (const character of value) {
    if (GSM_7_BASIC.has(character)) {
      units += 1;
    } else if (GSM_7_EXTENSION.has(character)) {
      units += 2;
    } else {
      return null;
    }
  }
  return units;
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

  const codeUnits = value.length;
  return {
    encoding: 'UCS-2',
    units: codeUnits,
    segments: countSegments(codeUnits, 70, 67),
    singleSegmentLimit: 70,
    concatenatedSegmentLimit: 67,
  };
};
