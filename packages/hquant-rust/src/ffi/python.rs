use std::sync::Mutex;

use pyo3::prelude::*;

use crate::{
    Bar, QuantEngine, Signal, Side,
    MABuilder, RSIBuilder, MACDBuilder, ATRBuilder, BOLLBuilder, VRIBuilder,
};

fn to_bar(bar: &PyBar) -> Bar {
    Bar {
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
    }
}

fn signal_to_output(signal: &Signal) -> PySignal {
    PySignal {
        side: match signal.side {
            Side::Buy => "BUY".to_string(),
            Side::Sell => "SELL".to_string(),
            Side::Hold => "HOLD".to_string(),
        },
        strength: signal.strength,
        reason: signal.reason.clone(),
        timestamp: signal.timestamp,
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PyBar {
    #[pyo3(get, set)]
    pub timestamp: i64,
    #[pyo3(get, set)]
    pub open: f64,
    #[pyo3(get, set)]
    pub high: f64,
    #[pyo3(get, set)]
    pub low: f64,
    #[pyo3(get, set)]
    pub close: f64,
    #[pyo3(get, set)]
    pub volume: f64,
}

#[pymethods]
impl PyBar {
    #[new]
    pub fn new(timestamp: i64, open: f64, high: f64, low: f64, close: f64, volume: f64) -> Self {
        Self {
            timestamp,
            open,
            high,
            low,
            close,
            volume,
        }
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PySignal {
    #[pyo3(get)]
    pub side: String,
    #[pyo3(get)]
    pub strength: f64,
    #[pyo3(get)]
    pub reason: String,
    #[pyo3(get)]
    pub timestamp: i64,
}

// ============================================================================
// Indicator Builders
// ============================================================================

#[pyclass]
#[derive(Clone)]
pub struct PyMAIndicator {
    inner: MABuilder,
}

#[pymethods]
impl PyMAIndicator {
    #[new]
    pub fn new() -> Self {
        Self {
            inner: MABuilder::new(),
        }
    }

    pub fn period(&mut self, period: usize) -> Self {
        self.inner = self.inner.clone().period(period);
        self.clone()
    }

    pub fn sma(&mut self) -> Self {
        self.inner = self.inner.clone().sma();
        self.clone()
    }

    pub fn ema(&mut self) -> Self {
        self.inner = self.inner.clone().ema();
        self.clone()
    }

    pub fn wma(&mut self) -> Self {
        self.inner = self.inner.clone().wma();
        self.clone()
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PyRSIIndicator {
    inner: RSIBuilder,
}

#[pymethods]
impl PyRSIIndicator {
    #[new]
    pub fn new() -> Self {
        Self {
            inner: RSIBuilder::new(),
        }
    }

    pub fn period(&mut self, period: usize) -> Self {
        self.inner = self.inner.clone().period(period);
        self.clone()
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PyMACDIndicator {
    inner: MACDBuilder,
}

#[pymethods]
impl PyMACDIndicator {
    #[new]
    pub fn new() -> Self {
        Self {
            inner: MACDBuilder::new(),
        }
    }

    pub fn fast(&mut self, period: usize) -> Self {
        self.inner = self.inner.clone().fast(period);
        self.clone()
    }

    pub fn slow(&mut self, period: usize) -> Self {
        self.inner = self.inner.clone().slow(period);
        self.clone()
    }

    pub fn signal(&mut self, period: usize) -> Self {
        self.inner = self.inner.clone().signal(period);
        self.clone()
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PyATRIndicator {
    inner: ATRBuilder,
}

#[pymethods]
impl PyATRIndicator {
    #[new]
    pub fn new() -> Self {
        Self {
            inner: ATRBuilder::new(),
        }
    }

    pub fn period(&mut self, period: usize) -> Self {
        self.inner = self.inner.clone().period(period);
        self.clone()
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PyBOLLIndicator {
    inner: BOLLBuilder,
}

#[pymethods]
impl PyBOLLIndicator {
    #[new]
    pub fn new() -> Self {
        Self {
            inner: BOLLBuilder::new(),
        }
    }

    pub fn period(&mut self, period: usize) -> Self {
        self.inner = self.inner.clone().period(period);
        self.clone()
    }

    pub fn std_dev(&mut self, factor: f64) -> Self {
        self.inner = self.inner.clone().std_dev(factor);
        self.clone()
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PyVRIIndicator {
    inner: VRIBuilder,
}

#[pymethods]
impl PyVRIIndicator {
    #[new]
    pub fn new() -> Self {
        Self {
            inner: VRIBuilder::new(),
        }
    }

    pub fn period(&mut self, period: usize) -> Self {
        self.inner = self.inner.clone().period(period);
        self.clone()
    }
}

// ============================================================================
// Engine
// ============================================================================

#[pyclass]
pub struct PyEngine {
    inner: Mutex<QuantEngine>,
}

#[pymethods]
impl PyEngine {
    #[new]
    pub fn new(capacity: usize) -> PyResult<Self> {
        Ok(Self {
            inner: Mutex::new(
                QuantEngine::new(capacity)
                    .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?,
            ),
        })
    }

    pub fn add_ma_indicator(&self, name: String, indicator: &PyMAIndicator) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| pyo3::exceptions::PyRuntimeError::new_err("engine lock poisoned"))?;
        engine
            .add_indicator(name, indicator.inner.clone())
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        Ok(())
    }

    pub fn add_rsi_indicator(&self, name: String, indicator: &PyRSIIndicator) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| pyo3::exceptions::PyRuntimeError::new_err("engine lock poisoned"))?;
        engine
            .add_indicator(name, indicator.inner.clone())
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        Ok(())
    }

    pub fn add_macd_indicator(&self, name: String, indicator: &PyMACDIndicator) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| pyo3::exceptions::PyRuntimeError::new_err("engine lock poisoned"))?;
        engine
            .add_indicator(name, indicator.inner.clone())
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        Ok(())
    }

    pub fn add_atr_indicator(&self, name: String, indicator: &PyATRIndicator) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| pyo3::exceptions::PyRuntimeError::new_err("engine lock poisoned"))?;
        engine
            .add_indicator(name, indicator.inner.clone())
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        Ok(())
    }

    pub fn add_boll_indicator(&self, name: String, indicator: &PyBOLLIndicator) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| pyo3::exceptions::PyRuntimeError::new_err("engine lock poisoned"))?;
        engine
            .add_indicator(name, indicator.inner.clone())
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        Ok(())
    }

    pub fn add_vri_indicator(&self, name: String, indicator: &PyVRIIndicator) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| pyo3::exceptions::PyRuntimeError::new_err("engine lock poisoned"))?;
        engine
            .add_indicator(name, indicator.inner.clone())
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        Ok(())
    }

    pub fn append_bar(&self, bar: PyBar) -> PyResult<Vec<PySignal>> {
        let mut engine = self.inner.lock().map_err(|_| pyo3::exceptions::PyRuntimeError::new_err("engine lock poisoned"))?;
        let signals: Vec<PySignal> = engine
            .append_bar(&to_bar(&bar))
            .iter()
            .map(signal_to_output)
            .collect();
        Ok(signals)
    }

    pub fn update_last_bar(&self, bar: PyBar) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| pyo3::exceptions::PyRuntimeError::new_err("engine lock poisoned"))?;
        engine.update_last_bar(&to_bar(&bar));
        Ok(())
    }

    pub fn load_history(&self, bars: Vec<PyBar>) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| pyo3::exceptions::PyRuntimeError::new_err("engine lock poisoned"))?;
        let rust_bars: Vec<Bar> = bars.iter().map(to_bar).collect();
        engine.load_history(&rust_bars);
        Ok(())
    }

    pub fn indicator_value(&self, name: String) -> Option<f64> {
        let engine = self.inner.lock().ok()?;
        engine.indicator_value(&name)
    }

    pub fn indicator_ready(&self, name: String) -> bool {
        let engine = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return false,
        };
        engine.indicator_ready(&name)
    }

    pub fn reset(&self) {
        let mut engine = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        engine.reset();
    }
}

#[pymodule]
pub fn hquant_py(_py: Python<'_>, m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<PyEngine>()?;
    m.add_class::<PyBar>()?;
    m.add_class::<PySignal>()?;
    m.add_class::<PyMAIndicator>()?;
    m.add_class::<PyRSIIndicator>()?;
    m.add_class::<PyMACDIndicator>()?;
    m.add_class::<PyATRIndicator>()?;
    m.add_class::<PyBOLLIndicator>()?;
    m.add_class::<PyVRIIndicator>()?;
    Ok(())
}
