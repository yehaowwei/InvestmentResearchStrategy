package com.bi.vo;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class StrategyAiChatResponseVo {
    private String reply;
    private boolean fallback;
    private String provider;
    private String reason;
}
