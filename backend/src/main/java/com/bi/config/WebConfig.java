package com.bi.config;

import java.nio.file.Paths;
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

        String externalResourceLocation = Paths.get(System.getProperty("user.dir"))
            .resolve("..")
            .resolve(".runtime")
            .resolve("external-resources")
            .normalize()
            .toUri()
            .toString();
        registry.addResourceHandler("/external-resources/**")
            .addResourceLocations(externalResourceLocation.endsWith("/") ? externalResourceLocation : externalResourceLocation + "/")
            .setCacheControl(CacheControl.noStore().mustRevalidate().sMaxAge(0, TimeUnit.SECONDS));

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
