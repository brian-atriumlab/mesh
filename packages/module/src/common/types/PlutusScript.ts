import { Script, ScriptType } from '@harmoniclabs/plu-ts';

export const ALL_PLUTUS_VERSIONS = {
  V1: ScriptType.PlutusV1,
  V2: ScriptType.PlutusV2,
};

export type PlutusScript = {
  version: PlutusVersion;
  code: string;
};

export type PlutusVersion = keyof typeof ALL_PLUTUS_VERSIONS;

export const fromScript = (script: string | Script): PlutusScript => {
  if (typeof script === 'string') {
    return fromScript(Script.fromCbor(script));
  }

  const version = Object.keys(ALL_PLUTUS_VERSIONS)
    .find((key) => ALL_PLUTUS_VERSIONS[key] === script.type);

  if (version !== undefined) {
    return {
      version: version as PlutusVersion,
      code: script.cbor.toString(),
    };
  }

  throw new Error('Invalid Plutus Script');
};

export const toScript = (plutusScript: PlutusScript): Script => {
  return Script.fromCbor(plutusScript.code, ALL_PLUTUS_VERSIONS[plutusScript.version]);
};
