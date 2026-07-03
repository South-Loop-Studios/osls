// Types for the Emscripten-generated module (dist/osls-core.mjs is produced by
// build.sh; this declaration lets the facade type-check without it present).
declare module "*/osls-core.mjs" {
    export interface OSLSModule {
        ccall(name: string, returnType: string | null, argTypes: string[], args: unknown[]): any;
        _malloc(size: number): number;
        _free(ptr: number): void;
        getValue(ptr: number, type: string): number;
        setValue(ptr: number, value: number, type: string): void;
        UTF8ToString(ptr: number): string;
    }
    const createOSLSModule: (moduleArg?: Record<string, unknown>) => Promise<OSLSModule>;
    export default createOSLSModule;
}
