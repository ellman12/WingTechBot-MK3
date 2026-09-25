//Compile-time equality check between two types. Usage: `const _ok: Equals<A, B> = true;`
export type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
