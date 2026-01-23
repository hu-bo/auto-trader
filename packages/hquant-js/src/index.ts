import { join } from 'path';
import type { BarInput, SignalOutput, MAType, IEngine } from './types';

// 加载原生模块
const nativeModule = require(join(__dirname, '..', 'native', 'hquant.node'));

/** 原生 Engine 类 */
const NativeEngine: new (capacity: number) => IEngine = nativeModule.Engine;

/** 创建量化引擎实例 */
export function createEngine(capacity: number = 1000): IEngine {
  return new NativeEngine(capacity);
}

/** 导出 Engine 类供直接使用 */
export const Engine = NativeEngine;

/** 导出类型 */
export type { BarInput, SignalOutput, MAType, IEngine };
