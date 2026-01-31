use std::collections::HashMap;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SimilarityMethod {
    Cosine,
    Pearson,
    Euclidean,
    Manhattan,
    Chebyshev,
}

impl SimilarityMethod {
    pub fn parse(s: &str) -> Option<Self> {
        let s = s.trim().to_ascii_lowercase();
        match s.as_str() {
            "cosine" => Some(SimilarityMethod::Cosine),
            "pearson" | "corr" | "correlation" => Some(SimilarityMethod::Pearson),
            "euclidean" | "l2" => Some(SimilarityMethod::Euclidean),
            "manhattan" | "l1" => Some(SimilarityMethod::Manhattan),
            "chebyshev" | "linf" | "l_inf" => Some(SimilarityMethod::Chebyshev),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct LabeledVector {
    pub label: i32,
    pub vector: Vec<f64>,
    pub ts: Option<i64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SimilarityResult {
    pub label: i32,
    pub score: f64,
    pub ts: Option<i64>,
}

#[derive(Clone, Debug)]
pub struct VectorStore {
    stores: HashMap<String, Vec<LabeledVector>>,
    pub threshold: f64,
}

impl Default for VectorStore {
    fn default() -> Self {
        Self::new()
    }
}

impl VectorStore {
    pub fn new() -> Self {
        Self {
            stores: HashMap::new(),
            threshold: 0.9,
        }
    }

    pub fn load(&mut self, name: &str, vectors: Vec<LabeledVector>) {
        self.stores.insert(name.to_string(), vectors);
    }

    pub fn has_store(&self, name: &str) -> bool {
        self.stores.contains_key(name)
    }

    pub fn find_similar(&self, name: &str, query: &[f64]) -> Option<SimilarityResult> {
        self.find_similar_by(name, query, SimilarityMethod::Cosine)
    }

    pub fn find_similar_by(
        &self,
        name: &str,
        query: &[f64],
        method: SimilarityMethod,
    ) -> Option<SimilarityResult> {
        self.find_similar_by_threshold(name, query, method, self.threshold)
    }

    pub fn find_similar_by_threshold(
        &self,
        name: &str,
        query: &[f64],
        method: SimilarityMethod,
        threshold: f64,
    ) -> Option<SimilarityResult> {
        let best = self.find_best_by(name, query, method)?;
        if best.score >= threshold {
            Some(best)
        } else {
            None
        }
    }

    pub fn find_best_by(
        &self,
        name: &str,
        query: &[f64],
        method: SimilarityMethod,
    ) -> Option<SimilarityResult> {
        let vectors = self.stores.get(name)?;
        let mut best: Option<SimilarityResult> = None;
        for v in vectors {
            if v.vector.len() != query.len() || v.vector.is_empty() {
                continue;
            }
            let score = similarity(&v.vector, query, method);
            if !score.is_finite() {
                continue;
            }
            let is_better = best.as_ref().map(|b| score > b.score).unwrap_or(true);
            if is_better {
                best = Some(SimilarityResult {
                    label: v.label,
                    score,
                    ts: v.ts,
                });
            }
        }
        best
    }

    pub fn clear(&mut self) {
        self.stores.clear();
    }
}

pub fn similarity(a: &[f64], b: &[f64], method: SimilarityMethod) -> f64 {
    match method {
        SimilarityMethod::Cosine => cosine_similarity(a, b),
        SimilarityMethod::Pearson => pearson_correlation(a, b),
        SimilarityMethod::Euclidean => euclidean_similarity(a, b),
        SimilarityMethod::Manhattan => manhattan_similarity(a, b),
        SimilarityMethod::Chebyshev => chebyshev_similarity(a, b),
    }
}

pub fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return f64::NAN;
    }
    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;
    for (x, y) in a.iter().zip(b) {
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }
    if norm_a == 0.0 || norm_b == 0.0 {
        return f64::NAN;
    }
    dot / (norm_a.sqrt() * norm_b.sqrt())
}

pub fn pearson_correlation(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return f64::NAN;
    }
    let n = a.len() as f64;
    let mean_a = a.iter().sum::<f64>() / n;
    let mean_b = b.iter().sum::<f64>() / n;
    let mut cov = 0.0;
    let mut var_a = 0.0;
    let mut var_b = 0.0;
    for (&x, &y) in a.iter().zip(b) {
        let da = x - mean_a;
        let db = y - mean_b;
        cov += da * db;
        var_a += da * da;
        var_b += db * db;
    }
    if var_a == 0.0 || var_b == 0.0 {
        return f64::NAN;
    }
    let r = cov / (var_a.sqrt() * var_b.sqrt());
    r.clamp(-1.0, 1.0)
}

pub fn euclidean_distance(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return f64::NAN;
    }
    let mut sum = 0.0;
    for (&x, &y) in a.iter().zip(b) {
        let d = x - y;
        sum += d * d;
    }
    sum.sqrt()
}

