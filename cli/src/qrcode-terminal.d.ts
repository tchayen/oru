declare module "qrcode-terminal" {
  interface QRCodeOptions {
    small?: boolean;
  }
  function generate(input: string, opts?: QRCodeOptions, callback?: (code: string) => void): void;
  function generate(input: string, callback?: (code: string) => void): void;
  function setErrorLevel(level: string): void;
  export default { generate, setErrorLevel };
}
