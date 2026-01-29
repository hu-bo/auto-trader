//! Vector Store for labeled vectors and similarity matching

use std::collections::HashMap;

/// A labeled vector for pattern matching
#[derive(Debug, Clone)]
pub struct LabeledVector {
    pub label: i32,
    pub vector: Vec<f64>,
    pub metadata: Option<HashMap<String, String>>,
}

impl LabeledVector {
    pub fn new(label: i32, vector: Vec<f64>) -> Self {
        Self {
            label,
            vector,
            metadata: None,
        }
    }

    pub fn with_metadata(label: i32, vector: Vec<f64>, metadata: HashMap<String, String>) -> Self {
        Self {
            label,
            vector,
            metadata: Some(metadata),
        }
    }
}

/// Result of a similarity search
#[derive(Debug, Clone)]
pub struct SimilarityResult {
    pub label: i32,
    pub score: f64,
    pub metadata: Option<HashMap<String, String>>,
}

/// Vector store for similarity-based pattern matching
#[derive(Debug, Clone, Default)]
pub struct VectorStore {
    stores: HashMap<String, Vec<LabeledVector>>,
    threshold: f64,
}

impl VectorStore {
    pub fn new() -> Self {
        Self {
            stores: HashMap::new(),
            threshold: 0.9,
        }
    }

    /// Set similarity threshold (default: 0.9)
    pub fn set_threshold(&mut self, threshold: f64) {
        self.threshold = threshold.clamp(0.0, 1.0);
    }

    /// Load labeled vectors into a named store
    pub fn load(&mut self, name: &str, vectors: Vec<LabeledVector>) {
        self.stores.insert(name.to_string(), vectors);
    }

    /// Get a store by name
    pub fn get(&self, name: &str) -> Option<&Vec<LabeledVector>> {
        self.stores.get(name)
    }

    /// Find the most similar vector in a store
    pub fn find_similar(&self, name: &str, query: &[f64]) -> Option<SimilarityResult> {
        let store = self.stores.get(name)?;

        let mut best_score = f64::NEG_INFINITY;
        let mut best_match: Option<&LabeledVector> = None;

        for labeled in store {
            if labeled.vector.len() != query.len() {
                continue;
            }
            let score = cosine_similarity(&labeled.vector, query);
            if score > best_score {
                best_score = score;
                best_match = Some(labeled);
            }
        }

        best_match.and_then(|m| {
            if best_score >= self.threshold {
                Some(SimilarityResult {
                    label: m.label,
                    score: best_score,
                    metadata: m.metadata.clone(),
                })
            } else {
                None
            }
        })
    }

    /// Check if a store exists
    pub fn has_store(&self, name: &str) -> bool {
        self.stores.contains_key(name)
    }

    /// Clear a store
    pub fn clear(&mut self, name: &str) {
        self.stores.remove(name);
    }

    /// Clear all stores
    pub fn clear_all(&mut self) {
        self.stores.clear();
    }
}

/// Calculate cosine similarity between two vectors
pub fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;

    for (x, y) in a.iter().zip(b.iter()) {
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }

    let denom = (norm_a * norm_b).sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}

/// Normalize a vector to unit length
pub fn normalize_vector(v: &[f64]) -> Vec<f64> {
    let norm: f64 = v.iter().map(|x| x * x).sum::<f64>().sqrt();
    if norm == 0.0 {
        v.to_vec()
    } else {
        v.iter().map(|x| x / norm).collect()
    }
}

/// Min-max normalize a vector to [0, 1] range
pub fn min_max_normalize(v: &[f64]) -> Vec<f64> {
    if v.is_empty() {
        return Vec::new();
    }

    let min = v.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = v.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let range = max - min;

    if range == 0.0 {
        vec![0.5; v.len()]
    } else {
        v.iter().map(|x| (x - min) / range).collect()
    }
}

/// Z-score normalize a vector
pub fn z_score_normalize(v: &[f64]) -> Vec<f64> {
    if v.is_empty() {
        return Vec::new();
    }

    let n = v.len() as f64;
    let mean = v.iter().sum::<f64>() / n;
    let variance = v.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n;
    let std_dev = variance.sqrt();

    if std_dev == 0.0 {
        vec![0.0; v.len()]
    } else {
        v.iter().map(|x| (x - mean) / std_dev).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-10);

        let c = vec![0.0, 1.0, 0.0];
        assert!(cosine_similarity(&a, &c).abs() < 1e-10);

        let d = vec![1.0, 1.0, 0.0];
        let e = vec![1.0, 0.0, 0.0];
        let sim = cosine_similarity(&d, &e);
        assert!((sim - 0.7071067811865476).abs() < 1e-10);
    }

    #[test]
    fn test_vector_store() {
        let mut store = VectorStore::new();
        store.set_threshold(0.8);

        store.load(
            "test",
            vec![
                LabeledVector::new(1, vec![1.0, 0.0, 0.0]),
                LabeledVector::new(-1, vec![0.0, 1.0, 0.0]),
            ],
        );

        let result = store.find_similar("test", &[0.9, 0.1, 0.0]);
        assert!(result.is_some());
        assert_eq!(result.unwrap().label, 1);

        let result2 = store.find_similar("test", &[0.1, 0.9, 0.0]);
        assert!(result2.is_some());
        assert_eq!(result2.unwrap().label, -1);
    }

    #[test]
    fn test_min_max_normalize() {
        let v = vec![0.0, 50.0, 100.0];
        let normalized = min_max_normalize(&v);
        assert_eq!(normalized, vec![0.0, 0.5, 1.0]);
    }

    #[test]
    fn test_z_score_normalize() {
        let v = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let normalized = z_score_normalize(&v);

        // Mean should be 0
        let mean: f64 = normalized.iter().sum::<f64>() / normalized.len() as f64;
        assert!(mean.abs() < 1e-10);

        // Std should be 1
        let variance: f64 =
            normalized.iter().map(|x| x.powi(2)).sum::<f64>() / normalized.len() as f64;
        assert!((variance - 1.0).abs() < 1e-10);
    }
}
