package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.dto.StrategyAiChatRequest;
import com.bi.service.StrategyAiService;
import com.bi.vo.StrategyAiChatResponseVo;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/strategy-ai")
public class StrategyAiController {
    private final StrategyAiService strategyAiService;

    public StrategyAiController(StrategyAiService strategyAiService) {
        this.strategyAiService = strategyAiService;
    }

    @PostMapping("/chat")
    public ApiResponse<StrategyAiChatResponseVo> chat(@RequestBody @Valid StrategyAiChatRequest request) {
        return ApiResponse.ok(strategyAiService.chat(request));
    }

    @PostMapping(value = "/chat-stream", produces = MediaType.TEXT_PLAIN_VALUE)
    public StreamingResponseBody chatStream(@RequestBody @Valid StrategyAiChatRequest request,
                                            HttpServletResponse response) {
        response.setCharacterEncoding("UTF-8");
        return outputStream -> strategyAiService.streamChat(request, outputStream);
    }
}
