//! High-performance ring buffer implementation
//! Uses fixed-size array, avoids dynamic memory allocation
//! Supports O(1) append and random access

use crate::{HQuantError, HQuantResult};

/// Generic ring buffer
#[derive(Debug, Clone)]
pub struct RingBuffer<T> {
    data: Vec<T>,
    capacity: usize,
    head: usize,
    len: usize,
}

impl<T: Default + Clone> RingBuffer<T> {
    /// Create a ring buffer with specified capacity
    #[inline]
    pub fn new(capacity: usize) -> HQuantResult<Self> {
        if capacity == 0 {
            return Err(HQuantError::invalid_capacity(capacity, "RingBuffer"));
        }
        Ok(Self {
            data: vec![T::default(); capacity],
            capacity,
            head: 0,
            len: 0,
        })
    }

    /// Create a ring buffer with initial data
    pub fn with_data(capacity: usize, initial: &[T]) -> HQuantResult<Self> {
        let mut rb = Self::new(capacity)?;
        for item in initial {
            rb.push(item.clone());
        }
        Ok(rb)
    }

    /// Append element, overwrites oldest if full
    #[inline]
    pub fn push(&mut self, value: T) {
        self.data[self.head] = value;
        self.head = (self.head + 1) % self.capacity;
        if self.len < self.capacity {
            self.len += 1;
        }
    }

    /// Update the last element (for realtime K-line updates)
    #[inline]
    pub fn update_last(&mut self, value: T) {
        if self.len > 0 {
            let last_idx = if self.head == 0 {
                self.capacity - 1
            } else {
                self.head - 1
            };
            self.data[last_idx] = value;
        }
    }

    /// Get element at specified index (0 is oldest, len-1 is newest)
    #[inline]
    pub fn get(&self, index: usize) -> Option<&T> {
        if index >= self.len {
            return None;
        }
        let actual_idx = self.to_actual_index(index);
        Some(&self.data[actual_idx])
    }

    /// Get the newest element
    #[inline]
    pub fn last(&self) -> Option<&T> {
        if self.len == 0 {
            None
        } else {
            self.get(self.len - 1)
        }
    }

    /// Get the last N elements (from oldest to newest)
    #[inline]
    pub fn last_n(&self, n: usize) -> Vec<&T> {
        let n = n.min(self.len);
        let start = self.len.saturating_sub(n);
        (start..self.len).filter_map(|i| self.get(i)).collect()
    }

    /// Get the nth element from the end (1 is newest, 2 is second newest)
    #[inline]
    pub fn get_from_end(&self, n: usize) -> Option<&T> {
        if n == 0 || n > self.len {
            return None;
        }
        self.get(self.len - n)
    }

    /// Current element count
    #[inline]
    pub fn len(&self) -> usize {
        self.len
    }

    /// Check if empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Check if full
    #[inline]
    pub fn is_full(&self) -> bool {
        self.len == self.capacity
    }

    /// Get capacity
    #[inline]
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Clear buffer
    #[inline]
    pub fn clear(&mut self) {
        self.head = 0;
        self.len = 0;
    }

    /// Convert logical index to actual index
    #[inline]
    fn to_actual_index(&self, logical_index: usize) -> usize {
        if self.len < self.capacity {
            logical_index
        } else {
            (self.head + logical_index) % self.capacity
        }
    }

    /// Iterator (from oldest to newest)
    pub fn iter(&self) -> RingBufferIter<'_, T> {
        RingBufferIter {
            buffer: self,
            current: 0,
        }
    }

    /// Get raw data slices (for batch calculations)
    /// Returns two slices because data may span boundary
    pub fn as_slices(&self) -> (&[T], &[T]) {
        if self.len == 0 {
            return (&[], &[]);
        }

        if self.len < self.capacity {
            (&self.data[..self.len], &[])
        } else {
            let first = &self.data[self.head..];
            let second = &self.data[..self.head];
            (first, second)
        }
    }

    /// Convert to contiguous Vec (for calculations requiring contiguous memory)
    pub fn to_vec(&self) -> Vec<T> {
        self.iter().cloned().collect()
    }
}

