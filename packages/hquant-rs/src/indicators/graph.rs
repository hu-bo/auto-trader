//! Indicator Graph — DAG-based indicator management with deduplication.
//!
//! Core responsibilities:
//! - **Deduplication**: identical IndicatorSpec → same node, no duplicate computation
//! - **Dependency resolution**: composite indicators (MACD, BOLL) automatically share
//!   their sub-indicators (EMA, SMA, StdDev) with other nodes in the graph
//! - **Topological execution**: dependencies are always computed before dependents
//!
//! # Example
//! ```ignore
//! let mut graph = IndicatorGraph::new();
//!
//! // Adding MACD auto-creates EMA(12) and EMA(26) as shared deps
//! graph.add_with_name("macd", IndicatorSpec::macd(12, 26, 9))?;
//!
//! // This reuses the existing EMA(12) node — zero extra computation
//! graph.add_with_name("ema12", IndicatorSpec::ema(12))?;
//!
//! // Push processes all indicators in correct topological order
//! graph.push(&bar);
//! ```

use std::collections::HashMap;

use super::{
    spec::{IndicatorId, IndicatorSpec},
    Indicator, IndicatorValue, MAType, StdDev, ATR, BOLL, MA, MACD, RSI, VRI,
};
use crate::kline::Bar;
use crate::HQuantResult;

// ---------------------------------------------------------------------------
// IndicatorNode — single node in the graph
// ---------------------------------------------------------------------------

struct IndicatorNode {
    /// Spec (None for opaque/builder-created indicators)
    spec: Option<IndicatorSpec>,
    /// The indicator instance
    indicator: Box<dyn Indicator>,
    /// Indices of dependency nodes (order matches indicator.deps())
    deps: Vec<IndicatorId>,
}

// ---------------------------------------------------------------------------
// IndicatorGraph
// ---------------------------------------------------------------------------

/// DAG-based indicator container with automatic deduplication and topological execution.
pub struct IndicatorGraph {
    /// Spec → ID mapping for deduplication
    spec_map: HashMap<IndicatorSpec, IndicatorId>,
    /// All indicator nodes (indexed by IndicatorId)
    nodes: Vec<IndicatorNode>,
    /// Topological execution order (lazy, recomputed when dirty)
    execution_order: Vec<IndicatorId>,
    /// Named aliases for user-facing access
    aliases: HashMap<String, IndicatorId>,
    /// Whether execution_order needs recomputation
    order_dirty: bool,
}

impl IndicatorGraph {
    pub fn new() -> Self {
        Self {
            spec_map: HashMap::new(),
            nodes: Vec::new(),
            execution_order: Vec::new(),
            aliases: HashMap::new(),
            order_dirty: false,
        }
    }

    /// Register an indicator by spec. Returns existing ID if already registered.
    /// Automatically creates and registers dependencies for composite indicators.
    pub fn add(&mut self, spec: IndicatorSpec) -> HQuantResult<IndicatorId> {
        // Dedup: return existing if same spec already in graph
        if let Some(&id) = self.spec_map.get(&spec) {
            return Ok(id);
        }

        // Recursively ensure dependencies exist first
        let dep_specs = spec.dependencies();
        let dep_ids: Vec<IndicatorId> = dep_specs
            .into_iter()
            .map(|dep_spec| self.add(dep_spec))
            .collect::<HQuantResult<Vec<_>>>()?;

        // Create the indicator instance
        let has_deps = !dep_ids.is_empty();
        let indicator = build_indicator(&spec, has_deps)?;

        let id = IndicatorId(self.nodes.len());
        self.nodes.push(IndicatorNode {
            spec: Some(spec.clone()),
            indicator,
            deps: dep_ids,
        });
        self.spec_map.insert(spec, id);
        self.order_dirty = true;

        Ok(id)
    }

    /// Register an indicator by spec with a user-facing name alias.
    /// Returns existing ID (with new alias) if the spec is already registered.
    pub fn add_with_name(
        &mut self,
        name: impl Into<String>,
        spec: IndicatorSpec,
    ) -> HQuantResult<IndicatorId> {
        let id = self.add(spec)?;
        self.aliases.insert(name.into(), id);
        Ok(id)
    }

