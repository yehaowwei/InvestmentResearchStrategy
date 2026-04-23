package com.bi.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class FilterCondition {
    private String fieldCode;
    private String operator;
    private List<String> values = new ArrayList<>();
    private String value;
}
