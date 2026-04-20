package com.bi.config;

import com.bi.common.JsonSnapshotSupport;
import com.bi.service.DatasetService;
import com.bi.service.impl.DatasetServiceImpl;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Bean
    public DatasetService datasetService(JdbcTemplate jdbcTemplate, JsonSnapshotSupport jsonSnapshotSupport) {
        return new DatasetServiceImpl(jdbcTemplate, jsonSnapshotSupport);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**").allowedMethods("*").allowedOrigins("*").allowedHeaders("*");
    }
}
