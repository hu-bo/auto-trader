/// Typed Ring Buffer - 支持 TypedArray 风格的高性能环形缓冲区
///
/// 类似 JavaScript 的 Float64Array / Int32Array 的环形缓冲区实现
/// 支持 f64 和 i32 两种类型

/// f64 类型的环形缓冲区 (类似 Float64Array)
#[derive(Debug, Clone)]
pub struct Float64RingBuffer {
    buffer: Vec<f64>,
    capacity: usize,
    front: usize,
    rear: usize,
    len: usize,
}

impl Float64RingBuffer {
    /// 创建指定容量的缓冲区
    #[inline]
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "capacity must be > 0");
        Self {
            buffer: vec![0.0; capacity],
            capacity,
            front: 0,
            rear: 0,
            len: 0,
        }
    }

    /// 追加元素，队列满时覆盖最旧数据
    #[inline]
    pub fn push(&mut self, value: f64) {
        if self.len == self.capacity {
            // 队列满，覆盖最旧数据
            self.front = (self.front + 1) % self.capacity;
            self.len -= 1;
        }
        self.buffer[self.rear] = value;
        self.rear = (self.rear + 1) % self.capacity;
        self.len += 1;
    }

    /// 从队首移除并返回元素
    #[inline]
    pub fn shift(&mut self) -> Option<f64> {
        if self.len == 0 {
            return None;
        }
        let value = self.buffer[self.front];
        self.front = (self.front + 1) % self.capacity;
        self.len -= 1;
        Some(value)
    }

    /// 从队尾移除并返回元素
    #[inline]
    pub fn pop(&mut self) -> Option<f64> {
        if self.len == 0 {
            return None;
        }
        self.rear = (self.rear + self.capacity - 1) % self.capacity;
        let value = self.buffer[self.rear];
        self.len -= 1;
        Some(value)
    }

    /// 更新指定索引的值
    #[inline]
    pub fn update(&mut self, index: usize, value: f64) -> bool {
        if index >= self.len {
            return false;
        }
        let i = (self.front + index) % self.capacity;
        self.buffer[i] = value;
        true
    }

    /// 更新最后一个元素
    #[inline]
    pub fn update_last(&mut self, value: f64) -> bool {
        if self.len == 0 {
            return false;
        }
        let last_idx = (self.rear + self.capacity - 1) % self.capacity;
        self.buffer[last_idx] = value;
        true
    }

    /// 获取指定索引的值
    #[inline]
    pub fn get(&self, index: usize) -> Option<f64> {
        if index >= self.len {
            return None;
        }
        let i = (self.front + index) % self.capacity;
        Some(self.buffer[i])
    }

    /// 获取最后一个元素
    #[inline]
    pub fn last(&self) -> Option<f64> {
        if self.len == 0 {
            None
        } else {
            self.get(self.len - 1)
        }
    }

    /// 获取倒数第 n 个元素 (1 = 最后一个)
    #[inline]
    pub fn get_from_end(&self, n: usize) -> Option<f64> {
        if n == 0 || n > self.len {
            return None;
        }
        self.get(self.len - n)
    }

    /// 当前元素数量
    #[inline]
    pub fn len(&self) -> usize {
        self.len
    }

    /// 是否为空
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// 是否已满
    #[inline]
    pub fn is_full(&self) -> bool {
        self.len == self.capacity
    }

    /// 容量
    #[inline]
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// 清空
    #[inline]
    pub fn clear(&mut self) {
        self.buffer.fill(0.0);
        self.front = 0;
        self.rear = 0;
        self.len = 0;
    }

    /// 迭代器
    pub fn iter(&self) -> Float64RingBufferIter<'_> {
        Float64RingBufferIter {
            buffer: self,
            index: 0,
        }
    }

    /// 转换为 Vec
    pub fn to_vec(&self) -> Vec<f64> {
        self.iter().collect()
    }
}

/// f64 环形缓冲区迭代器
pub struct Float64RingBufferIter<'a> {
    buffer: &'a Float64RingBuffer,
    index: usize,
}

impl<'a> Iterator for Float64RingBufferIter<'a> {
    type Item = f64;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        if self.index >= self.buffer.len {
            return None;
        }
        let value = self.buffer.get(self.index);
        self.index += 1;
        value
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.buffer.len - self.index;
        (remaining, Some(remaining))
    }
}

impl<'a> ExactSizeIterator for Float64RingBufferIter<'a> {}

// ============================================================================
// Int32RingBuffer
// ============================================================================

