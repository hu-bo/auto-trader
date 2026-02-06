package utils

import (
	"reflect"
)

// CompactResponse 紧凑响应格式
// 将 []struct 转换为列式存储，减少 JSON 体积
type CompactResponse struct {
	Columns []string        `json:"columns"`
	Data    [][]interface{} `json:"data"`
}

// CompactSlice 将结构体切片转换为紧凑格式
// 支持任意结构体类型，自动提取 json tag 作为列名
//
// Example:
//
//	candles := []NormalizedCandle{...}
//	compact := CompactSlice(candles)
//	// {"columns":["symbol","timestamp",...], "data":[["BTC-USDT",1703001600000,...],...]}
func CompactSlice(slice interface{}) *CompactResponse {
	v := reflect.ValueOf(slice)
	if v.Kind() != reflect.Slice || v.Len() == 0 {
		return &CompactResponse{Columns: []string{}, Data: [][]interface{}{}}
	}

	// 获取元素类型
	elemType := v.Type().Elem()
	if elemType.Kind() == reflect.Ptr {
		elemType = elemType.Elem()
	}

	// 提取列名 (从 json tag)
	columns := extractColumns(elemType)
	if len(columns) == 0 {
		return &CompactResponse{Columns: []string{}, Data: [][]interface{}{}}
	}

	// 提取数据
	data := make([][]interface{}, v.Len())
	for i := 0; i < v.Len(); i++ {
		elem := v.Index(i)
		if elem.Kind() == reflect.Ptr {
			elem = elem.Elem()
		}
		data[i] = extractRow(elem, elemType)
	}

	return &CompactResponse{
		Columns: columns,
		Data:    data,
	}
}

// CompactSliceWithFields 只包含指定字段的紧凑格式
func CompactSliceWithFields(slice interface{}, fields []string) *CompactResponse {
	v := reflect.ValueOf(slice)
	if v.Kind() != reflect.Slice || v.Len() == 0 {
		return &CompactResponse{Columns: fields, Data: [][]interface{}{}}
	}

	elemType := v.Type().Elem()
	if elemType.Kind() == reflect.Ptr {
		elemType = elemType.Elem()
	}

	// 构建字段索引映射
	fieldIndexes := make([]int, 0, len(fields))
	for _, name := range fields {
		for j := 0; j < elemType.NumField(); j++ {
			field := elemType.Field(j)
			jsonTag := getJSONTag(field)
			if jsonTag == name {
				fieldIndexes = append(fieldIndexes, j)
				break
			}
		}
	}

	// 提取数据
	data := make([][]interface{}, v.Len())
	for i := 0; i < v.Len(); i++ {
		elem := v.Index(i)
		if elem.Kind() == reflect.Ptr {
			elem = elem.Elem()
		}
		row := make([]interface{}, len(fieldIndexes))
		for j, idx := range fieldIndexes {
			row[j] = elem.Field(idx).Interface()
		}
		data[i] = row
	}

	return &CompactResponse{
		Columns: fields,
		Data:    data,
	}
}

// extractColumns 提取结构体的 json 列名
func extractColumns(t reflect.Type) []string {
	columns := make([]string, 0, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		jsonTag := getJSONTag(field)
		if jsonTag != "" && jsonTag != "-" {
			columns = append(columns, jsonTag)
		}
	}
	return columns
}

// extractRow 提取一行数据
func extractRow(v reflect.Value, t reflect.Type) []interface{} {
	row := make([]interface{}, 0, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		jsonTag := getJSONTag(field)
		if jsonTag != "" && jsonTag != "-" {
			row = append(row, v.Field(i).Interface())
		}
	}
	return row
}

// getJSONTag 获取字段的 json tag
func getJSONTag(field reflect.StructField) string {
	tag := field.Tag.Get("json")
	if tag == "" {
		return field.Name
	}
	// 处理 json:"name,omitempty" 格式
	for i, c := range tag {
		if c == ',' {
			return tag[:i]
		}
	}
	return tag
}

// ExpandCompact 将紧凑格式还原为 map 切片 (用于调试或兼容)
func (c *CompactResponse) ExpandToMaps() []map[string]interface{} {
	result := make([]map[string]interface{}, len(c.Data))
	for i, row := range c.Data {
		m := make(map[string]interface{}, len(c.Columns))
		for j, col := range c.Columns {
			if j < len(row) {
				m[col] = row[j]
			}
		}
		result[i] = m
	}
	return result
}

// Len 返回数据行数
func (c *CompactResponse) Len() int {
	return len(c.Data)
}

// IsEmpty 是否为空
func (c *CompactResponse) IsEmpty() bool {
	return len(c.Data) == 0
}

// CandleCompactFields K线常用紧凑字段
var CandleCompactFields = []string{
	"timestamp", "open", "high", "low", "close", "volume", "buy_volume",
}

// CandleMinimalFields K线最小字段 (OHLCV)
var CandleMinimalFields = []string{
	"timestamp", "open", "high", "low", "close", "volume",
}

// CompactCandles 专门用于 K 线数据的紧凑格式
func CompactCandles(candles interface{}) *CompactResponse {
	return CompactSliceWithFields(candles, CandleCompactFields)
}

// CompactCandlesMinimal 最小 K 线数据 (不含 buy_volume 等)
func CompactCandlesMinimal(candles interface{}) *CompactResponse {
	return CompactSliceWithFields(candles, CandleMinimalFields)
}

// ColumnResponse 列式存储响应格式 (Column-Oriented)
// 每个字段一个数组，更有利于压缩
// Example: {"timestamp": [1,2,3], "open": [100,101,102], ...}
type ColumnResponse map[string][]interface{}

// ToColumnFormat 将结构体切片转换为列式存储格式
// 每个字段名对应一个值数组
func ToColumnFormat(slice interface{}, fields []string) ColumnResponse {
	v := reflect.ValueOf(slice)
	if v.Kind() != reflect.Slice || v.Len() == 0 {
		result := make(ColumnResponse)
		for _, f := range fields {
			result[f] = []interface{}{}
		}
		return result
	}

	elemType := v.Type().Elem()
	if elemType.Kind() == reflect.Ptr {
		elemType = elemType.Elem()
	}

	// 构建字段索引映射
	fieldIndexes := make(map[string]int)
	for _, name := range fields {
		for j := 0; j < elemType.NumField(); j++ {
			field := elemType.Field(j)
			jsonTag := getJSONTag(field)
			if jsonTag == name {
				fieldIndexes[name] = j
				break
			}
		}
	}

	// 初始化列
	result := make(ColumnResponse)
	for _, f := range fields {
		result[f] = make([]interface{}, v.Len())
	}

	// 填充数据
	for i := 0; i < v.Len(); i++ {
		elem := v.Index(i)
		if elem.Kind() == reflect.Ptr {
			elem = elem.Elem()
		}
		for _, name := range fields {
			if idx, ok := fieldIndexes[name]; ok {
				result[name][i] = elem.Field(idx).Interface()
			}
		}
	}

	return result
}

// CandlesToColumnFormat 将 K 线数据转换为列式存储格式
func CandlesToColumnFormat(candles interface{}) ColumnResponse {
	return ToColumnFormat(candles, CandleCompactFields)
}

// CandlesToColumnFormatMinimal 最小 K 线数据列式格式
func CandlesToColumnFormatMinimal(candles interface{}) ColumnResponse {
	return ToColumnFormat(candles, CandleMinimalFields)
}
