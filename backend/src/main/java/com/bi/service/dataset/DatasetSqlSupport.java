package com.bi.service.dataset;

import com.bi.dto.CreateDataPoolRequest;
import com.bi.vo.FieldMetaVo;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class DatasetSqlSupport {
    private static final Pattern SQL_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");
    private static final Pattern SQL_QUALIFIED_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)?");
    private static final Pattern SQL_SELECT_PREFIX = Pattern.compile("(?is)^(select|with)\\b[\\s\\S]*$");
    private static final Pattern TABLE_ALIAS_PATTERN = Pattern.compile("(?i)(?:from|join)\\s+([A-Za-z_][A-Za-z0-9_]*)(?:\\s+(?:as\\s+)?)?([A-Za-z_][A-Za-z0-9_]*)?");
    private static final Pattern CREATE_TABLE_AS_PATTERN = Pattern.compile("(?is)^create\\s+table\\s+([A-Za-z_][A-Za-z0-9_]*)\\s+as\\s+(select\\b.*)$");
    private static final Set<String> BLOCKED_SQL_WORDS = Set.of(
            "insert", "update", "delete", "drop", "alter", "truncate", "create", "replace", "merge", "grant", "revoke"
    );

    public String safeIdentifier(String value, String context) {
        if (value == null || !SQL_IDENTIFIER.matcher(value).matches()) {
            throw new IllegalArgumentException("不安全的标识符 " + context + ": " + value);
        }
        return value;
    }

    public String safeQualifiedIdentifier(String value, String context) {
        if (value == null || !SQL_QUALIFIED_IDENTIFIER.matcher(value).matches()) {
            throw new IllegalArgumentException("不安全的 SQL 表达式 " + context + ": " + value);
        }
        return value;
    }

    public String requireText(String value, String context) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(context + " 不能为空");
        }
        return value.trim();
    }

    public String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    public String normalizeDataPoolType(String dataPoolType) {
        String type = defaultText(dataPoolType, "SOURCE_TABLE").toUpperCase(Locale.ROOT);
        if ("SINGLE_TABLE".equals(type)) {
            return "SOURCE_TABLE";
        }
        if ("MULTI_TABLE".equals(type) || "QUERY_TABLE".equals(type)) {
            return "QUERY_TABLE";
        }
        if (!"SOURCE_TABLE".equals(type)) {
            throw new IllegalArgumentException("不支持的数据池类型: " + dataPoolType);
        }
        return type;
    }

    public String normalizeFieldRole(String fieldRole, String dataType) {
        String role = defaultText(fieldRole, "attribute").toLowerCase(Locale.ROOT);
        if (!List.of("dimension", "metric", "attribute").contains(role)) {
            throw new IllegalArgumentException("不支持的字段角色: " + fieldRole);
        }
        return role;
    }

    public String normalizeDataType(String databaseType) {
        String type = defaultText(databaseType, "string").toLowerCase(Locale.ROOT);
        if (List.of("int", "integer", "bigint", "decimal", "double", "float", "numeric", "smallint", "tinyint", "number").contains(type)) {
            return "number";
        }
        if (List.of("date", "datetime", "timestamp", "time").contains(type)) {
            return "date";
        }
        return "string";
    }

    public String normalizeAggType(String aggType) {
        String agg = defaultText(aggType, "sum").toLowerCase(Locale.ROOT);
        if (!List.of("sum", "avg", "max", "min", "count").contains(agg)) {
            throw new IllegalArgumentException("不支持的聚合方式: " + aggType);
        }
        return agg;
    }

    public String normalizeCalcType(String calcType) {
        String type = defaultText(calcType, "avg").toLowerCase(Locale.ROOT);
        if (!List.of("avg", "sum", "max", "min", "rolling_3y_avg").contains(type)) {
            throw new IllegalArgumentException("不支持的计算指标类型: " + calcType);
        }
        return type;
    }

    public boolean hasQueryUpdate(CreateDataPoolRequest request) {
        return (request.getSqlText() != null && !request.getSqlText().isBlank())
                || (request.getCreateTableSql() != null && !request.getCreateTableSql().isBlank());
    }

    public String resolveQuerySourceSql(CreateDataPoolRequest request, String tableName) {
        if (request.getSqlText() != null && !request.getSqlText().isBlank()) {
            return normalizeSelectSql(request.getSqlText());
        }
        if (request.getCreateTableSql() != null && !request.getCreateTableSql().isBlank()) {
            return extractSelectSqlFromCreateTable(request.getCreateTableSql(), tableName);
        }
        return normalizeSelectSql(request.getSqlText());
    }

    public String resolvePreviewSql(CreateDataPoolRequest request) {
        if (request.getSqlText() != null && !request.getSqlText().isBlank()) {
            String sqlText = request.getSqlText().trim();
            String lower = sqlText.toLowerCase(Locale.ROOT);
            if (lower.startsWith("create table ")) {
                return extractSelectSqlFromAnyCreateTable(sqlText);
            }
            return normalizeSelectSql(sqlText);
        }
        if (request.getCreateTableSql() != null && !request.getCreateTableSql().isBlank()) {
            return extractSelectSqlFromAnyCreateTable(request.getCreateTableSql());
        }
        return normalizeSelectSql(request.getSqlText());
    }

    public String buildCreateTableSql(String tableName, String sqlText) {
        return "CREATE TABLE " + safeIdentifier(tableName, "physicalTableName") + " AS SELECT * FROM (" + sqlText + ") dp_source";
    }

    public DatasetQuerySqlPlan buildQuerySqlPlan(String sql) {
        List<DatasetSelectFieldSpec> specs = parseSelectFieldSpecs(sql);
        if (specs.isEmpty()) {
            return new DatasetQuerySqlPlan(sql, specs);
        }
        int selectIndex = indexOfTopLevelKeyword(sql.toLowerCase(Locale.ROOT), "select");
        int fromIndex = indexOfTopLevelKeyword(sql.toLowerCase(Locale.ROOT), "from");
        if (selectIndex < 0 || fromIndex <= selectIndex) {
            return new DatasetQuerySqlPlan(sql, specs);
        }
        String prefix = sql.substring(0, selectIndex + 6);
        String suffix = sql.substring(fromIndex);
        List<String> rewrittenItems = new ArrayList<>();
        int fallbackIndex = 1;
        for (DatasetSelectFieldSpec spec : specs) {
            String rewrittenAlias = spec.safeAlias();
            if (rewrittenAlias == null || rewrittenAlias.isBlank()) {
                rewrittenAlias = buildSafeFieldCode(spec.expression(), fallbackIndex++);
            }
            rewrittenItems.add(spec.expression() + " AS " + rewrittenAlias);
        }
        return new DatasetQuerySqlPlan(prefix + " " + String.join(", ", rewrittenItems) + " " + suffix, specs);
    }

    public Map<String, String> parseTableAliasMap(String sql) {
        var matcher = TABLE_ALIAS_PATTERN.matcher(collapseWhitespace(sql));
        Map<String, String> aliasMap = new LinkedHashMap<>();
        while (matcher.find()) {
            String tableName = safeIdentifier(matcher.group(1), "tableName");
            String alias = matcher.group(2);
            String resolvedAlias = alias == null || alias.isBlank() ? tableName : safeIdentifier(alias, "tableAlias");
            aliasMap.put(resolvedAlias, tableName);
            aliasMap.putIfAbsent(tableName, tableName);
        }
        return aliasMap;
    }

    public String resolveFieldDisplayName(DatasetSelectFieldSpec spec,
                                          Map<String, String> aliasToTable,
                                          Map<String, FieldMetaVo> sourceFieldMap,
                                          String fallback) {
        if (spec.alias() != null && !spec.alias().isBlank()) {
            return spec.alias();
        }
        String expression = stripWrapping(spec.expression());
        if (!SQL_QUALIFIED_IDENTIFIER.matcher(expression).matches()) {
            return fallback;
        }
        String[] parts = expression.split("\\.");
        String alias = parts.length == 2 ? parts[0] : "";
        String fieldCode = parts.length == 2 ? parts[1] : parts[0];
        String tableName = parts.length == 2 ? aliasToTable.getOrDefault(alias, alias) : "";
        if (!tableName.isBlank()) {
            FieldMetaVo fieldMeta = sourceFieldMap.get((tableName + "." + fieldCode).toLowerCase(Locale.ROOT));
            if (fieldMeta != null && fieldMeta.getFieldName() != null && !fieldMeta.getFieldName().isBlank()) {
                return fieldMeta.getFieldName();
            }
        }
        return fallback;
    }

    private List<DatasetSelectFieldSpec> parseSelectFieldSpecs(String sql) {
        String lowerSql = sql.toLowerCase(Locale.ROOT);
        int selectIndex = indexOfTopLevelKeyword(lowerSql, "select");
        int fromIndex = indexOfTopLevelKeyword(lowerSql, "from");
        if (selectIndex < 0 || fromIndex <= selectIndex) {
            return List.of();
        }
        String selectClause = sql.substring(selectIndex + 6, fromIndex).trim();
        if (selectClause.isBlank()) {
            return List.of();
        }
        return splitTopLevel(selectClause, ',').stream()
                .map(this::parseSelectField)
                .toList();
    }

    private DatasetSelectFieldSpec parseSelectField(String rawItem) {
        String item = rawItem.trim();
        String expression = item;
        String alias = null;
        String safeAlias = null;
        int asIndex = lastTopLevelAsIndex(item);
        if (asIndex >= 0) {
            expression = item.substring(0, asIndex).trim();
            alias = stripWrapping(item.substring(asIndex + 4).trim());
            safeAlias = SQL_IDENTIFIER.matcher(alias).matches() ? alias : null;
        }
        return new DatasetSelectFieldSpec(item, expression, alias, safeAlias);
    }

    private String buildSafeFieldCode(String expression, int index) {
        String candidate = stripWrapping(expression);
        if (SQL_QUALIFIED_IDENTIFIER.matcher(candidate).matches()) {
            String[] parts = candidate.split("\\.");
            candidate = parts[parts.length - 1];
        }
        candidate = candidate.replaceAll("[^A-Za-z0-9_]", "_");
        candidate = candidate.replaceAll("_+", "_");
        candidate = candidate.replaceAll("^_+", "");
        candidate = candidate.replaceAll("_+$", "");
        if (candidate.isBlank()) {
            candidate = "field_" + index;
        }
        if (!Character.isLetter(candidate.charAt(0)) && candidate.charAt(0) != '_') {
            candidate = "f_" + candidate;
        }
        return safeIdentifier(candidate, "generated fieldCode");
    }

    private String extractSelectSqlFromCreateTable(String createTableSql, String expectedTableName) {
        String sql = requireText(createTableSql, "createTableSql").trim();
        while (sql.endsWith(";")) {
            sql = sql.substring(0, sql.length() - 1).trim();
        }
        if (sql.contains(";") || sql.contains("--") || sql.contains("/*") || sql.contains("*/")) {
            throw new IllegalArgumentException("建表语句不能包含多语句或注释");
        }
        var matcher = CREATE_TABLE_AS_PATTERN.matcher(sql);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("建表语句仅支持 CREATE TABLE <table> AS SELECT ...");
        }
        String tableName = safeIdentifier(matcher.group(1), "physicalTableName");
        if (!tableName.equals(expectedTableName)) {
            throw new IllegalArgumentException("建表语句中的表名必须与数据池编码一致: " + expectedTableName);
        }
        return normalizeSelectSql(matcher.group(2));
    }

    private String extractSelectSqlFromAnyCreateTable(String createTableSql) {
        String sql = requireText(createTableSql, "sqlText").trim();
        while (sql.endsWith(";")) {
            sql = sql.substring(0, sql.length() - 1).trim();
        }
        if (sql.contains(";") || sql.contains("--") || sql.contains("/*") || sql.contains("*/")) {
            throw new IllegalArgumentException("建表语句不能包含多语句或注释");
        }
        var matcher = CREATE_TABLE_AS_PATTERN.matcher(sql);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("数据池 SQL 只能是 SELECT 查询，或 CREATE TABLE ... AS SELECT ...");
        }
        return normalizeSelectSql(matcher.group(2));
    }

    private String normalizeSelectSql(String sqlText) {
        String sql = requireText(sqlText, "sqlText").trim();
        while (sql.endsWith(";")) {
            sql = sql.substring(0, sql.length() - 1).trim();
        }
        String lower = sql.toLowerCase(Locale.ROOT);
        if (!SQL_SELECT_PREFIX.matcher(sql).matches()) {
            throw new IllegalArgumentException("数据池 SQL 只能是 SELECT 查询");
        }
        if (sql.contains(";") || lower.contains("--") || lower.contains("/*") || lower.contains("*/")) {
            throw new IllegalArgumentException("数据池 SQL 不能包含多语句或注释");
        }
        for (String word : BLOCKED_SQL_WORDS) {
            if (Pattern.compile("(^|\\W)" + word + "(\\W|$)", Pattern.CASE_INSENSITIVE).matcher(sql).find()) {
                throw new IllegalArgumentException("数据池 SQL 不能包含写操作关键字: " + word);
            }
        }
        return sql;
    }

    private int indexOfTopLevelKeyword(String sql, String keyword) {
        int level = 0;
        boolean singleQuote = false;
        boolean doubleQuote = false;
        for (int index = 0; index <= sql.length() - keyword.length(); index++) {
            char current = sql.charAt(index);
            if (current == '\'' && !doubleQuote) {
                singleQuote = !singleQuote;
            } else if (current == '"' && !singleQuote) {
                doubleQuote = !doubleQuote;
            } else if (!singleQuote && !doubleQuote) {
                if (current == '(') {
                    level++;
                } else if (current == ')') {
                    level = Math.max(0, level - 1);
                }
            }
            if (level == 0 && !singleQuote && !doubleQuote && sql.startsWith(keyword, index)) {
                boolean leftBoundary = index == 0 || !Character.isLetterOrDigit(sql.charAt(index - 1));
                boolean rightBoundary = index + keyword.length() >= sql.length()
                        || !Character.isLetterOrDigit(sql.charAt(index + keyword.length()));
                if (leftBoundary && rightBoundary) {
                    return index;
                }
            }
        }
        return -1;
    }

    private List<String> splitTopLevel(String text, char delimiter) {
        List<String> parts = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int level = 0;
        boolean singleQuote = false;
        boolean doubleQuote = false;
        for (int index = 0; index < text.length(); index++) {
            char ch = text.charAt(index);
            if (ch == '\'' && !doubleQuote) {
                singleQuote = !singleQuote;
            } else if (ch == '"' && !singleQuote) {
                doubleQuote = !doubleQuote;
            } else if (!singleQuote && !doubleQuote) {
                if (ch == '(') {
                    level++;
                } else if (ch == ')') {
                    level = Math.max(0, level - 1);
                } else if (ch == delimiter && level == 0) {
                    parts.add(current.toString().trim());
                    current.setLength(0);
                    continue;
                }
            }
            current.append(ch);
        }
        if (!current.isEmpty()) {
            parts.add(current.toString().trim());
        }
        return parts;
    }

    private int lastTopLevelAsIndex(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        int level = 0;
        boolean singleQuote = false;
        boolean doubleQuote = false;
        int result = -1;
        for (int index = 0; index <= lower.length() - 4; index++) {
            char ch = lower.charAt(index);
            if (ch == '\'' && !doubleQuote) {
                singleQuote = !singleQuote;
            } else if (ch == '"' && !singleQuote) {
                doubleQuote = !doubleQuote;
            } else if (!singleQuote && !doubleQuote) {
                if (ch == '(') {
                    level++;
                } else if (ch == ')') {
                    level = Math.max(0, level - 1);
                }
            }
            if (level == 0 && !singleQuote && !doubleQuote && lower.startsWith(" as ", index)) {
                result = index;
            }
        }
        return result;
    }

    private String stripWrapping(String text) {
        String value = text == null ? "" : text.trim();
        if ((value.startsWith("`") && value.endsWith("`")) || (value.startsWith("\"") && value.endsWith("\""))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private String collapseWhitespace(String text) {
        return text == null ? "" : text.replaceAll("\\s+", " ").trim();
    }
}