/// i32 类型的环形缓冲区 (类似 Int32Array)
#[derive(Debug, Clone)]
pub struct Int32RingBuffer {
    buffer: Vec<i32>,
    capacity: usize,
    front: usize,
    rear: usize,
    len: usize,
}

impl Int32RingBuffer {
    /// 创建指定容量的缓冲区
    #[inline]
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "capacity must be > 0");
        Self {
            buffer: vec![0; capacity],
            capacity,
            front: 0,
            rear: 0,
            len: 0,
        }
    }

    /// 追加元素，队列满时覆盖最旧数据
    #[inline]
    pub fn push(&mut self, value: i32) {
        if self.len == self.capacity {
            self.front = (self.front + 1) % self.capacity;
            self.len -= 1;
        }
        self.buffer[self.rear] = value;
        self.rear = (self.rear + 1) % self.capacity;
        self.len += 1;
    }

    /// 从队首移除并返回元素
    #[inline]
    pub fn shift(&mut self) -> Option<i32> {
        if self.len == 0 {
            return None;
        }
        let value = self.buffer[self.front];
        self.front = (self.front + 1) % self.capacity;
        self.len -= 1;
        Some(value)
    }

    /// 从队尾移除并返回元素
    #[inline]
    pub fn pop(&mut self) -> Option<i32> {
        if self.len == 0 {
            return None;
        }
        self.rear = (self.rear + self.capacity - 1) % self.capacity;
        let value = self.buffer[self.rear];
        self.len -= 1;
        Some(value)
    }

    /// 更新指定索引的值
    #[inline]
    pub fn update(&mut self, index: usize, value: i32) -> bool {
        if index >= self.len {
            return false;
        }
        let i = (self.front + index) % self.capacity;
        self.buffer[i] = value;
        true
    }

    /// 更新最后一个元素
    #[inline]
    pub fn update_last(&mut self, value: i32) -> bool {
        if self.len == 0 {
            return false;
        }
        let last_idx = (self.rear + self.capacity - 1) % self.capacity;
        self.buffer[last_idx] = value;
        true
    }

    /// 获取指定索引的值
    #[inline]
    pub fn get(&self, index: usize) -> Option<i32> {
        if index >= self.len {
            return None;
        }
        let i = (self.front + index) % self.capacity;
        Some(self.buffer[i])
    }

    /// 获取最后一个元素
    #[inline]
    pub fn last(&self) -> Option<i32> {
        if self.len == 0 {
            None
        } else {
            self.get(self.len - 1)
        }
    }

    /// 获取倒数第 n 个元素 (1 = 最后一个)
    #[inline]
    pub fn get_from_end(&self, n: usize) -> Option<i32> {
        if n == 0 || n > self.len {
            return None;
        }
        self.get(self.len - n)
    }

    /// 当前元素数量
    #[inline]
    pub fn len(&self) -> usize {
        self.len
    }

    /// 是否为空
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// 是否已满
    #[inline]
    pub fn is_full(&self) -> bool {
        self.len == self.capacity
    }

    /// 容量
    #[inline]
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// 清空
    #[inline]
    pub fn clear(&mut self) {
        self.buffer.fill(0);
        self.front = 0;
        self.rear = 0;
        self.len = 0;
    }

    /// 迭代器
    pub fn iter(&self) -> Int32RingBufferIter<'_> {
        Int32RingBufferIter {
            buffer: self,
            index: 0,
        }
    }

    /// 转换为 Vec
    pub fn to_vec(&self) -> Vec<i32> {
        self.iter().collect()
    }
}

/// i32 环形缓冲区迭代器
pub struct Int32RingBufferIter<'a> {
    buffer: &'a Int32RingBuffer,
    index: usize,
}

impl<'a> Iterator for Int32RingBufferIter<'a> {
    type Item = i32;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        if self.index >= self.buffer.len {
            return None;
        }
        let value = self.buffer.get(self.index);
        self.index += 1;
        value
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.buffer.len - self.index;
        (remaining, Some(remaining))
    }
}

impl<'a> ExactSizeIterator for Int32RingBufferIter<'a> {}

#[cfg(test)]
mod tests {
    use super::*;

    // ========== Float64RingBuffer Tests ==========

    #[test]
    fn test_float64_basic() {
        let mut rb = Float64RingBuffer::new(3);

        rb.push(1.0);
        rb.push(2.0);
        rb.push(3.0);

        assert_eq!(rb.len(), 3);
        assert!(rb.is_full());
        assert_eq!(rb.get(0), Some(1.0));
        assert_eq!(rb.get(1), Some(2.0));
        assert_eq!(rb.get(2), Some(3.0));
        assert_eq!(rb.last(), Some(3.0));
    }

