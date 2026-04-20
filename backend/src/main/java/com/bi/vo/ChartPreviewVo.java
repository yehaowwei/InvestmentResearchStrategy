package com.bi.vo;

import com.bi.dto.QueryDsl;
import com.bi.dto.ViewDsl;
import lombok.Builder;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class ChartPreviewVo {
    private QueryDsl queryDsl;
    private ViewDsl viewDsl;
    private String modelCode;
    private String generatedSql;
    private List<Map<String, Object>> rows;
    private List<String> dimensions;
    private List<String> metrics;
    private String datasetCode;
    @Builder.Default
    private Map<String, Object> dslConfig = new LinkedHashMap<>();
}