pub fn manhattan_distance(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return f64::NAN;
    }
    let mut sum = 0.0;
    for (&x, &y) in a.iter().zip(b) {
        sum += (x - y).abs();
    }
    sum
}

pub fn chebyshev_distance(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return f64::NAN;
    }
    let mut m = 0.0;
    for (&x, &y) in a.iter().zip(b) {
        let d = (x - y).abs();
        if d > m {
            m = d;
        }
    }
    m
}

pub fn euclidean_similarity(a: &[f64], b: &[f64]) -> f64 {
    let d = euclidean_distance(a, b);
    if !d.is_finite() {
        return f64::NAN;
    }
    1.0 / (1.0 + d)
}

pub fn manhattan_similarity(a: &[f64], b: &[f64]) -> f64 {
    let d = manhattan_distance(a, b);
    if !d.is_finite() {
        return f64::NAN;
    }
    1.0 / (1.0 + d)
}

pub fn chebyshev_similarity(a: &[f64], b: &[f64]) -> f64 {
    let d = chebyshev_distance(a, b);
    if !d.is_finite() {
        return f64::NAN;
    }
    1.0 / (1.0 + d)
}

pub fn normalize_vector(v: &[f64]) -> Vec<f64> {
    let mut norm = 0.0;
    for x in v {
        norm += x * x;
    }
    norm = norm.sqrt();
    if norm == 0.0 || !norm.is_finite() {
        return vec![0.0; v.len()];
    }
    v.iter().map(|x| x / norm).collect()
}

pub fn min_max_normalize(v: &[f64]) -> Vec<f64> {
    if v.is_empty() {
        return vec![];
    }
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    for &x in v {
        if x < min {
            min = x;
        }
        if x > max {
            max = x;
        }
    }
    let range = max - min;
    if range == 0.0 || !range.is_finite() {
        return vec![0.0; v.len()];
    }
    v.iter().map(|x| (x - min) / range).collect()
}

pub fn z_score_normalize(v: &[f64]) -> Vec<f64> {
    if v.is_empty() {
        return vec![];
    }
    let mean = v.iter().sum::<f64>() / (v.len() as f64);
    let mut var = 0.0;
    for &x in v {
        let d = x - mean;
        var += d * d;
    }
    var /= v.len() as f64;
    let std = var.sqrt();
    if std == 0.0 || !std.is_finite() {
        return vec![0.0; v.len()];
    }
    v.iter().map(|x| (x - mean) / std).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn similarity_methods_basic() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![1.0, 2.0, 3.0];
        let c = vec![-1.0, -2.0, -3.0];

        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-12);
        assert!((pearson_correlation(&a, &b) - 1.0).abs() < 1e-12);
        assert!((euclidean_similarity(&a, &b) - 1.0).abs() < 1e-12);
        assert!((manhattan_similarity(&a, &b) - 1.0).abs() < 1e-12);
        assert!((chebyshev_similarity(&a, &b) - 1.0).abs() < 1e-12);

        assert!((cosine_similarity(&a, &c) + 1.0).abs() < 1e-12);
        assert!((pearson_correlation(&a, &c) + 1.0).abs() < 1e-12);
    }

    #[test]
    fn vector_store_find_similar_by_method() {
        let mut store = VectorStore::new();
        store.threshold = 0.8;
        store.load(
            "s",
            vec![
                LabeledVector {
                    label: 1,
                    vector: vec![1.0, 0.0],
                    ts: None,
                },
                LabeledVector {
                    label: 2,
                    vector: vec![0.0, 1.0],
                    ts: None,
                },
            ],
        );

        let r1 = store
            .find_similar_by("s", &[1.0, 0.0], SimilarityMethod::Cosine)
            .unwrap();
        assert_eq!(r1.label, 1);

        let r2 = store
            .find_similar_by("s", &[1.0, 0.0], SimilarityMethod::Euclidean)
            .unwrap();
        assert_eq!(r2.label, 1);

        let r3 = store
            .find_similar_by("s", &[1.0, 0.0], SimilarityMethod::Pearson)
            .unwrap();
        assert_eq!(r3.label, 1);
    }
}
