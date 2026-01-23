import { createEngine, Engine } from '../src';
import type { BarInput, SignalOutput } from '../src/type';

describe('HQuant Engine', () => {
  // 生成模拟 K 线数据
  const generateBars = (count: number, basePrice = 100): BarInput[] => {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: Date.now() + i * 60000,
      open: basePrice + i,
      high: basePrice + i + 2,
      low: basePrice + i - 1,
      close: basePrice + i + 1,
      volume: 1000 + i * 10,
    }));
  };

  describe('Engine lifecycle and indicators', () => {
    it('should create engine, add indicators, process bars, and reset correctly', () => {
      // 1. 创建引擎
      const engine = createEngine(100);
      expect(engine).toBeDefined();

      // 2. 也可以通过 Engine 类直接创建
      const engine2 = new Engine(50);
      expect(engine2).toBeDefined();

      // 3. 添加不同类型的 MA 指标
      engine.addMa('sma5', 5, 'SMA');
      engine.addMa('ema10', 10, 'EMA');
      engine.addMa('wma3', 3, 'WMA');

      // 4. 指标未就绪时
      expect(engine.indicatorReady('sma5')).toBe(false);
      expect(engine.indicatorValue('sma5')).toBeNull();

      // 5. 追加 K 线直到指标就绪
      const bars = generateBars(12);
      bars.forEach((bar) => {
        engine.appendBar(bar);
      });

      // 6. 指标就绪后可获取值
      expect(engine.indicatorReady('sma5')).toBe(true);
      expect(engine.indicatorReady('ema10')).toBe(true);
      expect(engine.indicatorReady('wma3')).toBe(true);

      const smaValue = engine.indicatorValue('sma5');
      const emaValue = engine.indicatorValue('ema10');
      const wmaValue = engine.indicatorValue('wma3');

      expect(typeof smaValue).toBe('number');
      expect(typeof emaValue).toBe('number');
      expect(typeof wmaValue).toBe('number');

      // 7. 不存在的指标返回 null
      expect(engine.indicatorValue('nonexistent')).toBeNull();
      expect(engine.indicatorReady('nonexistent')).toBe(false);

      // 8. 重置引擎
      engine.reset();
      expect(engine.indicatorReady('sma5')).toBe(false);
      expect(engine.indicatorValue('sma5')).toBeNull();
    });

    it('should handle loadHistory, updateLastBar, and invalid MA type', () => {
      const engine = createEngine(100);
      engine.addMa('sma5', 5, 'SMA');

      // 1. 批量加载历史数据
      const historyBars = generateBars(20);
      engine.loadHistory(historyBars);

      // 指标应该立即就绪
      expect(engine.indicatorReady('sma5')).toBe(true);
      const initialValue = engine.indicatorValue('sma5');
      expect(typeof initialValue).toBe('number');

      // 2. 更新最后一根 K 线
      const updatedBar: BarInput = {
        ...historyBars[historyBars.length - 1],
        close: 200, // 显著改变收盘价
      };
      engine.updateLastBar(updatedBar);

      const updatedValue = engine.indicatorValue('sma5');
      expect(updatedValue).not.toBe(initialValue);

      // 3. appendBar 返回信号数组
      const signals: SignalOutput[] = engine.appendBar(generateBars(1, 150)[0]);
      expect(Array.isArray(signals)).toBe(true);

      // 4. 无效的 MA 类型应抛出错误
      expect(() => {
        engine.addMa('invalid', 5, 'INVALID' as any);
      }).toThrow();
    });
  });
});
