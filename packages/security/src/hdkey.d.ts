// Ambient type declaration for hdkey (CJS module, no bundled types)
declare module 'hdkey' {
  interface HDNode {
    privateKey: Buffer | null;
    publicKey: Buffer;
    chainCode: Buffer;
    depth: number;
    index: number;
    publicExtendedKey: string;
    privateExtendedKey: string;
    derive(path: string): HDNode;
  }

  interface HDKeyStatic {
    fromMasterSeed(seed: Buffer): HDNode;
    fromExtendedKey(base58Key: string): HDNode;
    new(): HDNode;
  }

  const HDKey: HDKeyStatic;
  export = HDKey;
}
