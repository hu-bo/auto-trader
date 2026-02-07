"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/react/index.ts
var react_exports = {};
__export(react_exports, {
  BUILT_IN_INDICATORS: () => BUILT_IN_INDICATORS,
  BaseDatafeed: () => BaseDatafeed,
  DEFAULT_PERIODS: () => DEFAULT_PERIODS,
  DRAWING_TOOL_GROUPS: () => DRAWING_TOOL_GROUPS,
  DefaultDatafeed: () => DefaultDatafeed,
  IndicatorModal: () => IndicatorModal,
  KLineChart: () => KLineChart,
  KLineChartPro: () => KLineChartPro,
  createChartInstance: () => createChartInstance,
  darkTheme: () => darkTheme,
  enUS: () => enUS,
  getDefaultMainIndicators: () => getDefaultMainIndicators,
  getDefaultSubIndicators: () => getDefaultSubIndicators,
  lightTheme: () => lightTheme,
  zhCN: () => zhCN,
  zhTW: () => zhTW
});
module.exports = __toCommonJS(react_exports);

// src/react/KLineChart.tsx
var import_react = require("react");

// src/core/KLineChartPro.ts
var import_klinecharts = require("klinecharts");

// src/core/defaults.ts
var DEFAULT_PERIODS = [
  { span: 1, type: "minute", text: "1m" },
  { span: 5, type: "minute", text: "5m" },
  { span: 15, type: "minute", text: "15m" },
  { span: 30, type: "minute", text: "30m" },
  { span: 1, type: "hour", text: "1H" },
  { span: 4, type: "hour", text: "4H" },
  { span: 1, type: "day", text: "1D" },
  { span: 1, type: "week", text: "1W" },
  { span: 1, type: "month", text: "1M" }
];
function getDefaultMainIndicators() {
  return ["MA"];
}
function getDefaultSubIndicators() {
  return ["VOL"];
}
var BUILT_IN_INDICATORS = {
  main: ["MA", "EMA", "SMA", "BOLL", "SAR", "BBI", "VWAP"],
  sub: [
    "VOL",
    "MACD",
    "KDJ",
    "RSI",
    "BIAS",
    "BRAR",
    "CCI",
    "DMI",
    "CR",
    "PSY",
    "DMA",
    "TRIX",
    "OBV",
    "VR",
    "WR",
    "MTM",
    "EMV",
    "SAR",
    "AO",
    "ROC",
    "PVT",
    "AVP"
  ]
};
var DRAWING_TOOL_GROUPS = [
  {
    name: "line",
    icon: "line",
    tools: [
      { name: "horizontalRayLine", icon: "horizontal-ray-line", overlayName: "horizontalRayLine" },
      { name: "horizontalSegment", icon: "horizontal-segment", overlayName: "horizontalSegment" },
      { name: "horizontalStraightLine", icon: "horizontal-straight-line", overlayName: "horizontalStraightLine" },
      { name: "verticalRayLine", icon: "vertical-ray-line", overlayName: "verticalRayLine" },
      { name: "verticalSegment", icon: "vertical-segment", overlayName: "verticalSegment" },
      { name: "verticalStraightLine", icon: "vertical-straight-line", overlayName: "verticalStraightLine" },
      { name: "rayLine", icon: "ray-line", overlayName: "rayLine" },
      { name: "segment", icon: "segment", overlayName: "segment" },
      { name: "straightLine", icon: "straight-line", overlayName: "straightLine" },
      { name: "priceLine", icon: "price-line", overlayName: "priceLine" },
      { name: "priceChannelLine", icon: "price-channel-line", overlayName: "priceChannelLine" },
      { name: "parallelStraightLine", icon: "parallel-straight-line", overlayName: "parallelStraightLine" }
    ]
  },
  {
    name: "fibonacci",
    icon: "fibonacci",
    tools: [
      { name: "fibonacciLine", icon: "fibonacci-line", overlayName: "fibonacciLine" },
      { name: "fibonacciSegment", icon: "fibonacci-segment", overlayName: "fibonacciSegment" },
      { name: "fibonacciCircle", icon: "fibonacci-circle", overlayName: "fibonacciCircle" },
      { name: "fibonacciSpiral", icon: "fibonacci-spiral", overlayName: "fibonacciSpiral" },
      { name: "fibonacciSpeedResistanceFan", icon: "fibonacci-speed-resistance-fan", overlayName: "fibonacciSpeedResistanceFan" },
      { name: "fibonacciExtension", icon: "fibonacci-extension", overlayName: "fibonacciExtension" }
    ]
  },
  {
    name: "wave",
    icon: "wave",
    tools: [
      { name: "xabcd", icon: "xabcd", overlayName: "xabcd" },
      { name: "abcd", icon: "abcd", overlayName: "abcd" },
      { name: "threeWaves", icon: "three-waves", overlayName: "threeWaves" },
      { name: "fiveWaves", icon: "five-waves", overlayName: "fiveWaves" },
      { name: "eightWaves", icon: "eight-waves", overlayName: "eightWaves" },
      { name: "anyWaves", icon: "any-waves", overlayName: "anyWaves" }
    ]
  },
  {
    name: "annotation",
    icon: "annotation",
    tools: [
      { name: "simpleAnnotation", icon: "simple-annotation", overlayName: "simpleAnnotation" },
      { name: "simpleTag", icon: "simple-tag", overlayName: "simpleTag" }
    ]
  }
];
var DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// src/themes/index.ts
var lightTheme = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      size: 1,
      color: "#EDEDED"
    },
    vertical: {
      show: true,
      size: 1,
      color: "#EDEDED"
    }
  },
  candle: {
    bar: {
      upColor: "#26A69A",
      downColor: "#EF5350",
      noChangeColor: "#666666",
      upBorderColor: "#26A69A",
      downBorderColor: "#EF5350",
      noChangeBorderColor: "#666666",
      upWickColor: "#26A69A",
      downWickColor: "#EF5350",
      noChangeWickColor: "#666666"
    },
    priceMark: {
      show: true,
      high: {
        show: true,
        color: "#76808F",
        textOffset: 5,
        textSize: 10,
        textFamily: "Helvetica Neue",
        textWeight: "normal"
      },
      low: {
        show: true,
        color: "#76808F",
        textOffset: 5,
        textSize: 10,
        textFamily: "Helvetica Neue",
        textWeight: "normal"
      },
      last: {
        show: true,
        upColor: "#26A69A",
        downColor: "#EF5350",
        noChangeColor: "#666666",
        line: {
          show: true,
          size: 1
        },
        text: {
          show: true,
          size: 12,
          paddingLeft: 4,
          paddingTop: 4,
          paddingRight: 4,
          paddingBottom: 4,
          color: "#FFFFFF",
          family: "Helvetica Neue",
          weight: "normal",
          borderRadius: 2
        }
      }
    },
    tooltip: {
      rect: {
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        offsetLeft: 4,
        offsetTop: 4,
        offsetRight: 4,
        offsetBottom: 4,
        borderRadius: 4,
        borderSize: 1,
        borderColor: "#F2F3F5",
        color: "#FEFEFE"
      },
      legend: {
        defaultValue: "n/a",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        color: "#76808F",
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4
      }
    }
  },
  indicator: {
    ohlc: {
      upColor: "#26A69A",
      downColor: "#EF5350",
      noChangeColor: "#666666"
    },
    lines: [
      { size: 1, color: "#FF9600" },
      { size: 1, color: "#935EBD" },
      { size: 1, color: "#2196F3" },
      { size: 1, color: "#E11D74" },
      { size: 1, color: "#01C5C4" }
    ],
    tooltip: {
      title: {
        showName: true,
        showParams: true
      },
      legend: {
        defaultValue: "n/a",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        color: "#76808F",
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4
      }
    }
  },
  xAxis: {
    show: true,
    axisLine: {
      show: true,
      color: "#DDDDDD",
      size: 1
    },
    tickText: {
      show: true,
      color: "#76808F",
      family: "Helvetica Neue",
      weight: "normal",
      size: 12,
      marginStart: 4,
      marginEnd: 4
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: "#DDDDDD"
    }
  },
  yAxis: {
    show: true,
    axisLine: {
      show: true,
      color: "#DDDDDD",
      size: 1
    },
    tickText: {
      show: true,
      color: "#76808F",
      family: "Helvetica Neue",
      weight: "normal",
      size: 12,
      marginStart: 4,
      marginEnd: 4
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: "#DDDDDD"
    }
  },
  separator: {
    size: 1,
    color: "#DDDDDD",
    fill: true,
    activeBackgroundColor: "rgba(33, 150, 243, 0.08)"
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: {
        show: true,
        size: 1,
        color: "#76808F"
      },
      text: {
        show: true,
        color: "#FFFFFF",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        borderSize: 1,
        borderColor: "#686D76",
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: "#686D76"
      }
    },
    vertical: {
      show: true,
      line: {
        show: true,
        size: 1,
        color: "#76808F"
      },
      text: {
        show: true,
        color: "#FFFFFF",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        borderSize: 1,
        borderColor: "#686D76",
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: "#686D76"
      }
    }
  },
  overlay: {
    point: {
      color: "#1677FF",
      borderColor: "rgba(22, 119, 255, 0.35)",
      borderSize: 1,
      radius: 5,
      activeColor: "#1677FF",
      activeBorderColor: "rgba(22, 119, 255, 0.35)",
      activeBorderSize: 3,
      activeRadius: 5
    },
    line: {
      color: "#1677FF",
      size: 1
    },
    rect: {
      color: "rgba(22, 119, 255, 0.25)",
      borderColor: "#1677FF",
      borderSize: 1,
      borderRadius: 0
    },
    polygon: {
      color: "rgba(22, 119, 255, 0.25)",
      borderColor: "#1677FF",
      borderSize: 1
    },
    circle: {
      color: "rgba(22, 119, 255, 0.25)",
      borderColor: "#1677FF",
      borderSize: 1
    },
    arc: {
      color: "#1677FF",
      size: 1
    },
    text: {
      color: "#FFFFFF",
      size: 12,
      family: "Helvetica Neue",
      weight: "normal",
      borderSize: 0,
      borderRadius: 2,
      borderColor: "#1677FF",
      paddingLeft: 4,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4,
      backgroundColor: "#1677FF"
    }
  }
};
var darkTheme = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      size: 1,
      color: "#292929"
    },
    vertical: {
      show: true,
      size: 1,
      color: "#292929"
    }
  },
  candle: {
    bar: {
      upColor: "#26A69A",
      downColor: "#EF5350",
      noChangeColor: "#888888",
      upBorderColor: "#26A69A",
      downBorderColor: "#EF5350",
      noChangeBorderColor: "#888888",
      upWickColor: "#26A69A",
      downWickColor: "#EF5350",
      noChangeWickColor: "#888888"
    },
    priceMark: {
      show: true,
      high: {
        show: true,
        color: "#929AA5",
        textOffset: 5,
        textSize: 10,
        textFamily: "Helvetica Neue",
        textWeight: "normal"
      },
      low: {
        show: true,
        color: "#929AA5",
        textOffset: 5,
        textSize: 10,
        textFamily: "Helvetica Neue",
        textWeight: "normal"
      },
      last: {
        show: true,
        upColor: "#26A69A",
        downColor: "#EF5350",
        noChangeColor: "#888888",
        line: {
          show: true,
          size: 1
        },
        text: {
          show: true,
          size: 12,
          paddingLeft: 4,
          paddingTop: 4,
          paddingRight: 4,
          paddingBottom: 4,
          color: "#FFFFFF",
          family: "Helvetica Neue",
          weight: "normal",
          borderRadius: 2
        }
      }
    },
    tooltip: {
      rect: {
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        offsetLeft: 4,
        offsetTop: 4,
        offsetRight: 4,
        offsetBottom: 4,
        borderRadius: 4,
        borderSize: 1,
        borderColor: "#3D3D3D",
        color: "#1F1F1F"
      },
      legend: {
        defaultValue: "n/a",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        color: "#929AA5",
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4
      }
    }
  },
  indicator: {
    ohlc: {
      upColor: "#26A69A",
      downColor: "#EF5350",
      noChangeColor: "#888888"
    },
    lines: [
      { size: 1, color: "#FF9600" },
      { size: 1, color: "#935EBD" },
      { size: 1, color: "#2196F3" },
      { size: 1, color: "#E11D74" },
      { size: 1, color: "#01C5C4" }
    ],
    tooltip: {
      title: {
        showName: true,
        showParams: true
      },
      legend: {
        defaultValue: "n/a",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        color: "#929AA5",
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4
      }
    }
  },
  xAxis: {
    show: true,
    axisLine: {
      show: true,
      color: "#3D3D3D",
      size: 1
    },
    tickText: {
      show: true,
      color: "#929AA5",
      family: "Helvetica Neue",
      weight: "normal",
      size: 12,
      marginStart: 4,
      marginEnd: 4
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: "#3D3D3D"
    }
  },
  yAxis: {
    show: true,
    axisLine: {
      show: true,
      color: "#3D3D3D",
      size: 1
    },
    tickText: {
      show: true,
      color: "#929AA5",
      family: "Helvetica Neue",
      weight: "normal",
      size: 12,
      marginStart: 4,
      marginEnd: 4
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: "#3D3D3D"
    }
  },
  separator: {
    size: 1,
    color: "#3D3D3D",
    fill: true,
    activeBackgroundColor: "rgba(33, 150, 243, 0.08)"
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: {
        show: true,
        size: 1,
        color: "#929AA5"
      },
      text: {
        show: true,
        color: "#FFFFFF",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        borderSize: 1,
        borderColor: "#686D76",
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: "#686D76"
      }
    },
    vertical: {
      show: true,
      line: {
        show: true,
        size: 1,
        color: "#929AA5"
      },
      text: {
        show: true,
        color: "#FFFFFF",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        borderSize: 1,
        borderColor: "#686D76",
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: "#686D76"
      }
    }
  },
  overlay: {
    point: {
      color: "#1677FF",
      borderColor: "rgba(22, 119, 255, 0.35)",
      borderSize: 1,
      radius: 5,
      activeColor: "#1677FF",
      activeBorderColor: "rgba(22, 119, 255, 0.35)",
      activeBorderSize: 3,
      activeRadius: 5
    },
    line: {
      color: "#1677FF",
      size: 1
    },
    rect: {
      color: "rgba(22, 119, 255, 0.25)",
      borderColor: "#1677FF",
      borderSize: 1,
      borderRadius: 0
    },
    polygon: {
      color: "rgba(22, 119, 255, 0.25)",
      borderColor: "#1677FF",
      borderSize: 1
    },
    circle: {
      color: "rgba(22, 119, 255, 0.25)",
      borderColor: "#1677FF",
      borderSize: 1
    },
    arc: {
      color: "#1677FF",
      size: 1
    },
    text: {
      color: "#FFFFFF",
      size: 12,
      family: "Helvetica Neue",
      weight: "normal",
      borderSize: 0,
      borderRadius: 2,
      borderColor: "#1677FF",
      paddingLeft: 4,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4,
      backgroundColor: "#1677FF"
    }
  }
};

