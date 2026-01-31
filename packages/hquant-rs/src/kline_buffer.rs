use crate::commom::circular::CircularColumn;
use crate::types::{Bar, Field};

#[derive(Clone, Debug)]
pub struct KlineBuffer {
    timestamp: CircularColumn<i64>,
    open: CircularColumn<f64>,
    high: CircularColumn<f64>,
    low: CircularColumn<f64>,
    close: CircularColumn<f64>,
    volume: CircularColumn<f64>,
    buy_volume: CircularColumn<f64>,
}

impl KlineBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            timestamp: CircularColumn::new(capacity),
            open: CircularColumn::new(capacity),
            high: CircularColumn::new(capacity),
            low: CircularColumn::new(capacity),
            close: CircularColumn::new(capacity),
            volume: CircularColumn::new(capacity),
            buy_volume: CircularColumn::new(capacity),
        }
    }

    pub fn clear(&mut self) {
        self.timestamp.clear();
        self.open.clear();
        self.high.clear();
        self.low.clear();
        self.close.clear();
        self.volume.clear();
        self.buy_volume.clear();
    }

    pub fn capacity(&self) -> usize {
        self.close.capacity()
    }

    pub fn len(&self) -> usize {
        self.close.len()
    }

    pub fn is_empty(&self) -> bool {
        self.close.is_empty()
    }

    pub fn push(&mut self, bar: Bar) {
        self.timestamp.push(bar.timestamp);
        self.open.push(bar.open);
        self.high.push(bar.high);
        self.low.push(bar.low);
        self.close.push(bar.close);
        self.volume.push(bar.volume);
        self.buy_volume.push(bar.buy_volume);
    }

    pub fn update_last(&mut self, bar: Bar) -> Option<Bar> {
        let old = self.last()?;
        self.timestamp.update_last(bar.timestamp);
        self.open.update_last(bar.open);
        self.high.update_last(bar.high);
        self.low.update_last(bar.low);
        self.close.update_last(bar.close);
        self.volume.update_last(bar.volume);
        self.buy_volume.update_last(bar.buy_volume);
        Some(old)
    }

    pub fn get(&self, i: usize) -> Option<Bar> {
        Some(Bar {
            timestamp: self.timestamp.get(i)?,
            open: self.open.get(i)?,
            high: self.high.get(i)?,
            low: self.low.get(i)?,
            close: self.close.get(i)?,
            volume: self.volume.get(i)?,
            buy_volume: self.buy_volume.get(i)?,
        })
    }

    pub fn last(&self) -> Option<Bar> {
        let i = self.len().checked_sub(1)?;
        self.get(i)
    }

    pub fn get_f64(&self, field: Field, i: usize) -> Option<f64> {
        match field {
            Field::Open => self.open.get(i),
            Field::High => self.high.get(i),
            Field::Low => self.low.get(i),
            Field::Close => self.close.get(i),
            Field::Volume => self.volume.get(i),
            Field::BuyVolume => self.buy_volume.get(i),
        }
    }

    pub fn last_f64(&self, field: Field) -> Option<f64> {
        let i = self.len().checked_sub(1)?;
        self.get_f64(field, i)
    }

    pub fn timestamp(&self) -> &CircularColumn<i64> {
        &self.timestamp
    }
    pub fn open(&self) -> &CircularColumn<f64> {
        &self.open
    }
    pub fn high(&self) -> &CircularColumn<f64> {
        &self.high
    }
    pub fn low(&self) -> &CircularColumn<f64> {
        &self.low
    }
    pub fn close(&self) -> &CircularColumn<f64> {
        &self.close
    }
    pub fn volume(&self) -> &CircularColumn<f64> {
        &self.volume
    }
    pub fn buy_volume(&self) -> &CircularColumn<f64> {
        &self.buy_volume
    }
}

