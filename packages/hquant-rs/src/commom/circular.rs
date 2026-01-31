use core::fmt;

#[derive(Clone)]
pub struct CircularColumn<T: Copy + Default> {
    data: Vec<T>,
    capacity: usize,
    len: usize,
    head: usize,
}

impl<T: Copy + Default> CircularColumn<T> {
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "capacity must be > 0");
        Self {
            data: vec![T::default(); capacity],
            capacity,
            len: 0,
            head: 0,
        }
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn len(&self) -> usize {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub fn is_full(&self) -> bool {
        self.len == self.capacity
    }

    pub fn push(&mut self, v: T) {
        self.data[self.head] = v;
        self.head = (self.head + 1) % self.capacity;
        if self.len < self.capacity {
            self.len += 1;
        }
    }

    pub fn update_last(&mut self, v: T) {
        if self.len == 0 {
            return;
        }
        let idx = (self.head + self.capacity - 1) % self.capacity;
        self.data[idx] = v;
    }

    pub fn get(&self, i: usize) -> Option<T> {
        if i >= self.len {
            return None;
        }
        let start = (self.head + self.capacity - self.len) % self.capacity;
        let idx = (start + i) % self.capacity;
        Some(self.data[idx])
    }

    pub fn get_from_end(&self, i: usize) -> Option<T> {
        if i >= self.len {
            return None;
        }
        let idx = (self.head + self.capacity - 1 - i) % self.capacity;
        Some(self.data[idx])
    }

    pub fn last(&self) -> Option<T> {
        self.get_from_end(0)
    }

    pub fn raw_parts(&self) -> (*const T, usize, usize, usize) {
        (self.data.as_ptr(), self.capacity, self.len, self.head)
    }

    pub fn to_vec_ordered(&self) -> Vec<T> {
        let mut out = Vec::with_capacity(self.len);
        for i in 0..self.len {
            // Safe: i < len
            out.push(self.get(i).unwrap());
        }
        out
    }

    pub fn iter(&self) -> CircularIter<'_, T> {
        CircularIter { col: self, i: 0 }
    }

    pub fn clear(&mut self) {
        self.len = 0;
        self.head = 0;
        self.data.fill(T::default());
    }
}

impl<T: Copy + Default + fmt::Debug> fmt::Debug for CircularColumn<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("CircularColumn")
            .field("capacity", &self.capacity)
            .field("len", &self.len)
            .field("head", &self.head)
            .field("data_ordered", &self.to_vec_ordered())
            .finish()
    }
}

pub struct CircularIter<'a, T: Copy + Default> {
    col: &'a CircularColumn<T>,
    i: usize,
}

impl<'a, T: Copy + Default> Iterator for CircularIter<'a, T> {
    type Item = T;

    fn next(&mut self) -> Option<Self::Item> {
        let v = self.col.get(self.i)?;
        self.i += 1;
        Some(v)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.col.len.saturating_sub(self.i);
        (remaining, Some(remaining))
    }
}

impl<'a, T: Copy + Default> ExactSizeIterator for CircularIter<'a, T> {}

impl<'a, T: Copy + Default> IntoIterator for &'a CircularColumn<T> {
    type Item = T;
    type IntoIter = CircularIter<'a, T>;

    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}