    /// Add a pre-built indicator (opaque, not deduplicated).
    /// Useful for builder-pattern indicators and dynamic indicators.
    pub fn add_boxed(
        &mut self,
        name: impl Into<String>,
        indicator: Box<dyn Indicator>,
    ) -> IndicatorId {
        let id = IndicatorId(self.nodes.len());
        self.nodes.push(IndicatorNode {
            spec: None,
            indicator,
            deps: vec![],
        });
        self.aliases.insert(name.into(), id);
        self.order_dirty = true;
        id
    }

    /// Set a name alias for an existing indicator ID.
    pub fn set_alias(&mut self, name: impl Into<String>, id: IndicatorId) {
        self.aliases.insert(name.into(), id);
    }

    /// Look up an indicator ID by name.
    pub fn id_by_name(&self, name: &str) -> Option<IndicatorId> {
        self.aliases.get(name).copied()
    }

    /// Look up an indicator ID by spec.
    pub fn id_by_spec(&self, spec: &IndicatorSpec) -> Option<IndicatorId> {
        self.spec_map.get(spec).copied()
    }

    /// Total number of indicator nodes (including auto-created dependencies).
    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    // -----------------------------------------------------------------------
    // Push / Update
    // -----------------------------------------------------------------------

    /// Push a new bar through all indicators in topological order.
    pub fn push(&mut self, bar: &Bar) {
        self.ensure_order();

        // Clone execution order to avoid borrow conflict
        let order = self.execution_order.clone();
        // Value cache: stores value() after each node's push
        let mut values: Vec<Option<f64>> = vec![None; self.nodes.len()];

        for &id in &order {
            // Collect dependency values from already-computed nodes
            let dep_values: Vec<Option<f64>> =
                self.nodes[id.0].deps.iter().map(|d| values[d.0]).collect();

            let node = &mut self.nodes[id.0];
            if dep_values.is_empty() {
                node.indicator.push(bar);
            } else {
                node.indicator.push_with_deps(bar, &dep_values);
            }
            values[id.0] = node.indicator.value();
        }
    }

    /// Update the last bar through all indicators in topological order.
    pub fn update_last(&mut self, bar: &Bar) {
        self.ensure_order();

        let order = self.execution_order.clone();
        let mut values: Vec<Option<f64>> = vec![None; self.nodes.len()];

        for &id in &order {
            let dep_values: Vec<Option<f64>> =
                self.nodes[id.0].deps.iter().map(|d| values[d.0]).collect();

            let node = &mut self.nodes[id.0];
            if dep_values.is_empty() {
                node.indicator.update_last(bar);
            } else {
                node.indicator.update_last_with_deps(bar, &dep_values);
            }
            values[id.0] = node.indicator.value();
        }
    }

    // -----------------------------------------------------------------------
    // Accessors
    // -----------------------------------------------------------------------

    /// Get indicator value by ID.
    pub fn value(&self, id: IndicatorId) -> Option<f64> {
        self.nodes.get(id.0).and_then(|n| n.indicator.value())
    }

    /// Get indicator value by name.
    pub fn value_by_name(&self, name: &str) -> Option<f64> {
        self.aliases.get(name).and_then(|&id| self.value(id))
    }

    /// Get full indicator result by ID.
    pub fn result(&self, id: IndicatorId) -> Option<IndicatorValue> {
        self.nodes.get(id.0).and_then(|n| n.indicator.result())
    }

    /// Get full indicator result by name.
    pub fn result_by_name(&self, name: &str) -> Option<IndicatorValue> {
        self.aliases.get(name).and_then(|&id| self.result(id))
    }

    /// Check if indicator is ready by ID.
    pub fn is_ready(&self, id: IndicatorId) -> bool {
        self.nodes
            .get(id.0)
            .map(|n| n.indicator.is_ready())
            .unwrap_or(false)
    }

    /// Check if indicator is ready by name.
    pub fn is_ready_by_name(&self, name: &str) -> bool {
        self.aliases
            .get(name)
            .and_then(|&id| self.nodes.get(id.0))
            .map(|n| n.indicator.is_ready())
            .unwrap_or(false)
    }

    /// Get reference to indicator by ID.
    pub fn indicator(&self, id: IndicatorId) -> Option<&dyn Indicator> {
        self.nodes.get(id.0).map(|n| n.indicator.as_ref())
    }

    /// Get reference to indicator by name.
    pub fn indicator_by_name(&self, name: &str) -> Option<&dyn Indicator> {
        self.aliases
            .get(name)
            .and_then(|&id| self.nodes.get(id.0))
            .map(|n| n.indicator.as_ref())
    }