// src/locales/index.ts
var zhCN = {
  time: "\u65F6\u95F4",
  open: "\u5F00",
  high: "\u9AD8",
  low: "\u4F4E",
  close: "\u6536",
  volume: "\u6210\u4EA4\u91CF",
  turnover: "\u6210\u4EA4\u989D",
  change: "\u6DA8\u8DCC\u5E45",
  second: "\u79D2",
  minute: "\u5206",
  hour: "\u65F6",
  day: "\u65E5",
  week: "\u5468",
  month: "\u6708",
  year: "\u5E74"
};
var zhTW = {
  time: "\u6642\u9593",
  open: "\u958B",
  high: "\u9AD8",
  low: "\u4F4E",
  close: "\u6536",
  volume: "\u6210\u4EA4\u91CF",
  turnover: "\u6210\u4EA4\u984D",
  change: "\u6F32\u8DCC\u5E45",
  second: "\u79D2",
  minute: "\u5206",
  hour: "\u6642",
  day: "\u65E5",
  week: "\u9031",
  month: "\u6708",
  year: "\u5E74"
};
var enUS = {
  time: "Time",
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
  volume: "Volume",
  turnover: "Turnover",
  change: "Change",
  second: "s",
  minute: "m",
  hour: "h",
  day: "D",
  week: "W",
  month: "M",
  year: "Y"
};

