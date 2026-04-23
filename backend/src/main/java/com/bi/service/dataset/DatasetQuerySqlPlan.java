package com.bi.service.dataset;

import java.util.List;

public record DatasetQuerySqlPlan(String rewrittenSql, List<DatasetSelectFieldSpec> selectFieldSpecs) {
}
