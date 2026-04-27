package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.dto.SharedStateRequest;
import com.bi.service.SharedStateService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shared-state")
public class SharedStateController {
    private final SharedStateService sharedStateService;

    public SharedStateController(SharedStateService sharedStateService) {
        this.sharedStateService = sharedStateService;
    }

    @GetMapping("/{stateKey}")
    public ApiResponse<Object> getState(@PathVariable("stateKey") String stateKey) {
        return ApiResponse.ok(sharedStateService.getState(stateKey));
    }

    @PutMapping("/{stateKey}")
    public ApiResponse<Object> saveState(@PathVariable("stateKey") String stateKey,
                                         @RequestBody SharedStateRequest request) {
        return ApiResponse.ok(sharedStateService.saveState(stateKey, request.getState()));
    }
}
