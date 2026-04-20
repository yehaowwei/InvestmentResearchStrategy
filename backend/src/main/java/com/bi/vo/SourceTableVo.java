package com.bi.vo;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SourceTableVo {
    private String tableName;
    private String tableNameCn;
    private List<FieldMetaVo> fields;
}
