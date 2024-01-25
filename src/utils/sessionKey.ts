import { hexZeroPad, hexConcat, hexlify, BytesLike } from "ethers/lib/utils";
import { BigNumber } from "ethers";

export interface Rule {
  offset: number;
  condition: number;
  referenceValue: string | BytesLike;
}

export interface Permission {
  destContract: string;
  functionSelector: string;
  valueLimit: BigNumber;
  rules: Rule[];
}

export async function getABISVMSessionKeyData(
  sessionKey: string,
  permission: Permission,
): Promise<string> {
  let sessionKeyData = hexConcat([
    sessionKey,
    permission.destContract,
    permission.functionSelector,
    hexZeroPad(permission.valueLimit.toHexString(), 16),
    hexZeroPad(hexlify(permission.rules.length), 2), // this can't be more 2**11 (see below), so uint16 (2 bytes) is enough
  ]);

  for (let i = 0; i < permission.rules.length; i++) {
    sessionKeyData = hexConcat([
      sessionKeyData,
      hexZeroPad(hexlify(permission.rules[i].offset), 2), // offset is uint16, so there can't be more than 2**16/32 args = 2**11
      hexZeroPad(hexlify(permission.rules[i].condition), 1), // uint8
      permission.rules[i].referenceValue,
    ]);
  }
  return sessionKeyData;
}