    #[test]
    fn test_float64_overflow() {
        let mut rb = Float64RingBuffer::new(3);

        rb.push(1.0);
        rb.push(2.0);
        rb.push(3.0);
        rb.push(4.0); // 覆盖 1.0

        assert_eq!(rb.len(), 3);
        assert_eq!(rb.get(0), Some(2.0));
        assert_eq!(rb.get(1), Some(3.0));
        assert_eq!(rb.get(2), Some(4.0));
    }

    #[test]
    fn test_float64_shift() {
        let mut rb = Float64RingBuffer::new(3);

        rb.push(1.0);
        rb.push(2.0);
        rb.push(3.0);

        assert_eq!(rb.shift(), Some(1.0));
        assert_eq!(rb.len(), 2);
        assert_eq!(rb.get(0), Some(2.0));
    }

    #[test]
    fn test_float64_pop() {
        let mut rb = Float64RingBuffer::new(3);

        rb.push(1.0);
        rb.push(2.0);
        rb.push(3.0);

        assert_eq!(rb.pop(), Some(3.0));
        assert_eq!(rb.len(), 2);
        assert_eq!(rb.last(), Some(2.0));
    }

    #[test]
    fn test_float64_update() {
        let mut rb = Float64RingBuffer::new(3);

        rb.push(1.0);
        rb.push(2.0);
        rb.push(3.0);

        assert!(rb.update(1, 20.0));
        assert_eq!(rb.get(1), Some(20.0));

        assert!(!rb.update(5, 50.0)); // 越界
    }

    #[test]
    fn test_float64_update_last() {
        let mut rb = Float64RingBuffer::new(3);

        rb.push(1.0);
        rb.push(2.0);

        assert!(rb.update_last(20.0));
        assert_eq!(rb.last(), Some(20.0));
    }

    #[test]
    fn test_float64_get_from_end() {
        let mut rb = Float64RingBuffer::new(5);
        for i in 1..=5 {
            rb.push(i as f64);
        }

        assert_eq!(rb.get_from_end(1), Some(5.0)); // 最后一个
        assert_eq!(rb.get_from_end(2), Some(4.0));
        assert_eq!(rb.get_from_end(5), Some(1.0)); // 第一个
        assert_eq!(rb.get_from_end(6), None); // 越界
    }

    #[test]
    fn test_float64_iter() {
        let mut rb = Float64RingBuffer::new(3);
        rb.push(1.0);
        rb.push(2.0);
        rb.push(3.0);
        rb.push(4.0); // 覆盖 1.0

        let vals: Vec<f64> = rb.iter().collect();
        assert_eq!(vals, vec![2.0, 3.0, 4.0]);
    }

    #[test]
    fn test_float64_clear() {
        let mut rb = Float64RingBuffer::new(3);
        rb.push(1.0);
        rb.push(2.0);

        rb.clear();

        assert!(rb.is_empty());
        assert_eq!(rb.len(), 0);
    }

    // ========== Int32RingBuffer Tests ==========

    #[test]
    fn test_int32_basic() {
        let mut rb = Int32RingBuffer::new(3);

        rb.push(1);
        rb.push(2);
        rb.push(3);

        assert_eq!(rb.len(), 3);
        assert!(rb.is_full());
        assert_eq!(rb.get(0), Some(1));
        assert_eq!(rb.get(1), Some(2));
        assert_eq!(rb.get(2), Some(3));
    }

    #[test]
    fn test_int32_overflow() {
        let mut rb = Int32RingBuffer::new(3);

        rb.push(1);
        rb.push(2);
        rb.push(3);
        rb.push(4);

        assert_eq!(rb.len(), 3);
        assert_eq!(rb.get(0), Some(2));
        assert_eq!(rb.get(1), Some(3));
        assert_eq!(rb.get(2), Some(4));
    }

    #[test]
    fn test_int32_shift_pop() {
        let mut rb = Int32RingBuffer::new(3);

        rb.push(1);
        rb.push(2);
        rb.push(3);

        assert_eq!(rb.shift(), Some(1));
        assert_eq!(rb.pop(), Some(3));
        assert_eq!(rb.len(), 1);
        assert_eq!(rb.get(0), Some(2));
    }

    #[test]
    fn test_int32_iter() {
        let mut rb = Int32RingBuffer::new(3);
        rb.push(1);
        rb.push(2);
        rb.push(3);
        rb.push(4);

        let vals: Vec<i32> = rb.iter().collect();
        assert_eq!(vals, vec![2, 3, 4]);
    }
}
