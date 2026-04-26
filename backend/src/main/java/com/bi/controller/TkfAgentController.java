package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.dto.TkfAgentRequest;
import com.bi.service.TkfAgentService;
import com.bi.vo.TkfAgentResponseVo;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agent/tkf")
public class TkfAgentController {
    private final TkfAgentService tkfAgentService;

    public TkfAgentController(TkfAgentService tkfAgentService) {
        this.tkfAgentService = tkfAgentService;
    }

    @PostMapping("/chat")
    public ApiResponse<TkfAgentResponseVo> chat(@RequestBody @Valid TkfAgentRequest request) {
        return ApiResponse.ok(tkfAgentService.chat(request));
    }
}
