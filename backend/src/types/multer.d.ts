declare module "multer" {
  export function diskStorage(options: {
    destination?: (
      request: unknown,
      file: { originalname: string; mimetype: string },
      callback: (error: Error | null, destination: string) => void,
    ) => void;
    filename?: (
      request: unknown,
      file: { originalname: string; mimetype: string },
      callback: (error: Error | null, filename: string) => void,
    ) => void;
  }): unknown;
}