// src/core/KLineChartPro.ts
var KLineChartPro = class {
  constructor(options) {
    this.chart = null;
    this.currentTheme = "light";
    this.currentLocale = "en-US";
    this.currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.subPaneIds = /* @__PURE__ */ new Map();
    this.actionCallbacks = /* @__PURE__ */ new Map();
    this.markerGroupId = "trade_markers";
    const containerElement = typeof options.container === "string" ? document.getElementById(options.container) : options.container;
    if (!containerElement) {
      throw new Error("Container element not found");
    }
    this.container = containerElement;
    this.datafeed = options.datafeed;
    this.currentSymbol = options.symbol;
    this.currentPeriod = options.period;
    this.periods = options.periods || DEFAULT_PERIODS;
    this.mainIndicators = options.mainIndicators || getDefaultMainIndicators();
    this.subIndicators = options.subIndicators || getDefaultSubIndicators();
    if (options.theme) {
      this.currentTheme = options.theme;
    }
    if (options.locale) {
      this.currentLocale = options.locale;
    }
    if (options.timezone) {
      this.currentTimezone = options.timezone;
    }
    this.registerBuiltinLocales();
    this.registerBuiltinThemes();
    this.initChart(options);
  }
  registerBuiltinLocales() {
    (0, import_klinecharts.registerLocale)("zh-CN", zhCN);
    (0, import_klinecharts.registerLocale)("zh-TW", zhTW);
    (0, import_klinecharts.registerLocale)("en-US", enUS);
  }
  registerBuiltinThemes() {
    (0, import_klinecharts.registerStyles)("dark", darkTheme);
    (0, import_klinecharts.registerStyles)("light", lightTheme);
  }
  initChart(options) {
    this.chart = (0, import_klinecharts.init)(this.container, {
      locale: this.currentLocale,
      timezone: this.currentTimezone,
      styles: options.styles
    });
    if (!this.chart) {
      throw new Error("Failed to initialize chart");
    }
    this.setTheme(this.currentTheme);
    this.mainIndicators.forEach((indicator) => {
      this.chart?.createIndicator(indicator, false, { id: "candle_pane" });
    });
    this.subIndicators.forEach((indicator) => {
      const paneId = this.chart?.createIndicator(indicator, true);
      if (paneId && typeof paneId === "string") {
        this.subPaneIds.set(indicator, paneId);
      }
    });
    if (options.watermark) {
      this.setWatermark(options.watermark);
    }
    this.setupChartEvents();
    this.setupDataLoader();
    this.chart.setSymbol(this.currentSymbol);
    this.chart.setPeriod(this.currentPeriod);
  }
  /**
   * v10: Use setDataLoader instead of setLoadDataCallback / applyNewData / updateData.
   * getBars handles initial load + backward/forward scrolling.
   * subscribeBar / unsubscribeBar handle real-time updates.
   */
  setupDataLoader() {
    if (!this.chart) return;
    const self = this;
    this.chart.setDataLoader({
      getBars: async ({ type, timestamp, symbol, period, callback }) => {
        const extPeriod = self.findPeriod(period) || self.currentPeriod;
        if (type === "init" || type === "forward") {
          const now = Date.now();
          const from = now - self.getPeriodDuration(extPeriod) * 500;
          try {
            const data = await self.datafeed.getHistoryKLineData(
              symbol,
              extPeriod,
              from,
              now
            );
            callback(data, data.length > 0);
          } catch (err) {
            console.error("Failed to load data:", err);
            callback([], false);
          }
        } else if (type === "backward") {
          const earliestTimestamp = timestamp ?? Date.now();
          const duration = self.getPeriodDuration(extPeriod) * 500;
          const from = earliestTimestamp - duration;
          try {
            const data = await self.datafeed.getHistoryKLineData(
              symbol,
              extPeriod,
              from,
              earliestTimestamp
            );
            callback(data, data.length > 0);
          } catch (err) {
            console.error("Failed to load more data:", err);
            callback([], false);
          }
        } else {
          callback([], false);
        }
      },
      subscribeBar: ({ symbol, period, callback }) => {
        const extPeriod = self.findPeriod(period) || self.currentPeriod;
        self.datafeed.subscribe(symbol, extPeriod, callback);
      },
      unsubscribeBar: ({ symbol, period }) => {
        const extPeriod = self.findPeriod(period) || self.currentPeriod;
        self.datafeed.unsubscribe(symbol, extPeriod);
      }
    });
  }
  /** Find our extended Period (with text) matching a klinecharts Period */
  findPeriod(kcPeriod) {
    return this.periods.find(
      (p) => p.type === kcPeriod.type && p.span === kcPeriod.span
    );
  }
  setupChartEvents() {
    if (!this.chart) return;
    this.chart.subscribeAction("onCrosshairChange", (data) => {
      this.emitAction("onCrosshairChange", data);
    });
    this.chart.subscribeAction("onZoom", (data) => {
      this.emitAction("onZoom", data);
    });
    this.chart.subscribeAction("onScroll", (data) => {
      this.emitAction("onScroll", data);
    });
    this.chart.subscribeAction("onCandleBarClick", (data) => {
      const partial = data;
      const event = {
        dataIndex: typeof partial?.dataIndex === "number" ? partial.dataIndex : -1,
        x: typeof partial?.x === "number" ? partial.x : 0,
        data: partial?.data || null
      };
      this.emitAction("onBarClick", event);
    });
  }
  emitAction(type, data) {
    const callbacks = this.actionCallbacks.get(type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }
  getPeriodDuration(period) {
    const p = period || this.currentPeriod;
    const multipliers = {
      second: 1e3,
      minute: 60 * 1e3,
      hour: 60 * 60 * 1e3,
      day: 24 * 60 * 60 * 1e3,
      week: 7 * 24 * 60 * 60 * 1e3,
      month: 30 * 24 * 60 * 60 * 1e3,
      year: 365 * 24 * 60 * 60 * 1e3
    };
    return (multipliers[p.type] || 60 * 1e3) * p.span;
  }
  setTheme(theme) {
    if (!this.chart) return;
    this.currentTheme = theme;
    this.chart.setStyles(theme);
  }
  getTheme() {
    return this.currentTheme;
  }
  setStyles(styles) {
    this.chart?.setStyles(styles);
  }
  getStyles() {
    return this.chart?.getStyles() || null;
  }
  setLocale(locale) {
    if (!this.chart) return;
    this.currentLocale = locale;
    this.chart.setLocale(locale);
  }
  getLocale() {
    return this.currentLocale;
  }
  setTimezone(timezone) {
    if (!this.chart) return;
    this.currentTimezone = timezone;
    this.chart.setTimezone(timezone);
  }
  getTimezone() {
    return this.currentTimezone;
  }
  setSymbol(symbol) {
    const oldSymbol = this.currentSymbol;
    this.currentSymbol = symbol;
    this.chart?.setSymbol(symbol);
    this.emitAction("onSymbolChange", { oldSymbol, newSymbol: symbol });
  }
  getSymbol() {
    return this.currentSymbol;
  }
  setPeriod(period) {
    const oldPeriod = this.currentPeriod;
    this.currentPeriod = period;
    this.chart?.setPeriod(period);
    this.emitAction("onPeriodChange", { oldPeriod, newPeriod: period });
  }
  getPeriod() {
    return this.currentPeriod;
  }
  getPeriods() {
    return this.periods;
  }
  setWatermark(watermark) {
    if (!this.chart) return;
    if (typeof watermark === "string") {
      this.chart.createOverlay({
        name: "simpleAnnotation",
        extendData: watermark,
        styles: {
          text: {
            color: "rgba(128, 128, 128, 0.1)",
            size: 48,
            weight: "bold"
          }
        }
      });
    }
  }
  createIndicator(indicator, isStack, paneOptions) {
    if (!this.chart) return null;
    const result = this.chart.createIndicator(indicator, isStack ?? false, paneOptions);
    if (result && typeof indicator === "string") {
      const paneId = Array.isArray(result) ? result[0] : result;
      if (paneId) {
        this.subPaneIds.set(indicator, paneId);
      }
    }
    return Array.isArray(result) ? result[0] || null : result;
  }
  removeIndicator(paneId, name) {
    this.chart?.removeIndicator({ paneId, name });
    if (name) {
      this.subPaneIds.delete(name);
    }
  }
  createOverlay(overlay, paneId) {
    if (paneId && typeof overlay === "object") {
      overlay.paneId = paneId;
    }
    const result = this.chart?.createOverlay(overlay);
    if (result) {
      return Array.isArray(result) ? result[0] || null : result;
    }
    return null;
  }
  removeOverlay(overlayId) {
    if (typeof overlayId === "string") {
      this.chart?.removeOverlay({ id: overlayId });
    } else {
      this.chart?.removeOverlay(overlayId);
    }
  }
  setMarkers(markers) {
    if (!this.chart) return;
    this.clearMarkers();
    markers.forEach((marker) => {
      const defaultColor = marker.color || "#1677FF";
      const position = marker.position || "above";
      this.chart?.createOverlay({
        name: "simpleAnnotation",
        groupId: this.markerGroupId,
        points: [{ timestamp: marker.timestamp }],
        extendData: marker.text,
        styles: {
          point: {
            color: defaultColor,
            borderColor: defaultColor,
            borderSize: 1,
            radius: 3,
            activeColor: defaultColor,
            activeBorderColor: defaultColor,
            activeBorderSize: 1,
            activeRadius: 4
          },
          line: {
            color: defaultColor
          },
          text: {
            color: defaultColor,
            size: 12,
            weight: "normal",
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 2,
            paddingBottom: 2,
            borderRadius: 2,
            backgroundColor: "transparent"
          },
          ...position === "below" ? { position: "bottom" } : {}
        }
      });
    });
  }
  clearMarkers() {
    this.chart?.removeOverlay({ groupId: this.markerGroupId });
  }
  subscribeAction(type, callback) {
    if (!this.actionCallbacks.has(type)) {
      this.actionCallbacks.set(type, /* @__PURE__ */ new Set());
    }
    this.actionCallbacks.get(type)?.add(callback);
  }
  unsubscribeAction(type, callback) {
    if (callback) {
      this.actionCallbacks.get(type)?.delete(callback);
    } else {
      this.actionCallbacks.delete(type);
    }
  }
  getChart() {
    return this.chart;
  }
  resize() {
    this.chart?.resize();
  }
  async searchSymbols(search) {
    return this.datafeed.searchSymbols(search);
  }
  getDataList() {
    return this.chart?.getDataList() || [];
  }
  scrollToRealTime() {
    this.chart?.scrollToRealTime();
  }
  scrollToDataIndex(dataIndex) {
    this.chart?.scrollToDataIndex(dataIndex);
  }
  scrollToTimestamp(timestamp) {
    this.chart?.scrollToTimestamp(timestamp);
  }
  zoomAtCoordinate(scale, coordinate) {
    this.chart?.zoomAtCoordinate(scale, coordinate);
  }
  zoomAtDataIndex(scale, dataIndex) {
    this.chart?.zoomAtDataIndex(scale, dataIndex);
  }
  zoomAtTimestamp(scale, timestamp) {
    this.chart?.zoomAtTimestamp(scale, timestamp);
  }
  convertToPixel(points, finder) {
    const result = this.chart?.convertToPixel(points, finder);
    if (!result) return [];
    if (Array.isArray(result)) {
      return result.map((r) => ({ x: r.x ?? 0, y: r.y ?? 0 }));
    }
    return [{ x: result.x ?? 0, y: result.y ?? 0 }];
  }
  convertFromPixel(coordinates, finder) {
    const result = this.chart?.convertFromPixel(coordinates, finder);
    if (!result) return [];
    if (Array.isArray(result)) {
      return result.map((r) => ({
        timestamp: r.timestamp ?? 0,
        dataIndex: r.dataIndex ?? 0,
        value: r.value ?? 0
      }));
    }
    const partial = result;
    return [{ timestamp: partial.timestamp ?? 0, dataIndex: partial.dataIndex ?? 0, value: partial.value ?? 0 }];
  }
  getSize(paneId) {
    return this.chart?.getSize(paneId) || null;
  }
  destroy() {
    this.datafeed.unsubscribe(this.currentSymbol, this.currentPeriod);
    this.actionCallbacks.clear();
    if (this.chart) {
      (0, import_klinecharts.dispose)(this.container);
      this.chart = null;
    }
  }
};

// src/core/createChartInstance.ts
function createChartInstance(getChart, defaultSymbol, defaultPeriod) {
  return {
    setTheme: (theme) => getChart()?.setTheme(theme),
    getTheme: () => getChart()?.getTheme() || "light",
    setStyles: (styles) => getChart()?.setStyles(styles),
    getStyles: () => getChart()?.getStyles() || null,
    setLocale: (locale) => getChart()?.setLocale(locale),
    getLocale: () => getChart()?.getLocale() || "en-US",
    setTimezone: (timezone) => getChart()?.setTimezone(timezone),
    getTimezone: () => getChart()?.getTimezone() || "",
    setSymbol: (symbol) => getChart()?.setSymbol(symbol),
    getSymbol: () => getChart()?.getSymbol() || defaultSymbol,
    setPeriod: (period) => getChart()?.setPeriod(period),
    getPeriod: () => getChart()?.getPeriod() || defaultPeriod,
    getPeriods: () => getChart()?.getPeriods() || [],
    createIndicator: (indicator, isStack, paneOptions) => getChart()?.createIndicator(indicator, isStack, paneOptions) || null,
    removeIndicator: (paneId, name) => getChart()?.removeIndicator(paneId, name),
    createOverlay: (overlay, paneId) => getChart()?.createOverlay(overlay, paneId) || null,
    removeOverlay: (overlayId) => getChart()?.removeOverlay(overlayId),
    setMarkers: (markers) => getChart()?.setMarkers(markers),
    clearMarkers: () => getChart()?.clearMarkers(),
    subscribeAction: (type, callback) => getChart()?.subscribeAction(type, callback),
    unsubscribeAction: (type, callback) => getChart()?.unsubscribeAction(type, callback),
    searchSymbols: (search) => getChart()?.searchSymbols(search) || Promise.resolve([]),
    getDataList: () => getChart()?.getDataList() || [],
    scrollToRealTime: () => getChart()?.scrollToRealTime(),
    scrollToDataIndex: (dataIndex) => getChart()?.scrollToDataIndex(dataIndex),
    scrollToTimestamp: (timestamp) => getChart()?.scrollToTimestamp(timestamp),
    zoomAtCoordinate: (scale, coordinate) => getChart()?.zoomAtCoordinate(scale, coordinate),
    zoomAtDataIndex: (scale, dataIndex) => getChart()?.zoomAtDataIndex(scale, dataIndex),
    zoomAtTimestamp: (scale, timestamp) => getChart()?.zoomAtTimestamp(scale, timestamp),
    resize: () => getChart()?.resize(),
    getChart: () => getChart()?.getChart() || null
  };
}

// src/react/IndicatorModal.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function IndicatorModal({
  visible,
  onClose,
  theme,
  mainIndicator,
  subIndicators,
  onMainSelect,
  onSubToggle
}) {
  if (!visible) return null;
  const isDark = theme === "dark";
  const bg = isDark ? "#252525" : "#ffffff";
  const border = isDark ? "#3d3d3d" : "#e5e5e5";
  const text = isDark ? "#e5e5e5" : "#333333";
  const subText = isDark ? "#929aa5" : "#666666";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: "klinecharts-pro-modal-overlay",
      style: {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2e3
      },
      onClick: onClose,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          className: "klinecharts-pro-modal",
          style: {
            backgroundColor: bg,
            borderRadius: 8,
            width: 480,
            maxHeight: "80vh",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          },
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
              padding: "16px 20px",
              borderBottom: `1px solid ${border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 16, fontWeight: 600, color: text }, children: "\u6307\u6807\u8BBE\u7F6E" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: onClose, style: {
                background: "none",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
                color: subText,
                padding: 4,
                lineHeight: 1
              }, children: "\xD7" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "16px 20px", maxHeight: "60vh", overflow: "auto" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: 20 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
                  fontSize: 14,
                  fontWeight: 500,
                  color: text,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: 4, height: 16, backgroundColor: "#1677ff", borderRadius: 2, display: "inline-block" } }),
                  "\u4E3B\u56FE\u6307\u6807"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }, children: BUILT_IN_INDICATORS.main.map((name) => {
                  const active = mainIndicator === name;
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                    backgroundColor: active ? isDark ? "rgba(22,119,255,0.15)" : "rgba(22,119,255,0.08)" : "transparent",
                    border: `1px solid ${active ? "#1677ff" : border}`,
                    transition: "all 0.2s"
                  }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        type: "radio",
                        name: "main-indicator",
                        checked: active,
                        onChange: () => onMainSelect(active ? null : name),
                        style: { accentColor: "#1677ff" }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 13, color: text }, children: name })
                  ] }, name);
                }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
                  fontSize: 14,
                  fontWeight: 500,
                  color: text,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: 4, height: 16, backgroundColor: "#52c41a", borderRadius: 2, display: "inline-block" } }),
                  "\u526F\u56FE\u6307\u6807"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }, children: BUILT_IN_INDICATORS.sub.map((name) => {
                  const active = subIndicators.has(name);
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                    backgroundColor: active ? isDark ? "rgba(82,196,26,0.15)" : "rgba(82,196,26,0.08)" : "transparent",
                    border: `1px solid ${active ? "#52c41a" : border}`,
                    transition: "all 0.2s"
                  }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        type: "checkbox",
                        checked: active,
                        onChange: () => onSubToggle(name),
                        style: { accentColor: "#52c41a" }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 13, color: text }, children: name })
                  ] }, name);
                }) })
              ] })
            ] })
          ]
        }
      )
    }
  );
}

// src/react/KLineChart.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function KLineChart(props) {
  const {
    className,
    style,
    markers,
    toolbarVisible = true,
    ref,
    onReady,
    onSymbolChange,
    onPeriodChange,
    onCrosshairChange,
    onBarClick,
    onZoom,
    onScroll,
    ...options
  } = props;
  const containerRef = (0, import_react.useRef)(null);
  const chartContainerRef = (0, import_react.useRef)(null);
  const chartRef = (0, import_react.useRef)(null);
  const searchRef = (0, import_react.useRef)(null);
  const subPaneIds = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const [searchText, setSearchText] = (0, import_react.useState)("");
  const [allSymbols, setAllSymbols] = (0, import_react.useState)([]);
  const [symbolsLoaded, setSymbolsLoaded] = (0, import_react.useState)(false);
  const [showResults, setShowResults] = (0, import_react.useState)(false);
  const [currentSymbol, setCurrentSymbol] = (0, import_react.useState)(options.symbol);
  const [currentPeriod, setCurrentPeriod] = (0, import_react.useState)(options.period);
  const [mainIndicator, setMainIndicator] = (0, import_react.useState)(
    options.mainIndicators?.[0] || "MA"
  );
  const [subIndicatorsSet, setSubIndicatorsSet] = (0, import_react.useState)(
    new Set(options.subIndicators || ["VOL"])
  );
  const [showIndicatorModal, setShowIndicatorModal] = (0, import_react.useState)(false);
  const periods = options.periods || [];
  (0, import_react.useEffect)(() => {
    if (!toolbarVisible) return;
    let cancelled = false;
    options.datafeed.searchSymbols().then((symbols) => {
      if (!cancelled) {
        setAllSymbols(symbols);
        setSymbolsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [options.datafeed, toolbarVisible]);
  const filteredResults = (0, import_react.useMemo)(() => {
    if (!searchText.trim()) return allSymbols;
    const lower = searchText.toLowerCase();
    return allSymbols.filter(
      (s) => s.ticker.toLowerCase().includes(lower) || s.name && s.name.toLowerCase().includes(lower) || s.shortName && s.shortName.toLowerCase().includes(lower)
    );
  }, [searchText, allSymbols]);
  (0, import_react.useEffect)(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleSymbolSelect = (0, import_react.useCallback)((symbol) => {
    setCurrentSymbol(symbol);
    setShowResults(false);
    setSearchText("");
    chartRef.current?.setSymbol(symbol);
  }, []);
  const handlePeriodSelect = (0, import_react.useCallback)((period) => {
    setCurrentPeriod(period);
    chartRef.current?.setPeriod(period);
  }, []);
  const handleMainIndicatorSelect = (0, import_react.useCallback)((name) => {
    setMainIndicator((prev) => {
      if (prev) chartRef.current?.removeIndicator("candle_pane", prev);
      if (name) chartRef.current?.createIndicator(name, false, { id: "candle_pane" });
      return name;
    });
  }, []);
  const handleSubIndicatorToggle = (0, import_react.useCallback)((name) => {
    setSubIndicatorsSet((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        const paneId = subPaneIds.current.get(name);
        if (paneId) {
          chartRef.current?.removeIndicator(paneId, name);
          subPaneIds.current.delete(name);
        }
      } else {
        next.add(name);
        const paneId = chartRef.current?.createIndicator(name, true);
        if (paneId) subPaneIds.current.set(name, paneId);
      }
      return next;
    });
  }, []);
  const indicatorCount = (mainIndicator ? 1 : 0) + subIndicatorsSet.size;
  const handleSymbolChange = (0, import_react.useCallback)(
    (data) => {
      setCurrentSymbol(data.newSymbol);
      onSymbolChange?.(data);
    },
    [onSymbolChange]
  );
  const handlePeriodChange = (0, import_react.useCallback)(
    (data) => {
      setCurrentPeriod(data.newPeriod);
      onPeriodChange?.(data);
    },
    [onPeriodChange]
  );
  const handleCrosshairChange = (0, import_react.useCallback)(
    (data) => {
      onCrosshairChange?.(data);
    },
    [onCrosshairChange]
  );
  const handleBarClick = (0, import_react.useCallback)(
    (data) => {
      onBarClick?.(data);
    },
    [onBarClick]
  );
  const handleZoom = (0, import_react.useCallback)(
    (data) => {
      onZoom?.(data);
    },
    [onZoom]
  );
  const handleScroll = (0, import_react.useCallback)(
    (data) => {
      onScroll?.(data);
    },
    [onScroll]
  );
  (0, import_react.useEffect)(() => {
    if (!chartContainerRef.current) return;
    const chart = new KLineChartPro({
      container: chartContainerRef.current,
      ...options
    });
    chartRef.current = chart;
    chart.subscribeAction("onSymbolChange", handleSymbolChange);
    chart.subscribeAction("onPeriodChange", handlePeriodChange);
    if (onCrosshairChange) chart.subscribeAction("onCrosshairChange", handleCrosshairChange);
    if (onBarClick) chart.subscribeAction("onBarClick", handleBarClick);
    if (onZoom) chart.subscribeAction("onZoom", handleZoom);
    if (onScroll) chart.subscribeAction("onScroll", handleScroll);
    onReady?.(chart);
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);
  (0, import_react.useEffect)(() => {
    if (options.theme) chartRef.current?.setTheme(options.theme);
  }, [options.theme]);
  (0, import_react.useEffect)(() => {
    if (options.locale) chartRef.current?.setLocale(options.locale);
  }, [options.locale]);
  (0, import_react.useEffect)(() => {
    if (options.timezone) chartRef.current?.setTimezone(options.timezone);
  }, [options.timezone]);
  (0, import_react.useEffect)(() => {
    if (options.styles) chartRef.current?.setStyles(options.styles);
  }, [options.styles]);
  (0, import_react.useEffect)(() => {
    if (!chartRef.current) return;
    if (markers && markers.length > 0) {
      chartRef.current.setMarkers(markers);
    } else {
      chartRef.current.clearMarkers();
    }
  }, [markers]);
  (0, import_react.useEffect)(() => {
    const handleResize = () => {
      chartRef.current?.resize();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  (0, import_react.useImperativeHandle)(
    ref,
    () => createChartInstance(() => chartRef.current, options.symbol, options.period),
    [options.symbol, options.period]
  );
  const themeClass = options.theme === "dark" ? "dark" : "light";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      ref: containerRef,
      className: `klinecharts-pro-container ${toolbarVisible ? "with-toolbar" : ""} ${className || ""}`.trim(),
      "data-theme": themeClass,
      style: { width: "100%", height: "100%", position: "relative", ...style },
      children: [
        toolbarVisible && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "klinecharts-pro-toolbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "klinecharts-pro-search", ref: searchRef, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                className: "klinecharts-pro-search-input",
                type: "text",
                placeholder: currentSymbol.name || currentSymbol.ticker,
                value: searchText,
                onChange: (e) => {
                  setSearchText(e.target.value);
                  setShowResults(true);
                },
                onFocus: () => setShowResults(true)
              }
            ),
            showResults && symbolsLoaded && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "klinecharts-pro-search-results", children: filteredResults.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "div",
              {
                className: "klinecharts-pro-search-result-item",
                style: { color: "#999", cursor: "default" },
                children: "No results"
              }
            ) : filteredResults.slice(0, 50).map((s) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "div",
              {
                className: `klinecharts-pro-search-result-item ${s.ticker === currentSymbol.ticker ? "active" : ""}`,
                onClick: () => handleSymbolSelect(s),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "klinecharts-pro-search-result-item-ticker", children: s.ticker }),
                  s.name && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "klinecharts-pro-search-result-item-name", children: s.name })
                ]
              },
              s.ticker
            )) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "klinecharts-pro-period-selector", children: periods.map((p) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              className: `klinecharts-pro-period-btn ${p.text === currentPeriod.text ? "active" : ""}`,
              onClick: () => handlePeriodSelect(p),
              children: p.text
            },
            p.text
          )) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "klinecharts-pro-indicator-selector", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              className: "klinecharts-pro-indicator-btn",
              onClick: () => setShowIndicatorModal(true),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u{1F4CA}" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u6307\u6807" }),
                indicatorCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: {
                  backgroundColor: "#1677ff",
                  color: "#fff",
                  padding: "0 6px",
                  borderRadius: 10,
                  fontSize: 11,
                  lineHeight: "18px"
                }, children: indicatorCount })
              ]
            }
          ) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            ref: chartContainerRef,
            className: "klinecharts-pro-chart",
            style: { position: "absolute", left: 0, right: 0, bottom: 0, top: toolbarVisible ? 45 : 0 }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          IndicatorModal,
          {
            visible: showIndicatorModal,
            onClose: () => setShowIndicatorModal(false),
            theme: themeClass,
            mainIndicator,
            subIndicators: subIndicatorsSet,
            onMainSelect: handleMainIndicatorSelect,
            onSubToggle: handleSubIndicatorToggle
          }
        )
      ]
    }
  );
}

// src/datafeed/index.ts
var BaseDatafeed = class {
};
var DefaultDatafeed = class {
  constructor(apiKey) {
    this.baseUrl = "https://api.polygon.io";
    this.subscriptions = /* @__PURE__ */ new Map();
    this.apiKey = apiKey;
  }
  getSubscriptionKey(symbol, period) {
    return `${symbol.ticker}_${period.span}_${period.type}`;
  }
  periodToPolygonTimespan(period) {
    const timespanMap = {
      minute: "minute",
      hour: "hour",
      day: "day",
      week: "week",
      month: "month",
      year: "year"
    };
    return timespanMap[period.type] || "day";
  }
  async searchSymbols(search) {
    if (!search || search.length < 1) {
      return [];
    }
    try {
      const response = await fetch(
        `${this.baseUrl}/v3/reference/tickers?search=${encodeURIComponent(search)}&active=true&limit=20&apiKey=${this.apiKey}`
      );
      const data = await response.json();
      if (data.results) {
        return data.results.map((item) => ({
          ticker: item.ticker,
          name: item.name,
          shortName: item.ticker,
          exchange: item.primary_exchange,
          market: item.market,
          priceCurrency: item.currency_name,
          type: item.type
        }));
      }
      return [];
    } catch (error) {
      console.error("Failed to search symbols:", error);
      return [];
    }
  }
  async getHistoryKLineData(symbol, period, from, to) {
    const timespan = this.periodToPolygonTimespan(period);
    const fromDate = new Date(from).toISOString().split("T")[0];
    const toDate = new Date(to).toISOString().split("T")[0];
    try {
      const response = await fetch(
        `${this.baseUrl}/v2/aggs/ticker/${symbol.ticker}/range/${period.span}/${timespan}/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=50000&apiKey=${this.apiKey}`
      );
      const data = await response.json();
      if (data.results) {
        return data.results.map((item) => ({
          timestamp: item.t,
          open: item.o,
          high: item.h,
          low: item.l,
          close: item.c,
          volume: item.v
        }));
      }
      return [];
    } catch (error) {
      console.error("Failed to get history kline data:", error);
      return [];
    }
  }
  subscribe(symbol, period, callback) {
    const key = this.getSubscriptionKey(symbol, period);
    if (this.subscriptions.has(key)) {
      return;
    }
    const pollInterval = this.getPollInterval(period);
    const intervalId = setInterval(async () => {
      const now = Date.now();
      const from = now - pollInterval * 2;
      const data = await this.getHistoryKLineData(symbol, period, from, now);
      if (data.length > 0) {
        callback(data[data.length - 1]);
      }
    }, pollInterval);
    this.subscriptions.set(key, intervalId);
  }
  unsubscribe(symbol, period) {
    const key = this.getSubscriptionKey(symbol, period);
    const intervalId = this.subscriptions.get(key);
    if (intervalId) {
      clearInterval(intervalId);
      this.subscriptions.delete(key);
    }
  }
  getPollInterval(period) {
    const baseIntervals = {
      minute: 60 * 1e3,
      hour: 60 * 60 * 1e3,
      day: 24 * 60 * 60 * 1e3,
      week: 7 * 24 * 60 * 60 * 1e3,
      month: 30 * 24 * 60 * 60 * 1e3,
      year: 365 * 24 * 60 * 60 * 1e3
    };
    const base = baseIntervals[period.type] || 60 * 1e3;
    return Math.min(base * period.span, 60 * 1e3);
  }
  destroy() {
    this.subscriptions.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.subscriptions.clear();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BUILT_IN_INDICATORS,
  BaseDatafeed,
  DEFAULT_PERIODS,
  DRAWING_TOOL_GROUPS,
  DefaultDatafeed,
  IndicatorModal,
  KLineChart,
  KLineChartPro,
  createChartInstance,
  darkTheme,
  enUS,
  getDefaultMainIndicators,
  getDefaultSubIndicators,
  lightTheme,
  zhCN,
  zhTW
});
//# sourceMappingURL=index.cjs.map