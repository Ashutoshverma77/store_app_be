declare module 'bcryptjs' {
  export function genSaltSync(rounds?: number): string;
  export function hashSync(data: string, salt: string | number): string;
  export function compareSync(data: string, encrypted: string): boolean;

  export function genSalt(
    rounds?: number,
    cb: (err: Error | null, salt: string) => void,
  ): void;
  export function hash(
    data: string,
    salt: string | number,
    cb: (err: Error | null, hash: string) => void,
  ): void;
  export function compare(
    data: string,
    encrypted: string,
    cb: (err: Error | null, same: boolean) => void,
  ): void;

  export function hash(data: string, salt: number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}