pub struct RingBufferIter<'a, T> {
    buffer: &'a RingBuffer<T>,
    current: usize,
}

impl<'a, T: Default + Clone> Iterator for RingBufferIter<'a, T> {
    type Item = &'a T;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        if self.current >= self.buffer.len {
            return None;
        }
        let item = self.buffer.get(self.current);
        self.current += 1;
        item
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.buffer.len - self.current;
        (remaining, Some(remaining))
    }
}

impl<'a, T: Default + Clone> ExactSizeIterator for RingBufferIter<'a, T> {}

/// High-performance f64 ring buffer
/// Provides additional numerical calculation methods
#[derive(Debug, Clone)]
pub struct F64RingBuffer {
    inner: RingBuffer<f64>,
    /// Cached sum for fast mean calculation
    sum: f64,
    /// Cached squared sum for fast std dev calculation
    sum_sq: f64,
}

impl F64RingBuffer {
    #[inline]
    pub fn new(capacity: usize) -> HQuantResult<Self> {
        Ok(Self {
            inner: RingBuffer::new(capacity)?,
            sum: 0.0,
            sum_sq: 0.0,
        })
    }

    /// Append element, maintaining cached sum
    #[inline]
    pub fn push(&mut self, value: f64) {
        // If buffer is full, subtract the value being overwritten
        if self.inner.is_full() {
            if let Some(&old_val) = self.inner.get(0) {
                self.sum -= old_val;
                self.sum_sq -= old_val * old_val;
            }
        }
        self.sum += value;
        self.sum_sq += value * value;
        self.inner.push(value);
    }

    /// Update the last element
    #[inline]
    pub fn update_last(&mut self, value: f64) {
        if let Some(&old_val) = self.inner.last() {
            self.sum = self.sum - old_val + value;
            self.sum_sq = self.sum_sq - old_val * old_val + value * value;
            self.inner.update_last(value);
        }
    }

    /// O(1) mean calculation
    #[inline]
    pub fn mean(&self) -> f64 {
        if self.inner.is_empty() {
            0.0
        } else {
            self.sum / self.inner.len() as f64
        }
    }

    /// O(1) variance calculation
    #[inline]
    pub fn variance(&self) -> f64 {
        if self.inner.len() < 2 {
            return 0.0;
        }
        let n = self.inner.len() as f64;
        let mean = self.sum / n;
        (self.sum_sq / n) - (mean * mean)
    }

    /// O(1) standard deviation calculation
    #[inline]
    pub fn std_dev(&self) -> f64 {
        self.variance().sqrt()
    }

