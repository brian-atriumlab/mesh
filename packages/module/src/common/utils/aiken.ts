import cbor from 'cbor';

export const encodeAikenScript = (aikenScript: string): string => {
  return cbor.encode(Buffer.from(aikenScript, 'hex')).toString('hex');
};
