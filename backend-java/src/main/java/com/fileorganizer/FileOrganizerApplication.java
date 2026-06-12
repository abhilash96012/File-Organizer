package com.fileorganizer;

import com.fileorganizer.model.HistoryRecord;
import com.fileorganizer.repository.HistoryRecordRepository;
import com.fileorganizer.service.AutoOrganizerService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.util.List;

@SpringBootApplication
public class FileOrganizerApplication {

    public static void main(String[] args) {
        SpringApplication.run(FileOrganizerApplication.class, args);
    }

    @Bean
    public CommandLineRunner initAutoWatcher(HistoryRecordRepository historyRepository, AutoOrganizerService autoOrganizerService) {
        return args -> {
            List<HistoryRecord> monitored = historyRepository.findByIsAutoOrganizingTrue();
            for (HistoryRecord record : monitored) {
                System.out.println("Restoring watch status for folder: " + record.getFolderPath());
                autoOrganizerService.startWatching(record.getFolderPath());
            }
        };
    }
}