    /// Get maximum value
    pub fn max(&self) -> f64 {
        self.inner.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b))
    }

    /// Get minimum value
    pub fn min(&self) -> f64 {
        self.inner.iter().fold(f64::INFINITY, |a, &b| a.min(b))
    }

    /// Get mean of last N elements
    pub fn mean_last_n(&self, n: usize) -> f64 {
        let items = self.inner.last_n(n);
        if items.is_empty() {
            return 0.0;
        }
        items.iter().map(|&&x| x).sum::<f64>() / items.len() as f64
    }

    #[inline]
    pub fn get(&self, index: usize) -> Option<f64> {
        self.inner.get(index).copied()
    }

    #[inline]
    pub fn last(&self) -> Option<f64> {
        self.inner.last().copied()
    }

    #[inline]
    pub fn get_from_end(&self, n: usize) -> Option<f64> {
        self.inner.get_from_end(n).copied()
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.inner.len()
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    #[inline]
    pub fn is_full(&self) -> bool {
        self.inner.is_full()
    }

    #[inline]
    pub fn capacity(&self) -> usize {
        self.inner.capacity()
    }

    #[inline]
    pub fn clear(&mut self) {
        self.inner.clear();
        self.sum = 0.0;
        self.sum_sq = 0.0;
    }

    pub fn iter(&self) -> impl Iterator<Item = &f64> {
        self.inner.iter()
    }

    pub fn to_vec(&self) -> Vec<f64> {
        self.inner.to_vec()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_basic() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(3).unwrap();

        rb.push(1);
        rb.push(2);
        rb.push(3);

        assert_eq!(rb.len(), 3);
        assert_eq!(rb.get(0), Some(&1));
        assert_eq!(rb.get(2), Some(&3));
        assert_eq!(rb.last(), Some(&3));
    }

    #[test]
    fn test_ring_buffer_overflow() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(3).unwrap();

        rb.push(1);
        rb.push(2);
        rb.push(3);
        rb.push(4); // Overwrites 1
        rb.push(5); // Overwrites 2

        assert_eq!(rb.len(), 3);
        assert_eq!(rb.get(0), Some(&3));
        assert_eq!(rb.get(1), Some(&4));
        assert_eq!(rb.get(2), Some(&5));
    }

    #[test]
    fn test_ring_buffer_update_last() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(3).unwrap();

        rb.push(1);
        rb.push(2);
        rb.push(3);

        rb.update_last(10);

        assert_eq!(rb.last(), Some(&10));
        assert_eq!(rb.len(), 3);
    }

    #[test]
    fn test_ring_buffer_iter() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(5).unwrap();

        for i in 1..=5 {
            rb.push(i);
        }

        let values: Vec<i32> = rb.iter().cloned().collect();
        assert_eq!(values, vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn test_f64_ring_buffer_mean() {
        let mut rb = F64RingBuffer::new(3).unwrap();

        rb.push(1.0);
        rb.push(2.0);
        rb.push(3.0);

        assert!((rb.mean() - 2.0).abs() < 1e-10);

        rb.push(4.0); // Overwrites 1.0, now [2.0, 3.0, 4.0]
        assert!((rb.mean() - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_f64_ring_buffer_std_dev() {
        let mut rb = F64RingBuffer::new(4).unwrap();

        rb.push(2.0);
        rb.push(4.0);
        rb.push(4.0);
        rb.push(4.0);

        // Variance = E[X^2] - E[X]^2
        // E[X] = 3.5, E[X^2] = (4 + 16 + 16 + 16) / 4 = 13
        // Variance = 13 - 12.25 = 0.75
        // StdDev = sqrt(0.75) ≈ 0.866
        assert!((rb.variance() - 0.75).abs() < 1e-10);
        assert!((rb.std_dev() - 0.8660254037844386).abs() < 1e-10);
    }

    #[test]
    fn test_f64_ring_buffer_update_last() {
        let mut rb = F64RingBuffer::new(3).unwrap();

        rb.push(1.0);
        rb.push(2.0);
        rb.push(3.0);

        assert!((rb.mean() - 2.0).abs() < 1e-10);

        rb.update_last(6.0); // Now [1.0, 2.0, 6.0]
        assert!((rb.mean() - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_ring_buffer_get_from_end() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(5).unwrap();

        for i in 1..=5 {
            rb.push(i);
        }

        assert_eq!(rb.get_from_end(1), Some(&5)); // Newest
        assert_eq!(rb.get_from_end(2), Some(&4));
        assert_eq!(rb.get_from_end(5), Some(&1)); // Oldest
        assert_eq!(rb.get_from_end(6), None);
        assert_eq!(rb.get_from_end(0), None);
    }

    #[test]
    fn test_ring_buffer_last_n() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(5).unwrap();

        for i in 1..=5 {
            rb.push(i);
        }

        let last_3: Vec<i32> = rb.last_n(3).iter().map(|&&x| x).collect();
        assert_eq!(last_3, vec![3, 4, 5]);

        let last_10: Vec<i32> = rb.last_n(10).iter().map(|&&x| x).collect();
        assert_eq!(last_10, vec![1, 2, 3, 4, 5]);
    }
}
