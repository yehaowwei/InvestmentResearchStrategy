package com.bi.config;

import java.util.concurrent.TimeUnit;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
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
