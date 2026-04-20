package com.bi.vo;

import lombok.Builder;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class FieldMetaVo {
    private String fieldCode;
    private String columnName;
    private String fieldNameCn;
    private String fieldNameEn;
    private String fieldName;
    private String fieldType;
    private String dataType;
    private boolean dimension;
    private boolean metric;
    private String fieldRole;
    private String aggType;
    private String sourceExpr;
    private String calcType;
    private String baseFieldCode;
    @Builder.Default
    private List<String> aggs = new ArrayList<>();
    private Map<String, Object> ext;
}
