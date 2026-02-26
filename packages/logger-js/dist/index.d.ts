import pino from 'pino';

/**
 * 初始化服务级 logger
 * @param service 服务名，必须传
 */
declare function createLogger(service: string): {
    child: (scope: string) => pino.Logger<never, boolean>;
    level: pino.LevelWithSilentOrString;
    fatal: pino.LogFn;
    error: pino.LogFn;
    warn: pino.LogFn;
    info: pino.LogFn;
    debug: pino.LogFn;
    trace: pino.LogFn;
    silent: pino.LogFn;
    msgPrefix: string | undefined;
    version: string;
    levels: pino.LevelMapping;
    useLevelLabels: boolean;
    levelVal: number;
    onChild: pino.OnChildCallback<never>;
    on(event: "level-change", listener: pino.LevelChangeEventListener<never, boolean>): pino.Logger<never, boolean>;
    addListener(event: "level-change", listener: pino.LevelChangeEventListener<never, boolean>): pino.Logger<never, boolean>;
    once(event: "level-change", listener: pino.LevelChangeEventListener<never, boolean>): pino.Logger<never, boolean>;
    prependListener(event: "level-change", listener: pino.LevelChangeEventListener<never, boolean>): pino.Logger<never, boolean>;
    prependOnceListener(event: "level-change", listener: pino.LevelChangeEventListener<never, boolean>): pino.Logger<never, boolean>;
    removeListener(event: "level-change", listener: pino.LevelChangeEventListener<never, boolean>): pino.Logger<never, boolean>;
    isLevelEnabled(level: pino.LevelWithSilentOrString): boolean;
    bindings(): pino.Bindings;
    setBindings(bindings: pino.Bindings): void;
    flush(cb?: (err?: Error) => void): void;
    emit<E extends string | symbol>(eventName: string | symbol, ...args: any[]): boolean;
    eventNames(): (string | symbol)[];
    getMaxListeners(): number;
    listenerCount<E extends string | symbol>(eventName: string | symbol, listener?: ((...args: any[]) => void) | undefined): number;
    listeners<E extends string | symbol>(eventName: string | symbol): ((...args: any[]) => void)[];
    off<E extends string | symbol>(eventName: string | symbol, listener: (...args: any[]) => void): pino.Logger<never, boolean>;
    rawListeners<E extends string | symbol>(eventName: string | symbol): ((...args: any[]) => void)[];
    removeAllListeners<E extends string | symbol>(eventName?: string | symbol | undefined): pino.Logger<never, boolean>;
    setMaxListeners(n: number): pino.Logger<never, boolean>;
    [EventEmitter.captureRejectionSymbol]?(error: Error, event: string | symbol, ...args: any[]): void;
    customLevels: {};
    useOnlyCustomLevels: boolean;
};

export { createLogger };
