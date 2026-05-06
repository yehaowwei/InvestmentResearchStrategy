package com.bi.dto;

import java.util.List;
import lombok.Data;

@Data
public class ExternalResourceOrderRequest {
    private List<String> fileIds;
}