    /// Get value from the end by name (for strategies).
    pub fn value_from_end_by_name(&self, name: &str, n: usize) -> Option<f64> {
        self.aliases
            .get(name)
            .and_then(|&id| self.nodes.get(id.0))
            .and_then(|n_ref| n_ref.indicator.get_from_end(n))
    }

    /// Get the alias map (for IndicatorSnapshot compatibility).
    pub fn aliases(&self) -> &HashMap<String, IndicatorId> {
        &self.aliases
    }

    /// Reset all indicators.
    pub fn reset(&mut self) {
        for node in &mut self.nodes {
            node.indicator.reset();
        }
    }

    /// Summary of the graph for debugging.
    pub fn summary(&self) -> GraphSummary {
        let total = self.nodes.len();
        let with_spec = self.nodes.iter().filter(|n| n.spec.is_some()).count();
        let composites = self.nodes.iter().filter(|n| !n.deps.is_empty()).count();
        GraphSummary {
            total_nodes: total,
            spec_nodes: with_spec,
            opaque_nodes: total - with_spec,
            composite_nodes: composites,
            named_aliases: self.aliases.len(),
        }
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    fn ensure_order(&mut self) {
        if self.order_dirty {
            self.compute_topological_order();
            self.order_dirty = false;
        }
    }

    /// Kahn's algorithm for topological sort.
    fn compute_topological_order(&mut self) {
        let n = self.nodes.len();
        let mut in_degree = vec![0usize; n];
        let mut adj: Vec<Vec<usize>> = vec![vec![]; n];

        for (i, node) in self.nodes.iter().enumerate() {
            for dep in &node.deps {
                adj[dep.0].push(i);
                in_degree[i] += 1;
            }
        }

        // Start with nodes that have no dependencies
        let mut queue: Vec<usize> = (0..n).filter(|&i| in_degree[i] == 0).collect();
        let mut order = Vec::with_capacity(n);

        while let Some(u) = queue.pop() {
            order.push(IndicatorId(u));
            for &v in &adj[u] {
                in_degree[v] -= 1;
                if in_degree[v] == 0 {
                    queue.push(v);
                }
            }
        }

        debug_assert_eq!(order.len(), n, "Cycle detected in indicator graph");
        self.execution_order = order;
    }
}

// ---------------------------------------------------------------------------
// GraphSummary
// ---------------------------------------------------------------------------

/// Summary of the indicator graph for debugging and inspection.
#[derive(Debug)]
pub struct GraphSummary {
    pub total_nodes: usize,
    pub spec_nodes: usize,
    pub opaque_nodes: usize,
    pub composite_nodes: usize,
    pub named_aliases: usize,
}

impl std::fmt::Display for GraphSummary {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "IndicatorGraph {{ nodes: {}, spec: {}, opaque: {}, composite: {}, aliases: {} }}",
            self.total_nodes,
            self.spec_nodes,
            self.opaque_nodes,
            self.composite_nodes,
            self.named_aliases,
        )
    }
}

// ---------------------------------------------------------------------------
// Factory: IndicatorSpec → Box<dyn Indicator>
// ---------------------------------------------------------------------------

