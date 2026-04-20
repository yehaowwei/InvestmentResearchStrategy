package com.bi.dto;

import lombok.Data;

@Data
public class SortCondition {
    private String fieldCode;
    private String direction = "asc";
}
