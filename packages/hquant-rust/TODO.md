重构一下添加指标部分

现有的问题，在nodejs/python，添加指标不方便

期望使用

const macd = quant.indicators.macd()
  .fast(12)
  .slow(26)
  .signal(9)

engine.addIndicator(macd)

packages\hquant-rust\src\lib.rs

QuantEngine中废弃方法
add_ma
add_rsi
add_macd
add_atr
add_boll
add_vri

改造add_indicator支持我希望的使用方式


ffi: 还需要暴露
packages\hquant-rust\src\aggregator\mod.rs、packages\hquant-rust\src\backtest\mod.rs


ring_buffer现在只能循环队列数字，新增一个type_ring_buffer，支持string + number(浮点数) + 整数(1|0)