fn build_indicator(spec: &IndicatorSpec, has_deps: bool) -> HQuantResult<Box<dyn Indicator>> {
    match spec {
        IndicatorSpec::Sma { period, price_type } => Ok(Box::new(MA::with_price_type(
            *period,
            MAType::SMA,
            *price_type,
        )?)),
        IndicatorSpec::Ema { period, price_type } => Ok(Box::new(MA::with_price_type(
            *period,
            MAType::EMA,
            *price_type,
        )?)),
        IndicatorSpec::Wma { period, price_type } => Ok(Box::new(MA::with_price_type(
            *period,
            MAType::WMA,
            *price_type,
        )?)),
        IndicatorSpec::Rsi { period, price_type } => {
            Ok(Box::new(RSI::with_price_type(*period, *price_type)?))
        }
        IndicatorSpec::Atr { period } => Ok(Box::new(ATR::new(*period)?)),
        IndicatorSpec::Vri { period } => Ok(Box::new(VRI::new(*period)?)),
        IndicatorSpec::StdDev { period, price_type } => {
            Ok(Box::new(StdDev::with_price_type(*period, *price_type)?))
        }
        IndicatorSpec::Macd {
            fast_period,
            slow_period,
            signal_period,
            price_type,
        } => {
            if has_deps {
                // Graph mode: EMAs provided by dependencies
                Ok(Box::new(MACD::new_graph_mode(
                    *fast_period,
                    *slow_period,
                    *signal_period,
                    *price_type,
                )?))
            } else {
                Ok(Box::new(MACD::with_price_type(
                    *fast_period,
                    *slow_period,
                    *signal_period,
                    *price_type,
                )?))
            }
        }
        IndicatorSpec::Boll {
            period,
            std_dev_factor,
            price_type,
        } => {
            if has_deps {
                // Graph mode: SMA and StdDev provided by dependencies
                Ok(Box::new(BOLL::new_graph_mode(
                    *period,
                    std_dev_factor.value(),
                    *price_type,
                )?))
            } else {
                Ok(Box::new(BOLL::with_price_type(
                    *period,
                    std_dev_factor.value(),
                    *price_type,
                )?))
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kline::Bar;

    fn create_bars(prices: &[f64]) -> Vec<Bar> {
        prices
            .iter()
            .enumerate()
            .map(|(i, &p)| Bar::new(i as i64 * 1000, p, p + 1.0, p - 1.0, p, 100.0))
            .collect()
    }

    #[test]
    fn test_graph_basic() {
        let mut graph = IndicatorGraph::new();
        graph
            .add_with_name("ema20", IndicatorSpec::ema(20))
            .unwrap();

        let prices: Vec<f64> = (0..30).map(|i| 100.0 + i as f64).collect();
        let bars = create_bars(&prices);

        for bar in &bars {
            graph.push(bar);
        }

        assert!(graph.is_ready_by_name("ema20"));
        assert!(graph.value_by_name("ema20").is_some());
    }

    #[test]
    fn test_graph_dedup() {
        let mut graph = IndicatorGraph::new();

        let id1 = graph.add(IndicatorSpec::ema(12)).unwrap();
        let id2 = graph.add(IndicatorSpec::ema(12)).unwrap();

        // Same spec → same ID
        assert_eq!(id1, id2);
        assert_eq!(graph.len(), 1);
    }

    #[test]
    fn test_graph_macd_shares_ema() {
        let mut graph = IndicatorGraph::new();

        // Add MACD — should auto-create EMA(12) and EMA(26)
        graph
            .add_with_name("macd", IndicatorSpec::macd(12, 26, 9))
            .unwrap();
        assert_eq!(graph.len(), 3); // EMA(12) + EMA(26) + MACD

        // Add standalone EMA(12) — should reuse existing node
        let ema_id = graph
            .add_with_name("ema12", IndicatorSpec::ema(12))
            .unwrap();
        assert_eq!(graph.len(), 3); // No new node

        // Verify the EMA(12) is the same node the MACD depends on
        assert!(graph.value(ema_id).is_none()); // no data yet

        // Feed data
        let prices: Vec<f64> = (0..50).map(|i| 100.0 + i as f64 * 0.5).collect();
        for bar in &create_bars(&prices) {
            graph.push(bar);
        }

        // Both EMA and MACD should be ready
        assert!(graph.is_ready_by_name("ema12"));
        assert!(graph.is_ready_by_name("macd"));

        // EMA(12) value should be accessible
        assert!(graph.value_by_name("ema12").is_some());

        // MACD should have signal/histogram via result
        let macd_result = graph.result_by_name("macd").unwrap();
        assert!(macd_result.extra.is_some());
    }

    #[test]
    fn test_graph_boll_shares_sma_stddev() {
        let mut graph = IndicatorGraph::new();

        // Add BOLL — should auto-create SMA(20) and StdDev(20)
        graph
            .add_with_name("boll", IndicatorSpec::boll(20, 2.0))
            .unwrap();
        assert_eq!(graph.len(), 3); // SMA(20) + StdDev(20) + BOLL

        // Add standalone SMA(20) — should reuse
        graph
            .add_with_name("sma20", IndicatorSpec::sma(20))
            .unwrap();
        assert_eq!(graph.len(), 3); // No new node

        let prices: Vec<f64> = (0..30).map(|i| 100.0 + i as f64 * 0.5).collect();
        for bar in &create_bars(&prices) {
            graph.push(bar);
        }

        assert!(graph.is_ready_by_name("boll"));
        assert!(graph.is_ready_by_name("sma20"));

        // SMA and BOLL middle band should be the same value
        let sma_val = graph.value_by_name("sma20").unwrap();
        let boll_val = graph.value_by_name("boll").unwrap();
        assert!((sma_val - boll_val).abs() < 1e-10);
    }

    #[test]
    fn test_graph_mixed_spec_and_opaque() {
        let mut graph = IndicatorGraph::new();

        // Spec-based (deduplicated)
        graph
            .add_with_name("rsi14", IndicatorSpec::rsi(14))
            .unwrap();

        // Opaque (not deduplicated)
        let custom = Box::new(MA::sma(10).unwrap());
        graph.add_boxed("custom_sma", custom);

        assert_eq!(graph.len(), 2);

        let prices: Vec<f64> = (0..30).map(|i| 100.0 + i as f64).collect();
        for bar in &create_bars(&prices) {
            graph.push(bar);
        }

        assert!(graph.is_ready_by_name("rsi14"));
        assert!(graph.is_ready_by_name("custom_sma"));
    }

    #[test]
    fn test_graph_complex_sharing() {
        let mut graph = IndicatorGraph::new();

        // Scenario: MACD(12,26,9) + BOLL(20,2) + standalone EMA(12) + SMA(20)
        graph
            .add_with_name("macd", IndicatorSpec::macd(12, 26, 9))
            .unwrap();
        graph
            .add_with_name("boll", IndicatorSpec::boll(20, 2.0))
            .unwrap();
        graph
            .add_with_name("ema12", IndicatorSpec::ema(12))
            .unwrap();
        graph
            .add_with_name("sma20", IndicatorSpec::sma(20))
            .unwrap();

        // MACD creates: EMA(12), EMA(26), MACD = 3 nodes
        // BOLL creates: SMA(20), StdDev(20), BOLL = 3 nodes
        // ema12 reuses EMA(12) from MACD → 0 new
        // sma20 reuses SMA(20) from BOLL → 0 new
        // Total: 6 nodes
        assert_eq!(graph.len(), 6);

        // Without dedup: MACD(12,26,9) + BOLL(20,2) + EMA(12) + SMA(20)
        // would be 4 independent indicators + their internal sub-indicators
        // = 4 user-facing but redundant EMA(12) and SMA(20) computations

        let summary = graph.summary();
        assert_eq!(summary.total_nodes, 6);
        assert_eq!(summary.composite_nodes, 2); // MACD + BOLL
        assert_eq!(summary.named_aliases, 4); // macd, boll, ema12, sma20
    }

    #[test]
    fn test_graph_update_last() {
        let mut graph = IndicatorGraph::new();
        graph.add_with_name("sma5", IndicatorSpec::sma(5)).unwrap();

        let prices: Vec<f64> = (0..10).map(|i| 100.0 + i as f64).collect();
        for bar in &create_bars(&prices) {
            graph.push(bar);
        }

        let v1 = graph.value_by_name("sma5").unwrap();

        // Update last bar with different price
        let updated = Bar::new(9000, 120.0, 121.0, 119.0, 120.0, 100.0);
        graph.update_last(&updated);

        let v2 = graph.value_by_name("sma5").unwrap();
        assert!((v2 - v1).abs() > 1e-10); // Value should change
    }

    #[test]
    fn test_graph_reset() {
        let mut graph = IndicatorGraph::new();
        graph.add_with_name("rsi", IndicatorSpec::rsi(14)).unwrap();

        let prices: Vec<f64> = (0..20).map(|i| 100.0 + i as f64).collect();
        for bar in &create_bars(&prices) {
            graph.push(bar);
        }

        assert!(graph.is_ready_by_name("rsi"));

        graph.reset();

        // After reset, should not be ready
        // Note: is_ready depends on internal state which reset clears
        // The node still exists but its indicator is reset
        assert!(!graph.is_ready_by_name("rsi"));
    }

    #[test]
    fn test_graph_summary() {
        let mut graph = IndicatorGraph::new();
        graph
            .add_with_name("macd", IndicatorSpec::macd(12, 26, 9))
            .unwrap();

        let summary = graph.summary();
        assert_eq!(summary.total_nodes, 3);
        assert_eq!(summary.spec_nodes, 3);
        assert_eq!(summary.opaque_nodes, 0);
        assert_eq!(summary.composite_nodes, 1);
        assert_eq!(summary.named_aliases, 1);
    }
}
