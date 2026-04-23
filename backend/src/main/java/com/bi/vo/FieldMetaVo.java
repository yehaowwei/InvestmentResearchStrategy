package com.bi.vo;

import lombok.Builder;
import lombok.Data;
@Data
@Builder
public class FieldMetaVo {
    private String fieldCode;
    private String fieldName;
    private String dataType;
    private String fieldRole;
    private String aggType;
    private String sourceExpr;
    private String calcType;
    private String baseFieldCode;
}
