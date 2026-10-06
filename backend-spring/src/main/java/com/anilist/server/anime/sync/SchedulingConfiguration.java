package com.anilist.server.anime.sync;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Enables cron execution for the standalone Spring process and the API process. */
@Configuration
@EnableScheduling
public class SchedulingConfiguration {
}
