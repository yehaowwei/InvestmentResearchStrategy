package com.bi.dto;

import lombok.Data;

@Data
public class TableColumnDsl {
    private String fieldCode;
    private String title;
    private Integer order;
    private String formatter;
}
