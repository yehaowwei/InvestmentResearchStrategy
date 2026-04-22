package com.bi.config;

import com.bi.common.JsonSnapshotSupport;
import com.bi.service.DatasetService;
import com.bi.service.impl.DatasetServiceImpl;
import java.util.concurrent.TimeUnit;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
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

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
            .addResourceLocations("classpath:/static/assets/")
            .setCacheControl(CacheControl.noStore().mustRevalidate());

        registry.addResourceHandler(
                "/",
                "/index.html",
                "/favicon.ico",
                "/manifest.json",
                "/robots.txt",
                "/**")
            .addResourceLocations("classpath:/static/")
            .setCacheControl(CacheControl.noStore().mustRevalidate().sMaxAge(0, TimeUnit.SECONDS));
    }
}
