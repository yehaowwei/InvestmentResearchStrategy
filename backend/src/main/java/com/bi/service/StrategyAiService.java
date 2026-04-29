package com.bi.service;

import com.bi.dto.StrategyAiChatRequest;
import com.bi.vo.StrategyAiChatResponseVo;

import java.io.IOException;
import java.io.OutputStream;

public interface StrategyAiService {
    StrategyAiChatResponseVo chat(StrategyAiChatRequest request);

    void streamChat(StrategyAiChatRequest request, OutputStream outputStream) throws IOException;
}
