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

// src/index.ts
var src_exports = {};
__export(src_exports, {
  BUILT_IN_INDICATORS: () => BUILT_IN_INDICATORS,
  BaseDatafeed: () => BaseDatafeed,
  DEFAULT_PERIODS: () => DEFAULT_PERIODS,
  DEFAULT_TIMEZONE: () => DEFAULT_TIMEZONE,
  DRAWING_TOOL_GROUPS: () => DRAWING_TOOL_GROUPS,
  DefaultDatafeed: () => DefaultDatafeed,
  KLineChartPro: () => KLineChartPro,
  darkTheme: () => darkTheme,
  dispose: () => import_klinecharts2.dispose,
  enUS: () => enUS,
  getDefaultMainIndicators: () => getDefaultMainIndicators,
  getDefaultSubIndicators: () => getDefaultSubIndicators,
  getFigureClass: () => import_klinecharts2.getFigureClass,
  getSupportedFigures: () => import_klinecharts2.getSupportedFigures,
  getSupportedIndicators: () => import_klinecharts2.getSupportedIndicators,
  getSupportedOverlays: () => import_klinecharts2.getSupportedOverlays,
  init: () => import_klinecharts2.init,
  lightTheme: () => lightTheme,
  registerIndicator: () => import_klinecharts2.registerIndicator,
  registerLocale: () => import_klinecharts2.registerLocale,
  registerOverlay: () => import_klinecharts2.registerOverlay,
  registerStyles: () => import_klinecharts2.registerStyles,
  registerXAxis: () => import_klinecharts2.registerXAxis,
  registerYAxis: () => import_klinecharts2.registerYAxis,
  utils: () => import_klinecharts2.utils,
  version: () => import_klinecharts2.version,
  zhCN: () => zhCN,
  zhTW: () => zhTW
});
module.exports = __toCommonJS(src_exports);

// src/core/KLineChartPro.ts
var import_klinecharts = require("klinecharts");

// src/core/defaults.ts
var DEFAULT_PERIODS = [
  { multiplier: 1, timespan: "minute", text: "1m" },
  { multiplier: 5, timespan: "minute", text: "5m" },
  { multiplier: 15, timespan: "minute", text: "15m" },
  { multiplier: 30, timespan: "minute", text: "30m" },
  { multiplier: 1, timespan: "hour", text: "1H" },
  { multiplier: 4, timespan: "hour", text: "4H" },
  { multiplier: 1, timespan: "day", text: "1D" },
  { multiplier: 1, timespan: "week", text: "1W" },
  { multiplier: 1, timespan: "month", text: "1M" }
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
      defaultValue: "n/a",
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
      text: {
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
      showName: true,
      showParams: true,
      defaultValue: "n/a",
      text: {
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
      defaultValue: "n/a",
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
      text: {
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
      showName: true,
      showParams: true,
      defaultValue: "n/a",
      text: {
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
  change: "\u6DA8\u8DCC\u5E45"
};
var zhTW = {
  time: "\u6642\u9593",
  open: "\u958B",
  high: "\u9AD8",
  low: "\u4F4E",
  close: "\u6536",
  volume: "\u6210\u4EA4\u91CF",
  turnover: "\u6210\u4EA4\u984D",
  change: "\u6F32\u8DCC\u5E45"
};
var enUS = {
  time: "Time",
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
  volume: "Volume",
  turnover: "Turnover",
  change: "Change"
};

// src/core/KLineChartPro.ts
var KLineChartPro = class {
  constructor(options) {
    this.chart = null;
    this.currentTheme = "light";
    this.currentLocale = "en-US";
    this.currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.subPaneIds = /* @__PURE__ */ new Map();
    this.isLoading = false;
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
    this.loadData();
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
  async loadData() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      this.datafeed.unsubscribe(this.currentSymbol, this.currentPeriod);
      const now = Date.now();
      const from = now - this.getPeriodDuration() * 500;
      const data = await this.datafeed.getHistoryKLineData(
        this.currentSymbol,
        this.currentPeriod,
        from,
        now
      );
      if (this.chart && data.length > 0) {
        this.chart.applyNewData(data);
      }
      this.datafeed.subscribe(
        this.currentSymbol,
        this.currentPeriod,
        (newData) => {
          this.chart?.updateData(newData);
        }
      );
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      this.isLoading = false;
    }
  }
  getPeriodDuration() {
    const multipliers = {
      minute: 60 * 1e3,
      hour: 60 * 60 * 1e3,
      day: 24 * 60 * 60 * 1e3,
      week: 7 * 24 * 60 * 60 * 1e3,
      month: 30 * 24 * 60 * 60 * 1e3,
      year: 365 * 24 * 60 * 60 * 1e3
    };
    return (multipliers[this.currentPeriod.timespan] || 60 * 1e3) * this.currentPeriod.multiplier;
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
    this.loadData();
    this.emitAction("onSymbolChange", { oldSymbol, newSymbol: symbol });
  }
  getSymbol() {
    return this.currentSymbol;
  }
  setPeriod(period) {
    const oldPeriod = this.currentPeriod;
    this.currentPeriod = period;
    this.loadData();
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
    this.chart?.removeIndicator(paneId, name);
    if (name) {
      this.subPaneIds.delete(name);
    }
  }
  createOverlay(overlay, paneId) {
    const result = this.chart?.createOverlay(overlay, paneId);
    if (result) {
      return Array.isArray(result) ? result[0] || null : result;
    }
    return null;
  }
  removeOverlay(overlayId) {
    this.chart?.removeOverlay(overlayId);
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
  applyNewData(data, more) {
    this.chart?.applyNewData(data, more);
  }
  updateData(data) {
    this.chart?.updateData(data);
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
    return `${symbol.ticker}_${period.multiplier}_${period.timespan}`;
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
    return timespanMap[period.timespan] || "day";
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
        `${this.baseUrl}/v2/aggs/ticker/${symbol.ticker}/range/${period.multiplier}/${timespan}/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=50000&apiKey=${this.apiKey}`
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
    const base = baseIntervals[period.timespan] || 60 * 1e3;
    return Math.min(base * period.multiplier, 60 * 1e3);
  }
  destroy() {
    this.subscriptions.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.subscriptions.clear();
  }
};

// src/index.ts
var import_klinecharts2 = require("klinecharts");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BUILT_IN_INDICATORS,
  BaseDatafeed,
  DEFAULT_PERIODS,
  DEFAULT_TIMEZONE,
  DRAWING_TOOL_GROUPS,
  DefaultDatafeed,
  KLineChartPro,
  darkTheme,
  dispose,
  enUS,
  getDefaultMainIndicators,
  getDefaultSubIndicators,
  getFigureClass,
  getSupportedFigures,
  getSupportedIndicators,
  getSupportedOverlays,
  init,
  lightTheme,
  registerIndicator,
  registerLocale,
  registerOverlay,
  registerStyles,
  registerXAxis,
  registerYAxis,
  utils,
  version,
  zhCN,
  zhTW
});
//# sourceMappingURL=index.cjs.map