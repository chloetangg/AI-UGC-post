declare module "wawoff2" {
  export function decompress(buffer: Uint8Array | Buffer): Promise<Uint8Array>;
  export function compress(buffer: Uint8Array | Buffer): Promise<Uint8Array>;
  const wawoff2: {
    decompress: typeof decompress;
    compress: typeof compress;
  };
  export default wawoff2;
}
