package com.bi.vo;

import com.bi.dto.QueryDsl;
import lombok.Builder;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class ChartPreviewVo {
    private QueryDsl queryDsl;
    private String modelCode;
    private List<Map<String, Object>> rows;
    @Builder.Default
    private Map<String, Object> dslConfig = new LinkedHashMap<>();
}
